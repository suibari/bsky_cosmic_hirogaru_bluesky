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

	const cached = await isTrackedDid(selfDid, env).catch(() => false)

	// アクセスのたびに追跡登録（重複はサーバー側で無視）
	registerTrackedDid(selfDid, env).catch((err) => console.warn('[db] registerTrackedDid failed:', err))

	let rawEvents
	if (cached) {
		rawEvents = await fetchEventsByDid(selfDid, env)
	} else {
		rawEvents = await fetchRawEvents(selfDid)
		insertEvents(rawEvents, env).catch((err) => console.warn('[db] insert failed:', err))
	}

	const graphData = await buildGraphDataFromEvents(selfDid, rawEvents)
	return json({ ...graphData, events: rawEvents, cached })
}
