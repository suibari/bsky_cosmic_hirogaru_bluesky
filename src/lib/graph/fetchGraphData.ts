import type { NodeData } from '$lib/types'

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'
const CONSTELLATION_BASE = 'https://constellation.microcosm.blue/xrpc'
const UA = 'cho-hirogaru-bluesky/suibari-cha.bsky.social'
const PAGE_LIMIT = 100
const MAX_PAGES = 3

const WEIGHTS = { like: 1, repost: 3, reply: 5, quote: 3, follow: 10 } as const
type Kind = keyof typeof WEIGHTS

export type ProfileInfo = {
	did: string
	handle: string
	displayName: string
	avatarUrl: string
}

function emptyNode(did: string): NodeData {
	return {
		did,
		handle: did,
		displayName: '',
		avatarUrl: '',
		counts: { like: 0, repost: 0, reply: 0, quote: 0, follow: 0 },
		totalScore: 0,
		direction: 'actor'
	}
}

async function resolveHandle(handle: string): Promise<string> {
	const res = await fetch(
		`${BSKY_BASE}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
	)
	if (!res.ok) throw new Error(`ハンドルの解決に失敗しました (${res.status})`)
	const data = await res.json()
	return data.did as string
}

async function getProfile(actor: string): Promise<ProfileInfo> {
	const res = await fetch(
		`${BSKY_BASE}/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`
	)
	if (!res.ok) throw new Error(`プロフィールの取得に失敗しました (${res.status})`)
	const data = await res.json()
	return {
		did: data.did,
		handle: data.handle,
		displayName: data.displayName ?? '',
		avatarUrl: data.avatar ?? ''
	}
}

// Returns DIDs of post authors the actor has liked
async function getActorLikes(did: string): Promise<string[]> {
	const dids: string[] = []
	let cursor: string | undefined
	let pages = 0
	do {
		const params = new URLSearchParams({ actor: did, limit: String(PAGE_LIMIT) })
		if (cursor) params.set('cursor', cursor)
		const res = await fetch(`${BSKY_BASE}/app.bsky.feed.getActorLikes?${params}`)
		if (!res.ok) break
		const data = await res.json()
		for (const item of data.feed ?? []) {
			const authorDid = item.post?.author?.did as string | undefined
			if (authorDid && authorDid !== did) dids.push(authorDid)
		}
		cursor = data.cursor
		pages++
	} while (cursor && pages < MAX_PAGES)
	return dids
}

// Returns DIDs the actor follows
async function getActorFollows(did: string): Promise<string[]> {
	const dids: string[] = []
	let cursor: string | undefined
	let pages = 0
	do {
		const params = new URLSearchParams({ actor: did, limit: String(PAGE_LIMIT) })
		if (cursor) params.set('cursor', cursor)
		const res = await fetch(`${BSKY_BASE}/app.bsky.graph.getFollows?${params}`)
		if (!res.ok) break
		const data = await res.json()
		for (const item of data.follows ?? []) {
			const itemDid = item.did as string | undefined
			if (itemDid && itemDid !== did) dids.push(itemDid)
		}
		cursor = data.cursor
		pages++
	} while (cursor && pages < MAX_PAGES)
	return dids
}

// Returns DIDs of original post authors the actor has reposted
async function getActorReposts(did: string): Promise<string[]> {
	const dids: string[] = []
	let cursor: string | undefined
	let pages = 0
	do {
		const params = new URLSearchParams({ actor: did, limit: String(PAGE_LIMIT) })
		if (cursor) params.set('cursor', cursor)
		const res = await fetch(`${BSKY_BASE}/app.bsky.feed.getAuthorFeed?${params}`)
		if (!res.ok) break
		const data = await res.json()
		for (const item of data.feed ?? []) {
			if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
				const authorDid = item.post?.author?.did as string | undefined
				if (authorDid && authorDid !== did) dids.push(authorDid)
			}
		}
		cursor = data.cursor
		pages++
	} while (cursor && pages < MAX_PAGES)
	return dids
}

// Returns backlinks (what others did TO the actor) via Constellation
async function getBacklinks(
	did: string
): Promise<Array<{ src_did: string; collection: string; path: string }>> {
	const params = new URLSearchParams({ subject: did, limit: '200' })
	const res = await fetch(`${CONSTELLATION_BASE}/blue.microcosm.links.getBacklinks?${params}`, {
		headers: { 'User-Agent': UA }
	})
	if (!res.ok) {
		console.warn(`Constellation backlinks failed: ${res.status}`)
		return []
	}
	const data = await res.json()
	return data.links ?? []
}

async function getProfiles(dids: string[]): Promise<ProfileInfo[]> {
	const batches: string[][] = []
	for (let i = 0; i < dids.length; i += 25) {
		batches.push(dids.slice(i, i + 25))
	}

	const results = await Promise.all(
		batches.map(async (batch) => {
			const params = new URLSearchParams()
			batch.forEach((d) => params.append('actors[]', d))
			const res = await fetch(`${BSKY_BASE}/app.bsky.actor.getProfiles?${params}`)
			if (!res.ok) return []
			const data = await res.json()
			return (data.profiles ?? []).map((p: Record<string, unknown>) => ({
				did: p.did as string,
				handle: p.handle as string,
				displayName: (p.displayName as string) ?? '',
				avatarUrl: (p.avatar as string) ?? ''
			}))
		})
	)

	return results.flat()
}

function addCount(map: Map<string, NodeData>, did: string, kind: Kind, dir: 'actor' | 'target') {
	if (!map.has(did)) map.set(did, emptyNode(did))
	const node = map.get(did)!
	node.counts[kind]++
	if (node.direction !== dir) node.direction = 'both'
}

function computeScore(counts: NodeData['counts']): number {
	return Object.entries(counts).reduce((sum, [k, v]) => sum + v * WEIGHTS[k as Kind], 0)
}

export async function fetchGraphData(handle: string): Promise<{
	nodes: NodeData[]
	selfDid: string
	selfProfile: ProfileInfo
}> {
	const selfDid = await resolveHandle(handle)
	const selfProfile = await getProfile(selfDid)

	// Parallel fetch: outgoing (actor) actions + incoming (target) backlinks
	const [likeDids, followDids, repostDids, backlinks] = await Promise.all([
		getActorLikes(selfDid),
		getActorFollows(selfDid),
		getActorReposts(selfDid),
		getBacklinks(selfDid)
	])

	const nodeMap = new Map<string, NodeData>()

	for (const did of likeDids) addCount(nodeMap, did, 'like', 'actor')
	for (const did of followDids) addCount(nodeMap, did, 'follow', 'actor')
	for (const did of repostDids) addCount(nodeMap, did, 'repost', 'actor')

	// Incoming: what others did to the actor
	for (const link of backlinks) {
		const did = link.src_did
		if (!did || did === selfDid) continue
		let kind: Kind | null = null
		if (link.collection === 'app.bsky.feed.like') kind = 'like'
		else if (link.collection === 'app.bsky.feed.repost') kind = 'repost'
		else if (link.collection === 'app.bsky.graph.follow') kind = 'follow'
		else if (link.collection === 'app.bsky.feed.post') {
			if (link.path?.includes('reply.parent')) kind = 'reply'
			else if (link.path?.includes('embed.record')) kind = 'quote'
		}
		if (kind) addCount(nodeMap, did, kind, 'target')
	}

	// Compute total scores
	for (const node of nodeMap.values()) {
		node.totalScore = computeScore(node.counts)
	}

	// Sort by score and take top 100
	const sorted = [...nodeMap.values()].sort((a, b) => b.totalScore - a.totalScore).slice(0, 100)

	// Resolve profiles
	const profiles = await getProfiles(sorted.map((n) => n.did))
	const profileMap = new Map(profiles.map((p) => [p.did, p]))

	for (const node of sorted) {
		const p = profileMap.get(node.did)
		if (p) {
			node.handle = p.handle
			node.displayName = p.displayName
			node.avatarUrl = p.avatarUrl
		}
	}

	return { nodes: sorted, selfDid, selfProfile }
}
