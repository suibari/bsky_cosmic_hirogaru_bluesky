import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.SHARE_KV) error(503, 'KV not available')

	const raw = await platform.env.SHARE_KV.get(`share:${params.id}`)
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
