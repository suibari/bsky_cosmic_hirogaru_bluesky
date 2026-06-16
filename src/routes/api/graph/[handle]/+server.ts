import { json, error } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { env as privateEnv } from '$env/dynamic/private'
import type { RequestHandler } from './$types'
import { isTrackedDid, fetchEventsByDid, insertEvents, registerTrackedDid } from '$lib/db/events'
import type { DbEnv } from '$lib/db/client'
import { resolveHandle, fetchRawEvents, buildGraphDataFromEvents } from '$lib/graph/fetchGraphData'

export const GET: RequestHandler = async ({ params, platform }) => {
	const handle = params.handle

	const env: DbEnv = dev
		? {
			DB_API_URL:        privateEnv.DB_API_URL        ?? '',
			CF_CLIENT_ID:      privateEnv.CF_CLIENT_ID      ?? '',
			CF_CLIENT_SECRET:  privateEnv.CF_CLIENT_SECRET  ?? '',
		}
		: platform!.env

	let selfDid: string
	try {
		selfDid = await resolveHandle(handle)
	} catch {
		throw error(404, 'Handle not found')
	}

	const cached = await isTrackedDid(selfDid, env).catch((err) => {
		console.error('[db] isTrackedDid failed:', err)
		return false
	})
	console.log(`[db] handle=${handle} did=${selfDid} cached=${cached}`)

	let rawEvents
	if (cached) {
		rawEvents = await fetchEventsByDid(selfDid, env)
		// last_accessed_at 更新
		registerTrackedDid(selfDid, env).catch((err) => console.error('[db] registerTrackedDid (cached) failed:', err))
	} else {
		try {
			rawEvents = await fetchRawEvents(selfDid)
		} catch (e) {
			console.error('[graph] fetchRawEvents failed:', e)
			throw error(503, 'グラフデータの取得に失敗しました。しばらく待ってから再度お試しください。')
		}
	}

	let graphData
	try {
		graphData = await buildGraphDataFromEvents(selfDid, rawEvents)
	} catch (e) {
		console.error('[graph] buildGraphDataFromEvents failed:', e)
		throw error(503, 'プロフィールの取得に失敗しました。しばらく待ってから再度お試しください。')
	}

	if (!cached) {
		// insertEvents 成功後にのみ tracked_dids へ登録する。
		// fetch失敗→503の場合はここに到達しないため、次回アクセスで PDS から再取得される。
		// CF Workers では Response 返却後に Isolate が終了するため waitUntil で完了を保証する。
		const dbWork = insertEvents(rawEvents, env)
			.then(() => registerTrackedDid(selfDid, env))
			.then(() => console.log(`[db] registered did=${selfDid}`))
			.catch((err) => console.error('[db] insert/register failed:', err))
		platform?.ctx?.waitUntil(dbWork)
	}

	return json({ ...graphData, events: rawEvents, cached })
}
