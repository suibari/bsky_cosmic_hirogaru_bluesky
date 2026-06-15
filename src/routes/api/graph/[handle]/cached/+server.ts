import { json, error } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { env as privateEnv } from '$env/dynamic/private'
import type { RequestHandler } from './$types'
import { isTrackedDid } from '$lib/db/events'
import type { DbEnv } from '$lib/db/client'
import { resolveHandle } from '$lib/graph/fetchGraphData'

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

	let isFirstAccess = false
	try {
		const tracked = await isTrackedDid(selfDid, env)
		isFirstAccess = !tracked
	} catch {
		isFirstAccess = false  // DB障害時は安全側にフォールバック
	}

	return json({ isFirstAccess })
}
