import Sigma from 'sigma'
import { animateNodes } from 'sigma/utils'
import Graph from 'graphology'
import { createNodeImageProgram } from '@sigma/node-image'
import { startCosmicLayout, type FA2Instance } from '$lib/graph/cosmicLayout'
import { computeHirogaruPositions } from '$lib/graph/hirogaruLayout'
import type { NodeData, GraphMode, GraphNodeAttributes, GraphEdgeAttributes } from '$lib/types'

// Use default Sigma type to avoid variance conflicts with NodeImageProgram generics
type SigmaInstance = Sigma
type GraphInstance = Graph<GraphNodeAttributes, GraphEdgeAttributes>

function nodeSize(score: number): number {
	return Math.max(8, Math.min(30, 8 + Math.log1p(score) * 3))
}

function edgeColor(score: number, max: number): string {
	const logT = max > 0 ? Math.sqrt(Math.log1p(score) / Math.log1p(max)) : 0
	const r = Math.round(30 + logT * 80)
	const g = Math.round(60 + logT * 120)
	const b = Math.round(100 + logT * 155)
	return `rgb(${r},${g},${b})`
}

export class SigmaController {
	sigma: SigmaInstance
	graph: GraphInstance
	totalNodeCount: number
	private fa2: FA2Instance | null = null
	private selfDid: string
	private currentMode: GraphMode = 'cosmic'

	constructor(sigma: SigmaInstance, graph: GraphInstance, selfDid: string, totalNodeCount: number) {
		this.sigma = sigma
		this.graph = graph
		this.selfDid = selfDid
		this.totalNodeCount = totalNodeCount
	}

	startInitialLayout(): void {
		this.fa2 = startCosmicLayout(this.graph, () => this._snapToScoreRadius())
	}

	// After FA2 distributes nodes angularly, snap each node's radius to reflect score.
	// High score → close to center, low score → far.
	private _snapToScoreRadius(): void {
		// Sort by score so the golden-angle spiral places high-score nodes first.
		const others = this.graph
			.nodes()
			.filter((n) => n !== this.selfDid)
			.sort(
				(a, b) =>
					this.graph.getNodeAttribute(b, 'nodeData').totalScore -
					this.graph.getNodeAttribute(a, 'nodeData').totalScore
			)

		const maxScore =
			others.length > 0
				? this.graph.getNodeAttribute(others[0], 'nodeData').totalScore
				: 0

		const positions: Record<string, { x: number; y: number }> = {}
		positions[this.selfDid] = { x: 0, y: 0 }

		const logMax = Math.log1p(maxScore)
		// Golden angle ≈ 137.5° — the mathematically optimal angle for distributing
		// points uniformly around a circle with no angular clustering.
		const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

		others.forEach((node, i) => {
			const score = this.graph.getNodeAttribute(node, 'nodeData').totalScore
			// sqrt(log1p) normalization: spreads low scores outward, compresses high scores
			const logT = logMax > 0 ? Math.sqrt(Math.log1p(score) / logMax) : 0
			const r = 2 + (1 - logT) * 14
			// Golden angle spiral + small random jitter for organic look
			const angle = i * GOLDEN_ANGLE + (Math.random() - 0.5) * 0.3
			positions[node] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
		})

		animateNodes(this.graph, positions, { duration: 1200, easing: 'cubicInOut' })
	}

	// When mode changes to 'hirogaru', displayCount controls how many nodes are shown.
	// When called with the same mode (e.g. hirogaru→hirogaru), only display count updates.
	setMode(mode: GraphMode, displayCount?: number): void {
		const modeChanged = mode !== this.currentMode

		if (modeChanged) {
			this.currentMode = mode

			if (mode === 'cosmic') {
				// Unhide all nodes before restarting FA2
				for (const node of this.graph.nodes()) {
					this.graph.removeNodeAttribute(node, 'hidden')
				}
				this.sigma.setSetting('edgeReducer', null)
				this.fa2 = startCosmicLayout(this.graph, () => this._snapToScoreRadius())
				return
			} else {
				if (this.fa2) {
					this.fa2.stop()
					this.fa2 = null
				}
				this.sigma.setSetting('edgeReducer', (_e, data) => ({ ...data, hidden: true }))
			}
		}

		if (mode === 'hirogaru') {
			const count = displayCount ?? this.totalNodeCount
			this._applyHirogaru(count, modeChanged ? 800 : 300)
		}
	}

