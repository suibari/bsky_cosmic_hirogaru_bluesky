import { dbFetch, type DbEnv } from './client'
import type { EventRecord } from '$lib/types'

export type { EventRecord }

export async function insertEvents(events: EventRecord[], env: DbEnv): Promise<void> {
	if (events.length === 0) return

	// PostgREST の on_conflict 列指定は DEFERRABLE/部分インデックスに対応しないため、
	// RPC 関数経由で ON CONFLICT ON CONSTRAINT events_uq DO NOTHING を使う。
	const res = await dbFetch('/rpc/upsert_events', env, {
		method: 'POST',
		body: JSON.stringify({ events }),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`insertEvents failed: ${res.status} ${text}`)
	}
}

export async function fetchEventsByDid(did: string, env: DbEnv): Promise<EventRecord[]> {
	// URLSearchParams は DID の : を %3A にエンコードするため直接展開する (isTrackedDid と同様)
	const res = await dbFetch(
		`/events?or=(actor_did.eq.${did},target_did.eq.${did})&order=created_at.desc`,
		env,
		{ headers: { 'Accept': 'application/json' } },
	)

	if (!res.ok) {
		throw new Error(`fetchEventsByDid failed: ${res.status}`)
	}

	return res.json()
}

export async function registerTrackedDid(did: string, env: DbEnv): Promise<void> {
	const res = await dbFetch('/tracked_dids', env, {
		method: 'POST',
		headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
		body: JSON.stringify({ did, last_accessed_at: new Date().toISOString() }),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`registerTrackedDid failed: ${res.status} ${text}`)
	}
}

export async function isTrackedDid(did: string, env: DbEnv): Promise<boolean> {
	// URLSearchParams encodes colons in DID values (%3A), which PostgREST may not decode
	const res = await dbFetch(`/tracked_dids?did=eq.${did}&select=did&limit=1`, env, {
		headers: { 'Accept': 'application/json' },
	})

	if (!res.ok) return false

	const rows = await res.json()
	return rows.length > 0
}
