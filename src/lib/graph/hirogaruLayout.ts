import type Graph from 'graphology'
import type { GraphNodeAttributes } from '$lib/types'

export function computeHirogaruPositions(
	graph: Graph<GraphNodeAttributes>,
	selfDid: string
): Record<string, { x: number; y: number }> {
	const positions: Record<string, { x: number; y: number }> = {}
	positions[selfDid] = { x: 0, y: 0 }

	const others = graph
		.nodes()
		.filter((n) => n !== selfDid)
		.sort(
			(a, b) =>
				graph.getNodeAttribute(b, 'nodeData').totalScore -
				graph.getNodeAttribute(a, 'nodeData').totalScore
		)

	if (others.length === 0) return positions

	const maxScore = graph.getNodeAttribute(others[0], 'nodeData').totalScore
	const minScore = graph.getNodeAttribute(others[others.length - 1], 'nodeData').totalScore

	others.forEach((node, i) => {
		const score = graph.getNodeAttribute(node, 'nodeData').totalScore
		const t = maxScore === minScore ? 0.5 : (score - minScore) / (maxScore - minScore)
		// High score → small radius (close to center). Range: 1 to 10
		const radius = 1 + (1 - t) * 9
		const angle = (i / others.length) * Math.PI * 2
		positions[node] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
	})

	return positions
}
