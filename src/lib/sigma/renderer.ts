import Sigma from 'sigma'
import { animateNodes } from 'sigma/utils'
import Graph from 'graphology'
import { createNodeImageProgram } from '@sigma/node-image'
import { computeHirogaruPositions, BASE_NODE_SIZE } from '$lib/graph/hirogaruLayout'
import type { NodeData, GraphMode, GraphNodeAttributes, GraphEdgeAttributes } from '$lib/types'

// Use default Sigma type to avoid variance conflicts with NodeImageProgram generics
type SigmaInstance = Sigma
type GraphInstance = Graph<GraphNodeAttributes, GraphEdgeAttributes>

function randomPastelGradient(): [string, string] {
	const hue = Math.random() * 360
	const hue2 = (hue + 30 + Math.random() * 30) % 360
	const s = 40 + Math.random() * 25
	const l = 75 + Math.random() * 13
	return [`hsl(${hue}, ${s}%, ${l}%)`, `hsl(${hue2}, ${s + 10}%, ${l - 10}%)`]
}

const HIROGARU_BASE_NODE_SIZE = BASE_NODE_SIZE

function nodeSize(score: number): number {
	return Math.max(8, Math.min(30, 8 + Math.log1p(score) * 3))
}

// Edge color heatmap based on target engagement (how much THEY interact with you).
// Blue (low) → Purple → Magenta → Gold (high), cosmic nebula palette.
const EDGE_COLOR_STOPS = [
	{ t: 0.00, r:  25, g:  35, b:  70 }, // dark navy (no engagement, barely visible)
	{ t: 0.40, r: 147, g:  51, b: 234 }, // purple
	{ t: 0.70, r: 236, g:  72, b: 153 }, // magenta
	{ t: 1.00, r: 251, g: 191, b:  36 }, // gold   (max engagement)
]

function edgeColor(targetScore: number, maxTarget: number): string {
	const t = maxTarget > 0 ? Math.sqrt(Math.log1p(targetScore) / Math.log1p(maxTarget)) : 0
	let i = EDGE_COLOR_STOPS.length - 2
	for (let j = 0; j < EDGE_COLOR_STOPS.length - 1; j++) {
		if (t <= EDGE_COLOR_STOPS[j + 1].t) { i = j; break }
	}
	const s0 = EDGE_COLOR_STOPS[i], s1 = EDGE_COLOR_STOPS[i + 1]
	const lt = (t - s0.t) / (s1.t - s0.t)
	const r = Math.round(s0.r + lt * (s1.r - s0.r))
	const g = Math.round(s0.g + lt * (s1.g - s0.g))
	const b = Math.round(s0.b + lt * (s1.b - s0.b))
	return `rgb(${r}, ${g}, ${b})`
}

export class SigmaController {
	sigma: SigmaInstance
	graph: GraphInstance
	totalNodeCount: number
	readonly hirogaruBgColors: [string, string] = randomPastelGradient()
	private selfDid: string
	private currentMode: GraphMode = 'cosmic'
	private hirogaruAngleOffset = Math.random() * 2 * Math.PI

	constructor(sigma: SigmaInstance, graph: GraphInstance, selfDid: string, totalNodeCount: number) {
		this.sigma = sigma
		this.graph = graph
		this.selfDid = selfDid
		this.totalNodeCount = totalNodeCount
	}

	captureImage(container: HTMLElement): string {
		const offscreen = document.createElement('canvas')
		offscreen.width = container.offsetWidth
		offscreen.height = container.offsetHeight
		const ctx = offscreen.getContext('2d')!
		const [c0, c1] = this.hirogaruBgColors
		const grad = ctx.createLinearGradient(0, 0, offscreen.width, offscreen.height)
		grad.addColorStop(0, c0)
		grad.addColorStop(1, c1)
		ctx.fillStyle = grad
		ctx.fillRect(0, 0, offscreen.width, offscreen.height)
		for (const canvas of Object.values(this.sigma.getCanvases())) {
			ctx.drawImage(canvas as HTMLCanvasElement, 0, 0, offscreen.width, offscreen.height)
		}
		return offscreen.toDataURL('image/jpeg', 0.85)
	}

	startInitialLayout(): void {
		// Skip FA2 entirely to avoid initial vibration.
		// Apply golden-angle positions immediately (duration=0).
		this._snapToScoreRadius(0)
	}

