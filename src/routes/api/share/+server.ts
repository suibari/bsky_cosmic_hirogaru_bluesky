import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getShareKV } from '$lib/kv'

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const kv = getShareKV(platform)
	if (!kv) error(503, 'Share feature requires Cloudflare KV (deploy to Cloudflare Pages)')

	const { handle, imageBase64 } = await request.json()
	if (!handle || !imageBase64) error(400, 'Missing required fields')

	const id = crypto.randomUUID()
	const data = JSON.stringify({
		handle,
		imageBase64,
		createdAt: new Date().toISOString()
	})

	await kv.put(`share:${id}`, data, { expirationTtl: 604800 }) // 7 days

	return json({ id, url: `${url.origin}/share/${id}` })
}
