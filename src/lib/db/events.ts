import { dbFetch } from './client'
import type { EventRecord } from '$lib/types'

export type { EventRecord }

export async function insertEvents(events: EventRecord[]): Promise<void> {
	if (events.length === 0) return

	const res = await dbFetch('/events', {
		method: 'POST',
		headers: {
			'Prefer': 'resolution=ignore-duplicates,return=minimal',
		},
		body: JSON.stringify(events),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`insertEvents failed: ${res.status} ${text}`)
	}
}

export async function fetchEventsByDid(did: string): Promise<EventRecord[]> {
	const params = new URLSearchParams({
		or:    `(actor_did.eq.${did},target_did.eq.${did})`,
		order: 'created_at.desc',
		limit: '500',
	})

	const res = await dbFetch(`/events?${params}`, {
		headers: { 'Accept': 'application/json' },
	})

	if (!res.ok) {
		throw new Error(`fetchEventsByDid failed: ${res.status}`)
	}

	return res.json()
}

export async function registerTrackedDid(did: string): Promise<void> {
	const res = await dbFetch('/tracked_dids', {
		method: 'POST',
		headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
		body: JSON.stringify({ did, last_accessed_at: new Date().toISOString() }),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`registerTrackedDid failed: ${res.status} ${text}`)
	}
}

export async function hasEventsForDid(did: string): Promise<boolean> {
	const params = new URLSearchParams({
		or:     `(actor_did.eq.${did},target_did.eq.${did})`,
		limit:  '1',
		select: 'id',
	})

	const res = await dbFetch(`/events?${params}`, {
		headers: { 'Accept': 'application/json' },
	})

	if (!res.ok) return false

	const rows = await res.json()
	return rows.length > 0
}
