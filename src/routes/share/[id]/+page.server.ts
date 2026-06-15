import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.SHARE_KV) error(503, 'KV not available')

	const raw = await platform.env.SHARE_KV.get(`share:${params.id}`)
	if (!raw) error(404, 'Share not found')

	const { handle } = JSON.parse(raw)
	return { id: params.id, handle: handle as string }
}