	// Place nodes at score-based radii using a golden-angle spiral.
	// High score → close to center, low score → far.
	// duration=0 means instantaneous (no animation = no vibration on load).
	private _snapToScoreRadius(duration = 1200): void {
		const others = this.graph
			.nodes()
			.filter((n) => n !== this.selfDid && !this.graph.getNodeAttribute(n, 'hidden'))
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
		// Golden angle ≈ 137.5° — optimal for uniform angular distribution with no clustering.
		const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

		others.forEach((node, i) => {
			const score = this.graph.getNodeAttribute(node, 'nodeData').totalScore
			const logT = logMax > 0 ? Math.sqrt(Math.log1p(score) / logMax) : 0
			const r = 2 + (1 - logT) * 14
			const angle = i * GOLDEN_ANGLE + (Math.random() - 0.5) * 0.3
			positions[node] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
		})

		// Collapse hidden nodes to center so they don't inflate bounding box.
		for (const n of this.graph.nodes()) {
			if (n !== this.selfDid && this.graph.getNodeAttribute(n, 'hidden')) {
				positions[n] = { x: 0, y: 0 }
			}
		}

		animateNodes(this.graph, positions, { duration, easing: 'cubicInOut' })
	}

	// When mode changes to 'hirogaru', displayCount controls how many nodes are shown.
	// When called with the same mode (e.g. hirogaru→hirogaru), only display count updates.
	setMode(mode: GraphMode, displayCount?: number, nodeSizeForHirogaru?: number): void {
		const modeChanged = mode !== this.currentMode

		if (modeChanged) {
			this.currentMode = mode

			if (mode === 'cosmic') {
				this.sigma.setSetting('itemSizesReference', 'screen')
				this.sigma.setSetting('enableCameraZooming', true)
				this.sigma.setSetting('enableCameraPanning', true)
				this.sigma.setSetting('enableCameraRotation', true)
				for (const node of this.graph.nodes()) {
					this.graph.removeNodeAttribute(node, 'hidden')
					const nd = this.graph.getNodeAttribute(node, 'nodeData')
					this.graph.setNodeAttribute(
						node,
						'size',
						node === this.selfDid ? 40 : nodeSize(nd.totalScore)
					)
				}
				this.sigma.setSetting('edgeReducer', null)
				this.sigma.setSetting('nodeReducer', null)
				this.sigma.getCamera().animate({ ratio: 1 }, { duration: 1200 })
				this._snapToScoreRadius(1200)
				return
			} else {
				// ひろがるモードへの移行時は、カメラ操作を無効化する前にカメラ状態を初期位置にリセットする。
				// Sigma.jsのカメラはenabled*がfalseだとsetState/animateが無視されるため、
				// リセットを先に行う必要がある。
				this.sigma.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 })
				this.sigma.setSetting('itemSizesReference', 'positions')
				this.sigma.setSetting('enableCameraZooming', false)
				this.sigma.setSetting('enableCameraPanning', false)
				this.sigma.setSetting('enableCameraRotation', false)
				this.sigma.setSetting('edgeReducer', (_e, data) => ({ ...data, hidden: true }))
				this.sigma.setSetting('nodeReducer', (_n, data) => ({ ...data, label: '' }))
			}
		}

		if (mode === 'hirogaru') {
			const count = displayCount ?? this.totalNodeCount
			const size = nodeSizeForHirogaru ?? HIROGARU_BASE_NODE_SIZE
			this._applyHirogaru(count, modeChanged ? 800 : 300, size)
		}
	}

	private _applyHirogaru(count: number, duration: number, nodeSize = HIROGARU_BASE_NODE_SIZE): void {
		const orderedNodes = this.graph
			.nodes()
			.filter((n) => n !== this.selfDid)
			.sort(
				(a, b) =>
					this.graph.getNodeAttribute(b, 'nodeData').totalScore -
					this.graph.getNodeAttribute(a, 'nodeData').totalScore
			)

		// In positions mode, sigma `size` = radius in graph coords.
		// Layout formula uses nodeSize as DIAMETER, so set radius = nodeSize/2.
		// SELF_RADIUS = 20 matches the constant in hirogaruLayout.ts.
		this.graph.setNodeAttribute(this.selfDid, 'size', 20)

		for (let i = 0; i < orderedNodes.length; i++) {
			if (i < count) {
				this.graph.removeNodeAttribute(orderedNodes[i], 'hidden')
				this.graph.setNodeAttribute(orderedNodes[i], 'size', nodeSize / 2)
			} else {
				this.graph.setNodeAttribute(orderedNodes[i], 'hidden', true)
			}
		}

		const targets = computeHirogaruPositions(this.graph, this.selfDid, count, nodeSize, this.hirogaruAngleOffset)

		// Collapse hidden nodes to center so they don't inflate Sigma's graphExtent bounding box.
		// graphExtent() iterates ALL nodes regardless of 'hidden', so stale outer positions
		// prevent the normalization from shrinking when count decreases.
		for (let i = count; i < orderedNodes.length; i++) {
			targets[orderedNodes[i]] = { x: 0, y: 0 }
		}

		animateNodes(this.graph, targets, { duration, easing: 'cubicInOut' })
	}

	updateNodes(nodes: NodeData[], mode: GraphMode, displayCount: number, nodeSizeForHirogaru: number): void {
		const scoreMap = new Map(nodes.map((n) => [n.did, n]))
		const maxTarget = nodes.length > 0 ? Math.max(...nodes.map((n) => n.targetScore)) : 1

		for (const n of this.graph.nodes()) {
			if (n === this.selfDid) continue
			const updated = scoreMap.get(n)
			if (!updated || updated.totalScore === 0) {
				this.graph.setNodeAttribute(n, 'hidden', true)
				const nd = this.graph.getNodeAttribute(n, 'nodeData')
				this.graph.setNodeAttribute(n, 'nodeData', { ...nd, totalScore: 0, targetScore: 0 })
			} else {
				this.graph.removeNodeAttribute(n, 'hidden')
				this.graph.setNodeAttribute(n, 'nodeData', updated)
				if (mode === 'cosmic') {
					this.graph.setNodeAttribute(n, 'size', nodeSize(updated.totalScore))
				}
			}
			// Update edge color for this node
			for (const edge of this.graph.edges(n)) {
				const targetScore = updated?.targetScore ?? 0
				this.graph.setEdgeAttribute(edge, 'color', edgeColor(targetScore, maxTarget))
			}
		}

		if (mode === 'cosmic') {
			this._snapToScoreRadius(400)
		} else if (mode === 'hirogaru') {
			this._applyHirogaru(displayCount, 400, nodeSizeForHirogaru)
		}
	}

	getNodeData(nodeId: string): NodeData {
		return this.graph.getNodeAttribute(nodeId, 'nodeData')
	}

	kill(): void {
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

	const maxTargetScore = nodes.length > 0 ? Math.max(...nodes.map((n) => n.targetScore)) : 1

	const selfNodeData: NodeData = {
		did: selfDid,
		handle: selfProfile.handle,
		displayName: selfProfile.displayName,
		avatarUrl: selfProfile.avatarUrl,
		actorCounts: { like: 0, repost: 0, reply: 0, quote: 0, mention: 0, follow: 0 },
		targetCounts: { like: 0, repost: 0, reply: 0, quote: 0, mention: 0, follow: 0 },
		totalScore: 0,
		targetScore: 0,
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
		const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2
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
			weight: 1,
			color: edgeColor(node.targetScore, maxTargetScore),
			hidden: false
		})
	}

	const NodeImageProgram = createNodeImageProgram()

	// Sigma 3.0.3 hardcodes preserveDrawingBuffer: false in its WebGL context creation,
	// so we temporarily patch getContext to override it before Sigma initializes.
	// This enables canvas.toDataURL() to read WebGL content for the share screenshot.
	const _origGetContext = HTMLCanvasElement.prototype.getContext
	;(HTMLCanvasElement.prototype as any).getContext = function (type: string, attrs?: Record<string, unknown>) {
		if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
			attrs = { ...(attrs ?? {}), preserveDrawingBuffer: true }
		}
		return _origGetContext.call(this, type, attrs)
	}
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
	HTMLCanvasElement.prototype.getContext = _origGetContext

	const controller = new SigmaController(sigma, graph, selfDid, nodes.length)
	controller.startInitialLayout()

	return controller
}
