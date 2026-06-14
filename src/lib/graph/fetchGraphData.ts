import { extractDid } from './atUriUtils'
import type { NodeData } from '$lib/types'

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'
const CONSTELLATION_BASE = 'https://constellation.microcosm.blue/xrpc'
const UA = 'cho-hirogaru-bluesky/suibari-cha.bsky.social'
const PAGE_LIMIT = 100
const MAX_PAGES = 3
// 自分の投稿のうち、バックリンクを取得する最大件数（多いほど詳細だが遅くなる）
const MAX_POSTS_FOR_BACKLINKS = 20

// ---- スコア重み（ここを変えると全体のスコア計算に反映される） ----
// follow はデータとして記録するがスコアには含めない
const WEIGHTS = {
	like:    1,
	repost:  5,
	reply:   10,
	quote:   10,
	mention: 10
} as const
// ---------------------------------------------------------------
type ScoredKind = keyof typeof WEIGHTS
type InteractionKind = ScoredKind | 'follow'

export type ProfileInfo = {
	did: string
	handle: string
	displayName: string
	avatarUrl: string
}

type Record = { uri: string; value: Record_value }
type Record_value = { [key: string]: unknown }

const ZERO_COUNTS = () => ({
	like: 0, repost: 0, reply: 0, quote: 0, mention: 0, follow: 0
})

