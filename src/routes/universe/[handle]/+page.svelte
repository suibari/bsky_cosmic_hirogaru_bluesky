<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { fetchGraphData } from '$lib/graph/fetchGraphData'
	import { initSigma, type SigmaController } from '$lib/sigma/renderer'
	import { Starfield } from '$lib/sigma/starfield'
	import type { GraphMode, NodeData } from '$lib/types'

	const handle = $derived($page.params.handle ?? '')

	let starfieldEl: HTMLCanvasElement
	let sigmaEl: HTMLElement

	let loading = $state(true)
	let error = $state<string | null>(null)
	let mode = $state<GraphMode>('cosmic')
	let controller = $state<SigmaController | null>(null)
	let tooltipNode = $state<NodeData | null>(null)
	let tooltipX = $state(0)
	let tooltipY = $state(0)

	$effect(() => {
		if (controller) controller.setMode(mode)
	})

	onMount(() => {
		let starfield: Starfield | null = null
		let ctrl: SigmaController | null = null

		async function init() {
			try {
				const { nodes, selfDid, selfProfile } = await fetchGraphData(handle)
				loading = false

				starfield = new Starfield(starfieldEl)
				starfield.start()

				ctrl = initSigma(sigmaEl, nodes, selfDid, selfProfile)
				controller = ctrl

				ctrl.sigma.on('enterNode', ({ node, event }) => {
					tooltipNode = ctrl!.getNodeData(node)
					tooltipX = event.x
					tooltipY = event.y
				})
				ctrl.sigma.on('leaveNode', () => {
					tooltipNode = null
				})
			} catch (e) {
				loading = false
				error = e instanceof Error ? e.message : 'データの取得に失敗しました'
			}
		}

		init()

		return () => {
			starfield?.stop()
			ctrl?.kill()
			controller = null
		}
	})
</script>

<div class="fixed inset-0 overflow-hidden">
	<!-- Starfield background (cosmic mode) -->
	<canvas
		bind:this={starfieldEl}
		class="absolute inset-0"
		style:z-index="0"
		style:display={mode === 'cosmic' ? 'block' : 'none'}
	></canvas>

	<!-- Hirogaru background (light blue gradient) -->
	{#if mode === 'hirogaru'}
		<div
			class="absolute inset-0"
			style:z-index="0"
			style:background="linear-gradient(135deg, #87ceeb 0%, #4a9eff 100%)"
		></div>
	{/if}

	<!-- Sigma canvas container -->
	<div
		bind:this={sigmaEl}
		class="absolute inset-0"
		style:z-index="1"
		style:background="transparent"
	></div>

	<!-- UI overlay -->
	<div class="pointer-events-none absolute inset-0" style:z-index="2">
		<!-- Top bar -->
		<div class="pointer-events-auto flex items-center gap-3 p-3">
			<button
				onclick={() => goto('/')}
				class="rounded bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/60"
			>
				← 戻る
			</button>
			<span class="rounded bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur">
				@{handle}
			</span>
			<div class="ml-auto flex overflow-hidden rounded">
				<button
					onclick={() => (mode = 'cosmic')}
					class="px-3 py-1.5 text-sm font-medium transition-colors"
					style:background={mode === 'cosmic' ? '#4338ca' : 'rgba(0,0,0,0.4)'}
					style:color={mode === 'cosmic' ? '#fff' : 'rgba(255,255,255,0.6)'}
				>
					🌌 コズミック
				</button>
				<button
					onclick={() => (mode = 'hirogaru')}
					class="px-3 py-1.5 text-sm font-medium transition-colors"
					style:background={mode === 'hirogaru' ? '#0ea5e9' : 'rgba(0,0,0,0.4)'}
					style:color={mode === 'hirogaru' ? '#fff' : 'rgba(255,255,255,0.6)'}
				>
					🔵 ひろがる
				</button>
			</div>
		</div>

		<!-- Loading overlay -->
		{#if loading}
			<div
				class="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/80"
			>
				<div class="mb-4 animate-pulse text-4xl">🌌</div>
				<p class="text-lg text-white">宇宙を生成中...</p>
				<p class="mt-2 text-sm text-zinc-400">@{handle} のデータを取得しています</p>
			</div>
		{/if}

		<!-- Error overlay -->
		{#if error}
			<div
				class="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/80"
			>
				<p class="mb-4 text-lg text-red-400">{error}</p>
				<button
					onclick={() => goto('/')}
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
				>
					トップへ戻る
				</button>
			</div>
		{/if}

		<!-- Tooltip -->
		{#if tooltipNode}
			<div
				class="pointer-events-none absolute max-w-50 rounded bg-black/80 px-3 py-2 text-sm text-white backdrop-blur"
				style:left="{tooltipX + 12}px"
				style:top="{tooltipY - 8}px"
			>
				<div class="truncate font-semibold">{tooltipNode.displayName || tooltipNode.handle}</div>
				<div class="truncate text-zinc-400">@{tooltipNode.handle}</div>
				<div class="mt-1 text-xs text-zinc-500">スコア: {tooltipNode.totalScore}</div>
			</div>
		{/if}
	</div>
</div>
