import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { getShareKV } from '$lib/kv'

export const load: PageServerLoad = async ({ params, platform }) => {
	const kv = getShareKV(platform)
	if (!kv) error(503, 'KV not available')

	const raw = await kv.get(`share:${params.id}`)
	if (!raw) error(404, 'Share not found')

	const { handle } = JSON.parse(raw)
	return { id: params.id, handle: handle as string }
}
