import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const src = url.searchParams.get('url')
	if (!src) return new Response('Missing url', { status: 400 })

	try {
		const res = await fetch(src, {
			headers: { 'User-Agent': 'cho-hirogaru-bluesky/suibari-cha.bsky.social' }
		})
		if (!res.ok) return new Response('Upstream error', { status: 502 })

		return new Response(res.body, {
			headers: {
				'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
				'Cache-Control': 'public, max-age=86400'
			}
		})
	} catch {
		return new Response('Fetch failed', { status: 502 })
	}
}
