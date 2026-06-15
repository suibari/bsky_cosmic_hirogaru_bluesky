import type Graph from 'graphology'
import type { GraphNodeAttributes } from '$lib/types'

export const BASE_NODE_SIZE = 14
const SELF_RADIUS = 20 // fixed radius of the self-node in graph coords (positions mode)
const GAP = 4          // fixed edge-to-edge gap between any two adjacent nodes

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

	// spacing = node diameter + gap (center-to-center distance that gives edge-to-edge gap = GAP)
	const spacing = nodeSize + GAP
	// R₁: first ring center = self radius + gap + node radius
	const R1 = SELF_RADIUS + GAP + nodeSize / 2

	let nodeIndex = 0
	let ring = 1

	while (nodeIndex < others.length) {
		const Rn = R1 + (ring - 1) * spacing
		const capacity = Math.max(6, Math.floor((2 * Math.PI * Rn) / spacing))
		const inThisRing = Math.min(capacity, others.length - nodeIndex)

		for (let i = 0; i < inThisRing; i++) {
			const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2
			positions[others[nodeIndex]] = {
				x: Math.cos(angle) * Rn,
				y: Math.sin(angle) * Rn
			}
			nodeIndex++
		}
		ring++
	}

	return positions
}