function emptyNode(did: string): NodeData {
	return {
		did,
		handle: did,
		displayName: '',
		avatarUrl: '',
		actorCounts: ZERO_COUNTS(),
		targetCounts: ZERO_COUNTS(),
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

async function resolvePds(did: string): Promise<string> {
	let didDocUrl: string
	if (did.startsWith('did:plc:')) {
		didDocUrl = `https://plc.directory/${encodeURIComponent(did)}`
	} else if (did.startsWith('did:web:')) {
		const hostname = did.slice('did:web:'.length)
		didDocUrl = `https://${hostname}/.well-known/did.json`
	} else {
		throw new Error(`Unsupported DID method: ${did}`)
	}
	const res = await fetch(didDocUrl)
	if (!res.ok) throw new Error(`DIDドキュメントの取得に失敗しました (${res.status})`)
	const doc = await res.json()
	const pds = (doc.service as Array<{ id: string; serviceEndpoint: string }> | undefined)?.find(
		(s) => s.id === '#atproto_pds'
	)
	if (!pds?.serviceEndpoint) throw new Error('PDSが見つかりませんでした')
	return pds.serviceEndpoint
}

async function listAllRecords(pdsUrl: string, did: string, collection: string): Promise<Record[]> {
	const records: Record[] = []
	let cursor: string | undefined
	let pages = 0
	do {
		const params = new URLSearchParams({ repo: did, collection, limit: String(PAGE_LIMIT) })
		if (cursor) params.set('cursor', cursor)
		const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`)
		if (!res.ok) break
		const data = await res.json()
		for (const r of data.records ?? []) {
			records.push({ uri: r.uri as string, value: r.value as Record_value })
		}
		cursor = data.cursor
		pages++
	} while (cursor && pages < MAX_PAGES)
	return records
}

// Query Constellation for a single post URI + source combination
async function queryConstellation(
	postUri: string,
	source: string,
	kind: InteractionKind
): Promise<Array<{ src_did: string; kind: InteractionKind }>> {
	const params = new URLSearchParams({
		subject: postUri,
		source,
		limit: '100'
	})
	const url = `${CONSTELLATION_BASE}/blue.microcosm.links.getBacklinks?${params}`
	const res = await fetch(url, { headers: { 'User-Agent': UA } })
	if (!res.ok) return []
	const data = await res.json()
	return (data.records ?? [])
		.map((l: { did?: string }) => ({ src_did: l.did ?? '', kind }))
		.filter((e: { src_did: string }) => e.src_did)
}

// Get followers via Constellation (follow records link to DIDs directly)
async function getFollowers(did: string): Promise<string[]> {
	const params = new URLSearchParams({
		subject: encodeURIComponent(did),
		source: 'app.bsky.graph.follow:subject',
		limit: '200'
	})
	const res = await fetch(`${CONSTELLATION_BASE}/blue.microcosm.links.getBacklinks?${params}`, {
		headers: { 'User-Agent': UA }
	})
	if (!res.ok) {
		console.warn(`Constellation getFollowers failed: ${res.status}`)
		return []
	}
	const data = await res.json()
	return (data.records ?? [])
		.map((l: { did?: string }) => l.did)
		.filter((d: string | undefined): d is string => !!d && d !== did)
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
			return (data.profiles ?? []).map((p: { [k: string]: unknown }) => ({
				did: p.did as string,
				handle: p.handle as string,
				displayName: (p.displayName as string) ?? '',
				avatarUrl: (p.avatar as string) ?? ''
			}))
		})
	)
	return results.flat()
}

function addCount(
	map: Map<string, NodeData>,
	did: string,
	kind: InteractionKind,
	dir: 'actor' | 'target'
) {
	if (!map.has(did)) map.set(did, emptyNode(did))
	const node = map.get(did)!
	if (dir === 'actor') node.actorCounts[kind]++
	else node.targetCounts[kind]++
	if (node.direction !== dir) node.direction = 'both'
}

function computeScore(node: NodeData): number {
	return (Object.keys(WEIGHTS) as ScoredKind[]).reduce(
		(sum, k) => sum + (node.actorCounts[k] + node.targetCounts[k]) * WEIGHTS[k],
		0
	)
}

export async function fetchGraphData(handle: string): Promise<{
	nodes: NodeData[]
	selfDid: string
	selfProfile: ProfileInfo
}> {
	const selfDid = await resolveHandle(handle)
	const [selfProfile, pdsUrl] = await Promise.all([getProfile(selfDid), resolvePds(selfDid)])

	// 自分のアクション（outgoing）+ フォロワー取得
	const [likeRecords, repostRecords, followRecords, postRecords, followerDids] = await Promise.all([
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.like'),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.repost'),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.graph.follow'),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.post'),
		getFollowers(selfDid)
	])

	const nodeMap = new Map<string, NodeData>()

	// 自分がいいねした投稿の著者
	for (const r of likeRecords) {
		const uri = (r.value as { subject?: { uri?: string } }).subject?.uri
		if (!uri) continue
		const did = extractDid(uri)
		if (did && did !== selfDid) addCount(nodeMap, did, 'like', 'actor')
	}

	// 自分がリポストした投稿の著者
	for (const r of repostRecords) {
		const uri = (r.value as { subject?: { uri?: string } }).subject?.uri
		if (!uri) continue
		const did = extractDid(uri)
		if (did && did !== selfDid) addCount(nodeMap, did, 'repost', 'actor')
	}

	// 自分がフォローしているユーザー
	for (const r of followRecords) {
		const subject = (r.value as { subject?: string }).subject
		if (subject && subject !== selfDid) addCount(nodeMap, subject, 'follow', 'actor')
	}

	// 自分をフォローしているユーザー（Constellation経由）
	for (const did of followerDids) {
		addCount(nodeMap, did, 'follow', 'target')
	}

	// 自分の投稿への like/repost/reply を Constellation でバッチ取得
	// リプライを除いた投稿を対象にする
	const ownPostUris = postRecords
		.filter((r) => !(r.value as { reply?: unknown }).reply)
		.slice(0, MAX_POSTS_FOR_BACKLINKS)
		.map((r) => r.uri)

	if (ownPostUris.length > 0) {
		// 各投稿 × 3種類のソースを並列クエリ
		const allPostInteractions = await Promise.all(
			ownPostUris.flatMap((uri) => [
				queryConstellation(uri, 'app.bsky.feed.like:subject.uri', 'like'),
				queryConstellation(uri, 'app.bsky.feed.repost:subject.uri', 'repost'),
				queryConstellation(uri, 'app.bsky.feed.post:reply.parent.uri', 'reply')
			])
		)

		for (const interactions of allPostInteractions) {
			for (const { src_did, kind } of interactions) {
				if (src_did !== selfDid) addCount(nodeMap, src_did, kind, 'target')
			}
		}
	}

	// スコア計算（follow は WEIGHTS に含まれないため自動的に除外）
	for (const node of nodeMap.values()) {
		node.totalScore = computeScore(node)
	}

	// スコア上位100件を取得
	const sorted = [...nodeMap.values()].sort((a, b) => b.totalScore - a.totalScore).slice(0, 100)

	// プロフィール解決
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
