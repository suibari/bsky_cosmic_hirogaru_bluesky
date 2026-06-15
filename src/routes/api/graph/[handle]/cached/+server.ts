import { json, error } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'
import { isTrackedDid } from '$lib/db/events'
import type { DbEnv } from '$lib/db/client'
import { resolveHandle } from '$lib/graph/fetchGraphData'

export const GET: RequestHandler = async ({ params, platform }) => {
	const handle = params.handle

	const env: DbEnv = dev
		? {
			DB_API_URL:        process.env.DB_API_URL        ?? '',
			CF_CLIENT_ID:      process.env.CF_CLIENT_ID      ?? '',
			CF_CLIENT_SECRET:  process.env.CF_CLIENT_SECRET  ?? '',
		}
		: platform!.env

	let selfDid: string
	try {
		selfDid = await resolveHandle(handle)
	} catch {
		throw error(404, 'Handle not found')
	}

	const cached = await isTrackedDid(selfDid, env).catch(() => false)
	return json({ cached })
}
