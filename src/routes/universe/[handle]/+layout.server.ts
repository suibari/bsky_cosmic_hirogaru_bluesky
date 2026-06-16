import type { LayoutServerLoad } from './$types'

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'
const UA = 'cho-hirogaru-bluesky/suibari-cha.bsky.social'

export const load: LayoutServerLoad = async ({ params }) => {
	try {
		const res = await fetch(
			`${BSKY_BASE}/app.bsky.actor.getProfile?actor=${encodeURIComponent(params.handle)}`,
			{ headers: { 'User-Agent': UA } }
		)
		if (!res.ok) return { ogpHandle: params.handle, ogpDisplayName: '' }
		const data = await res.json()
		return {
			ogpHandle: data.handle as string,
			ogpDisplayName: (data.displayName ?? '') as string,
		}
	} catch {
		return { ogpHandle: params.handle, ogpDisplayName: '' }
	}
}
