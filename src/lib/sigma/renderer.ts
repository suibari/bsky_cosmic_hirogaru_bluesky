import Sigma from 'sigma'
import { animateNodes } from 'sigma/utils'
import Graph from 'graphology'
import { createNodeImageProgram } from '@sigma/node-image'
import { startCosmicLayout, type FA2Instance } from '$lib/graph/cosmicLayout'
import { computeHirogaruPositions } from '$lib/graph/hirogaruLayout'
import type { NodeData, GraphMode, GraphNodeAttributes, GraphEdgeAttributes } from '$lib/types'

// Use default Sigma type to avoid variance conflicts with NodeImageProgram generics
// The graph itself is still strongly typed via GraphInstance
type SigmaInstance = Sigma
type GraphInstance = Graph<GraphNodeAttributes, GraphEdgeAttributes>

function nodeSize(score: number): number {
	return Math.max(8, Math.min(30, 8 + Math.log1p(score) * 3))
}

function edgeColor(score: number, max: number): string {
	const t = max > 0 ? score / max : 0
	const r = Math.round(30 + t * 80)
	const g = Math.round(60 + t * 120)
	const b = Math.round(100 + t * 155)
	return `rgb(${r},${g},${b})`
}

export class SigmaController {
	sigma: SigmaInstance
	graph: GraphInstance
	private fa2: FA2Instance | null = null
	private selfDid: string
	private currentMode: GraphMode = 'cosmic'

	constructor(sigma: SigmaInstance, graph: GraphInstance, selfDid: string) {
		this.sigma = sigma
		this.graph = graph
		this.selfDid = selfDid
	}

	startInitialLayout(): void {
		this.fa2 = startCosmicLayout(this.graph)
	}

	setMode(mode: GraphMode): void {
		if (mode === this.currentMode) return
		this.currentMode = mode

		if (mode === 'cosmic') {
			this.sigma.setSetting('edgeReducer', null)
			this.fa2 = startCosmicLayout(this.graph)
		} else {
			if (this.fa2) {
				this.fa2.stop()
				this.fa2 = null
			}
			this.sigma.setSetting('edgeReducer', (_e, data) => ({ ...data, hidden: true }))
			const targets = computeHirogaruPositions(this.graph, this.selfDid)
			animateNodes(this.graph, targets, { duration: 800, easing: 'cubicInOut' })
		}
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
		counts: { like: 0, repost: 0, reply: 0, quote: 0, follow: 0 },
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

	for (const node of nodes) {
		const angle = Math.random() * Math.PI * 2
		const r = (Math.random() * 0.5 + 0.5) * 5
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

	const controller = new SigmaController(sigma, graph, selfDid)
	controller.startInitialLayout()

	return controller
}
