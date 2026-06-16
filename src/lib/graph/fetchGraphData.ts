import { extractDid } from './atUriUtils'
import type { NodeData, EventRecord } from '$lib/types'

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'
const CONSTELLATION_BASE = 'https://constellation.microcosm.blue/xrpc'
const UA = 'cho-hirogaru-bluesky/suibari-cha.bsky.social'
const PAGE_LIMIT = 100
const MAX_PAGES = 3
// 自分の投稿のうち、バックリンクを取得する最大件数（多いほど詳細だが遅くなる）
// CF Workers サブリクエスト上限 50/req に収まるよう調整:
// resolveHandle(1)+isTrackedDid(1)+registerTrackedDid(1)+resolvePds(1)+listRecords(12)+getFollowers(1)
// +backlinks(N×3)+getProfile(1)+getProfiles(4) ≤ 50 → N ≤ (50-22)/3 = 9.3 → N=9（合計最大49）
const MAX_POSTS_FOR_BACKLINKS = 9

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
		targetScore: 0,
		direction: 'actor'
	}
}

// AT Protocol TID (base32-sortable) encodes microseconds since epoch in the high 54 bits.
// Decoding the rkey gives the actual record creation time without extra API calls.
const TID_ALPHA = '234567abcdefghijklmnopqrstuvwxyz'
function tidToIso(rkey: string): string | null {
	try {
		let n = 0n
		for (const c of rkey) {
			const i = TID_ALPHA.indexOf(c)
			if (i < 0) return null
			n = n * 32n + BigInt(i)
		}
		const ms = Number(n >> 10n) / 1000  // microseconds → milliseconds
		return new Date(ms).toISOString()
	} catch {
		return null
	}
}

export async function resolveHandle(handle: string): Promise<string> {
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

async function listAllRecords(pdsUrl: string, did: string, collection: string, maxPages = MAX_PAGES): Promise<Record[]> {
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
	} while (cursor && pages < maxPages)
	return records
}

async function queryConstellation(
	postUri: string,
	source: string,
	kind: InteractionKind
): Promise<Array<{ src_did: string; kind: InteractionKind; created_at: string }>> {
	const now = new Date().toISOString()
	const params = new URLSearchParams({ subject: postUri, source, limit: '100' })
	const url = `${CONSTELLATION_BASE}/blue.microcosm.links.getBacklinks?${params}`
	const res = await fetch(url, { headers: { 'User-Agent': UA } })
	if (!res.ok) return []
	const data = await res.json()
	return (data.records ?? [])
		.map((l: { did?: string; rkey?: string; created_at?: string }) => ({
			src_did: l.did ?? '',
			kind,
			created_at: tidToIso(l.rkey ?? '') ?? l.created_at ?? now
		}))
		.filter((e: { src_did: string }) => e.src_did)
}

