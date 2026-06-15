import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { hasEventsForDid, fetchEventsByDid, insertEvents, registerTrackedDid } from '$lib/db/events'
import { resolveHandle, fetchRawEvents, buildGraphDataFromEvents } from '$lib/graph/fetchGraphData'

export const GET: RequestHandler = async ({ params }) => {
	const handle = params.handle

	let selfDid: string
	try {
		selfDid = await resolveHandle(handle)
	} catch {
		throw error(404, 'Handle not found')
	}

	const cached = await hasEventsForDid(selfDid).catch(() => false)

	// アクセスのたびに追跡登録（重複はサーバー側で無視）
	registerTrackedDid(selfDid).catch((err) => console.warn('[db] registerTrackedDid failed:', err))

	let rawEvents
	if (cached) {
		rawEvents = await fetchEventsByDid(selfDid)
	} else {
		rawEvents = await fetchRawEvents(selfDid)
		insertEvents(rawEvents).catch((err) => console.warn('[db] insert failed:', err))
	}

	const graphData = await buildGraphDataFromEvents(selfDid, rawEvents)
	return json({ ...graphData, events: rawEvents })
}
