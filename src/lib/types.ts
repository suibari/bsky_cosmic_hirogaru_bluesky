export type NodeData = {
	did: string
	handle: string
	displayName: string
	avatarUrl: string
	counts: Record<'like' | 'repost' | 'reply' | 'quote' | 'follow', number>
	totalScore: number
	direction: 'actor' | 'target' | 'both'
}

export type GraphMode = 'cosmic' | 'hirogaru'

export type GraphNodeAttributes = {
	x: number
	y: number
	size: number
	label: string
	type: 'image'
	image: string
	color: string
	fixed?: boolean
	nodeData: NodeData
}

export type GraphEdgeAttributes = {
	weight: number
	color: string
	hidden?: boolean
}
