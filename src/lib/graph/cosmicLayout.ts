import FA2Layout from 'graphology-layout-forceatlas2/worker'
import type Graph from 'graphology'

export type FA2Instance = InstanceType<typeof FA2Layout>

export function startCosmicLayout(graph: Graph, onStop?: () => void): FA2Instance {
	const fa2 = new FA2Layout(graph, {
		settings: {
			barnesHutOptimize: true,
			scalingRatio: 2,
			gravity: 0.5,
			// High slowDown suppresses oscillation; nodes converge instead of bouncing
			slowDown: 300
		},
		getEdgeWeight: 'weight'
	})
	fa2.start()
	setTimeout(() => {
		fa2.stop()
		onStop?.()
	}, 2000)
	return fa2
}
