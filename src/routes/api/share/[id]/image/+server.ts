import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getShareKV } from '$lib/kv'

export const GET: RequestHandler = async ({ params, platform }) => {
	const kv = getShareKV(platform)
	if (!kv) error(503, 'KV not available')

	const raw = await kv.get(`share:${params.id}`)
	if (!raw) error(404, 'Share not found')

	const { imageBase64 } = JSON.parse(raw)
	const base64Data = (imageBase64 as string).replace(/^data:image\/jpeg;base64,/, '')
	const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

	return new Response(bytes, {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=604800'
		}
	})
}
