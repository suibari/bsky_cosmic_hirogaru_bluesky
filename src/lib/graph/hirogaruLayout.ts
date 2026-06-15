import type Graph from 'graphology'
import type { GraphNodeAttributes } from '$lib/types'

const RING_SPACING = 2.5
const MIN_NODE_SPACING = 2.0
const BASE_NODE_SIZE = 14

export function computeHirogaruPositions(
	graph: Graph<GraphNodeAttributes>,
	selfDid: string,
	displayCount?: number,
	nodeSize: number = BASE_NODE_SIZE
): Record<string, { x: number; y: number }> {
	const positions: Record<string, { x: number; y: number }> = {}
	positions[selfDid] = { x: 0, y: 0 }

	const allOthers = graph
		.nodes()
		.filter((n) => n !== selfDid)
		.sort(
			(a, b) =>
				graph.getNodeAttribute(b, 'nodeData').totalScore -
				graph.getNodeAttribute(a, 'nodeData').totalScore
		)

	const others = displayCount !== undefined ? allOthers.slice(0, displayCount) : allOthers
	if (others.length === 0) return positions

	// Place in concentric rings, equal angular spacing per ring.
	// Ring capacity grows with radius so node density stays roughly uniform.
	let nodeIndex = 0
	let ring = 1

	while (nodeIndex < others.length) {
		const radius = ring * RING_SPACING
		const effectiveSpacing = MIN_NODE_SPACING * (nodeSize / BASE_NODE_SIZE)
		const capacity = Math.max(6, Math.floor((Math.PI * 2 * radius) / effectiveSpacing))
		const inThisRing = Math.min(capacity, others.length - nodeIndex)

		for (let i = 0; i < inThisRing; i++) {
			// Start from top (−π/2) so the highest-score node sits at 12 o'clock
			const angle = (i / capacity) * Math.PI * 2 - Math.PI / 2
			positions[others[nodeIndex]] = {
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius
			}
			nodeIndex++
		}
		ring++
	}

	return positions
}
