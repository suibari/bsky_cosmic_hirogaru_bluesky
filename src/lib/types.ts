export type InteractionCounts = Record<
	'like' | 'repost' | 'reply' | 'quote' | 'mention' | 'follow',
	number
>

export type NodeData = {
	did: string
	handle: string
	displayName: string
	avatarUrl: string
	actorCounts: InteractionCounts   // 自分 → 相手
	targetCounts: InteractionCounts  // 相手 → 自分
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
	hidden?: boolean
	nodeData: NodeData
}

export type GraphEdgeAttributes = {
	weight: number
	color: string
	hidden?: boolean
}