	private _applyHirogaru(count: number, duration: number): void {
		const orderedNodes = this.graph
			.nodes()
			.filter((n) => n !== this.selfDid)
			.sort(
				(a, b) =>
					this.graph.getNodeAttribute(b, 'nodeData').totalScore -
					this.graph.getNodeAttribute(a, 'nodeData').totalScore
			)

		for (let i = 0; i < orderedNodes.length; i++) {
			if (i < count) {
				this.graph.removeNodeAttribute(orderedNodes[i], 'hidden')
			} else {
				this.graph.setNodeAttribute(orderedNodes[i], 'hidden', true)
			}
		}

		const targets = computeHirogaruPositions(this.graph, this.selfDid, count)
		animateNodes(this.graph, targets, { duration, easing: 'cubicInOut' })
	}

	getNodeData(nodeId: string): NodeData {
		return this.graph.getNodeAttribute(nodeId, 'nodeData')
	}

	kill(): void {
		if (this.fa2) {
			this.fa2.kill()
			this.fa2 = null
		}
		this.sigma.kill()
	}
}

export function initSigma(
	container: HTMLElement,
	nodes: NodeData[],
	selfDid: string,
	selfProfile: { handle: string; displayName: string; avatarUrl: string }
): SigmaController {
	const graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes>()

	const maxScore = nodes.length > 0 ? nodes[0].totalScore : 1

	const selfNodeData: NodeData = {
		did: selfDid,
		handle: selfProfile.handle,
		displayName: selfProfile.displayName,
		avatarUrl: selfProfile.avatarUrl,
		actorCounts: { like: 0, repost: 0, reply: 0, quote: 0, mention: 0, follow: 0 },
		targetCounts: { like: 0, repost: 0, reply: 0, quote: 0, mention: 0, follow: 0 },
		totalScore: 0,
		direction: 'actor'
	}

	graph.addNode(selfDid, {
		x: 0,
		y: 0,
		size: 40,
		label: selfProfile.displayName || selfProfile.handle,
		type: 'image',
		image: selfProfile.avatarUrl
			? `/api/proxy/avatar?url=${encodeURIComponent(selfProfile.avatarUrl)}`
			: '',
		color: '#4a9eff',
		fixed: true,
		nodeData: selfNodeData
	})

	for (const [i, node] of nodes.entries()) {
		// Uniform start radius: FA2 distributes nodes angularly, then _snapToScoreRadius
		// animates them to score-based radii after FA2 stops.
		// Small angle jitter breaks symmetry to prevent synchronized oscillation.
		const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
		const r = 8

		graph.addNode(node.did, {
			x: Math.cos(angle) * r,
			y: Math.sin(angle) * r,
			size: nodeSize(node.totalScore),
			label: node.displayName || node.handle,
			type: 'image',
			image: node.avatarUrl
				? `/api/proxy/avatar?url=${encodeURIComponent(node.avatarUrl)}`
				: '',
			color: '#888888',
			fixed: false,
			nodeData: node
		})
		graph.addEdge(selfDid, node.did, {
			weight: node.totalScore,
			color: edgeColor(node.totalScore, maxScore),
			hidden: false
		})
	}

	const NodeImageProgram = createNodeImageProgram()

	const sigma = new Sigma(graph as any, container, {
		nodeProgramClasses: { image: NodeImageProgram },
		nodeHoverProgramClasses: { image: NodeImageProgram },
		defaultNodeType: 'image',
		defaultEdgeType: 'line',
		renderEdgeLabels: false,
		labelFont: 'system-ui, sans-serif',
		labelSize: 12,
		labelColor: { color: '#ffffff' }
	})

	const controller = new SigmaController(sigma, graph, selfDid, nodes.length)
	controller.startInitialLayout()

	return controller
}