async function getFollowers(did: string): Promise<Array<{ did: string; created_at: string }>> {
	const now = new Date().toISOString()
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
		.map((l: { did?: string; rkey?: string; created_at?: string }) => ({
			did: l.did ?? '',
			created_at: tidToIso(l.rkey ?? '') ?? l.created_at ?? now
		}))
		.filter((e: { did: string }) => e.did && e.did !== did)
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

function computeTargetScore(node: NodeData): number {
	return (Object.keys(WEIGHTS) as ScoredKind[]).reduce(
		(sum, k) => sum + node.targetCounts[k] * WEIGHTS[k],
		0
	)
}

export function buildNodesFromEventsSync(
	selfDid: string,
	events: EventRecord[],
	profileCache: Map<string, ProfileInfo>
): NodeData[] {
	const nodeMap = new Map<string, NodeData>()

	for (const event of events) {
		if (event.actor_did === selfDid && event.target_did !== selfDid) {
			addCount(nodeMap, event.target_did, event.kind as InteractionKind, 'actor')
		}
		if (event.target_did === selfDid && event.actor_did !== selfDid) {
			addCount(nodeMap, event.actor_did, event.kind as InteractionKind, 'target')
		}
	}

	for (const node of nodeMap.values()) {
		node.totalScore = computeScore(node)
		node.targetScore = computeTargetScore(node)
		const profile = profileCache.get(node.did)
		if (profile) {
			node.handle = profile.handle
			node.displayName = profile.displayName
			node.avatarUrl = profile.avatarUrl
		}
	}

	return [...nodeMap.values()].sort((a, b) => b.totalScore - a.totalScore)
}

export async function fetchRawEvents(selfDid: string): Promise<EventRecord[]> {
	const pdsUrl = await resolvePds(selfDid)
	const now = new Date().toISOString()

	// CF Workers サブリクエスト上限 50/req のため、ページ合計数を変えられない。
	// 消費内訳: resolvePds(1) + listRecords合計ページ(12) + getFollowers(1)
	//          + backlinks(10×3=30) + getProfile(1) + getProfiles(4) = 49
	// ページ配分: like(1)+repost(3)+follow(1)+post(7) = 12ページ固定
	const [likeRecords, repostRecords, followRecords, postRecords, followerResults] = await Promise.all([
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.like', 1),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.repost', 3),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.graph.follow', 1),
		listAllRecords(pdsUrl, selfDid, 'app.bsky.feed.post', 7),
		getFollowers(selfDid)
	])

	const events: EventRecord[] = []

	for (const r of likeRecords) {
		const uri = (r.value as { subject?: { uri?: string } }).subject?.uri
		if (!uri) continue
		const did = extractDid(uri)
		if (did && did !== selfDid) events.push({
			actor_did: selfDid,
			target_did: did,
			kind: 'like',
			rkey: r.uri.split('/').at(-1) ?? null,
			created_at: (r.value as { createdAt?: string }).createdAt ?? now
		})
	}

	for (const r of repostRecords) {
		const uri = (r.value as { subject?: { uri?: string } }).subject?.uri
		if (!uri) continue
		const did = extractDid(uri)
		if (did && did !== selfDid) events.push({
			actor_did: selfDid,
			target_did: did,
			kind: 'repost',
			rkey: r.uri.split('/').at(-1) ?? null,
			created_at: (r.value as { createdAt?: string }).createdAt ?? now
		})
	}

	for (const r of postRecords) {
		const parentUri = (r.value as { reply?: { parent?: { uri?: string } } }).reply?.parent?.uri
		if (!parentUri) continue
		const did = extractDid(parentUri)
		if (did && did !== selfDid) events.push({
			actor_did: selfDid,
			target_did: did,
			kind: 'reply',
			rkey: r.uri.split('/').at(-1) ?? null,
			created_at: (r.value as { createdAt?: string }).createdAt ?? now
		})
	}

	for (const r of followRecords) {
		const subject = (r.value as { subject?: string }).subject
		if (subject && subject !== selfDid) events.push({
			actor_did: selfDid,
			target_did: subject,
			kind: 'follow',
			rkey: r.uri.split('/').at(-1) ?? null,
			created_at: (r.value as { createdAt?: string }).createdAt ?? now
		})
	}

	for (const { did, created_at } of followerResults) {
		events.push({
			actor_did: did,
			target_did: selfDid,
			kind: 'follow',
			rkey: null,
			created_at
		})
	}

	const ownPostUris = postRecords
		.filter((r) => !(r.value as { reply?: unknown }).reply)
		.slice(0, MAX_POSTS_FOR_BACKLINKS)
		.map((r) => r.uri)

	if (ownPostUris.length > 0) {
		const allPostInteractions = await Promise.all(
			ownPostUris.flatMap((uri) => [
				queryConstellation(uri, 'app.bsky.feed.like:subject.uri', 'like'),
				queryConstellation(uri, 'app.bsky.feed.repost:subject.uri', 'repost'),
				queryConstellation(uri, 'app.bsky.feed.post:reply.parent.uri', 'reply')
			])
		)

		for (const interactions of allPostInteractions) {
			for (const { src_did, kind, created_at } of interactions) {
				if (src_did !== selfDid) events.push({
					actor_did: src_did,
					target_did: selfDid,
					kind,
					rkey: null,
					created_at
				})
			}
		}
	}

	return events
}

export async function buildGraphDataFromEvents(
	selfDid: string,
	events: EventRecord[]
): Promise<{ nodes: NodeData[]; selfDid: string; selfProfile: ProfileInfo }> {
	const selfProfile = await getProfile(selfDid).catch(() => ({
		did: selfDid,
		handle: selfDid,
		displayName: '',
		avatarUrl: ''
	}))
	const nodeMap = new Map<string, NodeData>()

	for (const event of events) {
		if (event.actor_did === selfDid && event.target_did !== selfDid) {
			addCount(nodeMap, event.target_did, event.kind as InteractionKind, 'actor')
		}
		if (event.target_did === selfDid && event.actor_did !== selfDid) {
			addCount(nodeMap, event.actor_did, event.kind as InteractionKind, 'target')
		}
	}

	for (const node of nodeMap.values()) {
		node.totalScore = computeScore(node)
		node.targetScore = computeTargetScore(node)
	}

	const sorted = [...nodeMap.values()].sort((a, b) => b.totalScore - a.totalScore).slice(0, 100)

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
