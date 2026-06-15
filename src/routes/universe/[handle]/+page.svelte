<script lang="ts">
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { initSigma, type SigmaController } from '$lib/sigma/renderer'
	import { Starfield } from '$lib/sigma/starfield'
	import { buildNodesFromEventsSync, type ProfileInfo } from '$lib/graph/fetchGraphData'
	import type { GraphMode, NodeData, EventRecord } from '$lib/types'

	const handle = $derived($page.params.handle ?? '')

	let starfieldEl: HTMLCanvasElement
	let sigmaEl: HTMLElement

	let loading = $state(true)
	let error = $state<string | null>(null)
	let mode = $state<GraphMode>('cosmic')
	let controller = $state<SigmaController | null>(null)
	let displayCount = $state(0)
	let displaySize = $state(14)
	let tooltipNode = $state<NodeData | null>(null)
	let tooltipX = $state(0)
	let tooltipY = $state(0)
	let hideTooltipTimeout: ReturnType<typeof setTimeout> | null = null
	let shareStatus = $state<'idle' | 'capturing' | 'uploading' | 'done' | 'error'>('idle')

	// Timeline state
	let allEvents = $state<EventRecord[]>([])
	let currentSelfDid = $state('')
	let profileCache = $state(new Map<string, ProfileInfo>())
	let timelineMin = $state(0)
	let timelineMax = $state(0)
	let timelineValue = $state(0)   // committed value — triggers graph update on release
	let timelineDisplay = $state(0) // live value — updates on drag for real-time date label

	function formatTimelineDate(ms: number): string {
		return new Date(ms).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
	}

	// Persist slider values to localStorage
	$effect(() => {
		if (displayCount > 0) localStorage.setItem('hirogaru_displayCount', String(displayCount))
	})
	$effect(() => {
		if (displaySize >= 6) localStorage.setItem('hirogaru_displaySize', String(displaySize))
	})

	async function handleShare() {
		if (!controller || shareStatus === 'capturing' || shareStatus === 'uploading') return
		shareStatus = 'capturing'
		try {
			const imageBase64 = controller.captureImage(sigmaEl)
			shareStatus = 'uploading'
			const res = await fetch('/api/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle, imageBase64 })
			})
			if (!res.ok) throw new Error('share failed')
			const { url: shareUrl } = await res.json()

			const postText = `@${handle}の超ひろがるBluesky!!\n${shareUrl}`
			const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(postText)}`
			window.open(bskyUrl, '_blank', 'noopener,noreferrer')

			shareStatus = 'done'
			setTimeout(() => { shareStatus = 'idle' }, 3000)
		} catch {
			shareStatus = 'error'
			setTimeout(() => { shareStatus = 'idle' }, 3000)
		}
	}

	function scheduleHideTooltip() {
		hideTooltipTimeout = setTimeout(() => {
			tooltipNode = null
			hideTooltipTimeout = null
		}, 150)
	}

	function cancelHideTooltip() {
		if (hideTooltipTimeout) {
			clearTimeout(hideTooltipTimeout)
			hideTooltipTimeout = null
		}
	}

	// Combined effect: re-runs when mode, displayCount, displaySize, or timelineValue changes.
	// When timeline is at max, delegate entirely to setMode.
	// When timeline is active (past), setMode resets state then updateNodes re-applies the filter.
	$effect(() => {
		if (!controller) return
		const count = displayCount > 0 ? displayCount : controller.totalNodeCount
		controller.setMode(mode, count, displaySize)
		if (timelineValue > 0 && timelineValue < timelineMax && allEvents.length > 0) {
			const cutoff = new Date(timelineValue).toISOString()
			const filtered = allEvents.filter((e) => e.created_at <= cutoff)
			const newNodes = buildNodesFromEventsSync(currentSelfDid, filtered, profileCache)
			controller.updateNodes(newNodes, mode, count, displaySize)
		}
	})

	$effect(() => {
		const _handle = handle  // $effect がこの依存を追跡し、変化時に再実行する

		let starfield: Starfield | null = null
		let ctrl: SigmaController | null = null
		let cancelled = false

		loading = true
		error = null
		tooltipNode = null
		allEvents = []
		timelineMin = 0
		timelineMax = 0
		timelineValue = 0
		timelineDisplay = 0
		cancelHideTooltip()

		async function init() {
			try {
				const res = await fetch(`/api/graph/${encodeURIComponent(_handle)}`)
				if (!res.ok) throw new Error(`graph fetch failed: ${res.status}`)
				const { nodes, selfDid, selfProfile, events } = await res.json()
				if (cancelled) return
				loading = false

				// Set up timeline state
				allEvents = events ?? []
				currentSelfDid = selfDid
				profileCache = new Map(nodes.map((n: NodeData) => [n.did, {
					did: n.did, handle: n.handle, displayName: n.displayName, avatarUrl: n.avatarUrl
				}]))
				if (allEvents.length > 0) {
					const timestamps = allEvents.map((e) => new Date(e.created_at).getTime())
					timelineMin = Math.min(...timestamps)
					timelineMax = Math.max(...timestamps)
					timelineValue = timelineMax
					timelineDisplay = timelineMax
				}

				starfield = new Starfield(starfieldEl)
				starfield.start()

				ctrl = initSigma(sigmaEl, nodes, selfDid, selfProfile)
				controller = ctrl

				// Restore slider values from localStorage
				const savedCount = parseInt(localStorage.getItem('hirogaru_displayCount') ?? '')
				const savedSize = parseInt(localStorage.getItem('hirogaru_displaySize') ?? '')
				displayCount = !isNaN(savedCount) ? Math.min(Math.max(1, savedCount), ctrl.totalNodeCount) : ctrl.totalNodeCount
				displaySize = !isNaN(savedSize) ? Math.max(6, Math.min(28, savedSize)) : 14

				ctrl.sigma.on('enterNode', ({ node, event }) => {
					cancelHideTooltip()
					tooltipNode = ctrl!.getNodeData(node)
					tooltipX = event.x
					tooltipY = event.y
				})
				ctrl.sigma.on('leaveNode', () => {
					scheduleHideTooltip()
				})
			} catch (e) {
				if (cancelled) return
				loading = false
				error = e instanceof Error ? e.message : 'データの取得に失敗しました'
			}
		}

		init()

		return () => {
			cancelled = true
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

	<!-- Hirogaru background (random pastel gradient, generated per session) -->
	{#if mode === 'hirogaru' && controller}
		<div
			class="absolute inset-0"
			style:z-index="0"
			style:background="linear-gradient(135deg, {controller.hirogaruBgColors[0]} 0%, {controller.hirogaruBgColors[1]} 100%)"
		></div>
	{:else if mode === 'hirogaru'}
		<div class="absolute inset-0" style:z-index="0" style:background="#87ceeb"></div>
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
			<span class="rounded bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur" style="font-family: 'MaruMinya', sans-serif;">
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

		<!-- Timeline slider (top center) -->
		{#if !loading && !error && timelineMax > timelineMin}
			<div
				class="pointer-events-auto absolute left-1/2 top-14 -translate-x-1/2 rounded-xl bg-black/40 px-3 py-2 backdrop-blur"
				style="width: min(calc(100vw - 220px), 380px);"
			>
				<input
					type="range"
					min={timelineMin}
					max={timelineMax}
					bind:value={timelineDisplay}
					onchange={() => { timelineValue = timelineDisplay }}
					class="w-full cursor-pointer accent-white"
					aria-label="タイムライン"
				/>
				<div class="flex justify-between text-xs text-white/60" style="font-family: 'MaruMinya', sans-serif;">
					<span>{formatTimelineDate(timelineMin)}</span>
					<span class="font-semibold text-white">{formatTimelineDate(timelineDisplay)}</span>
					<span>{formatTimelineDate(timelineMax)}</span>
				</div>
			</div>
		{/if}

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

		<!-- Sliders (hirogaru mode only) -->
		{#if mode === 'hirogaru' && controller}
			<div
				class="pointer-events-auto absolute right-4 top-14 flex flex-row items-stretch gap-3 rounded-xl bg-white/20 px-3 py-3 backdrop-blur"
				style="font-family: 'MaruMinya', sans-serif;"
			>
				<!-- 人数スライダー -->
				<div class="flex flex-col items-center gap-1">
					<span class="text-xs font-semibold text-white">{displayCount}</span>
					<input
						type="range"
						min="1"
						max={controller.totalNodeCount}
						bind:value={displayCount}
						class="h-36 cursor-pointer accent-white"
						style="writing-mode: vertical-lr; direction: rtl;"
						aria-label="表示ノード数"
					/>
					<span class="text-xs text-white/60">1</span>
					<span class="text-xs text-white/50">人数</span>
				</div>
				<!-- 区切り線 -->
				<div class="w-px self-stretch bg-white/20"></div>
				<!-- 大きさスライダー -->
				<div class="flex flex-col items-center gap-1">
					<span class="text-xs font-semibold text-white">{displaySize}</span>
					<input
						type="range"
						min="6"
						max="28"
						step="1"
						bind:value={displaySize}
						class="h-36 cursor-pointer accent-white"
						style="writing-mode: vertical-lr; direction: rtl;"
						aria-label="ノードの大きさ"
					/>
					<span class="text-xs text-white/60">6</span>
					<span class="text-xs text-white/50">大きさ</span>
				</div>
			</div>
		{/if}

		<!-- Share button (hirogaru mode only) -->
		{#if mode === 'hirogaru' && controller}
			<button
				onclick={handleShare}
				disabled={shareStatus === 'capturing' || shareStatus === 'uploading'}
				class="pointer-events-auto absolute bottom-6 right-4 rounded-xl bg-white/30 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/50 disabled:opacity-60"
			>
				{#if shareStatus === 'capturing' || shareStatus === 'uploading'}
					⏳ 生成中...
				{:else if shareStatus === 'done'}
					✅ URLをコピーしました
				{:else if shareStatus === 'error'}
					❌ 失敗しました
				{:else}
					📤 シェア
				{/if}
			</button>
		{/if}

		<!-- Tooltip -->
		{#if tooltipNode}
			<div
				class="pointer-events-auto absolute rounded bg-black/80 px-3 py-2 text-sm text-white backdrop-blur"
				style:left="{tooltipX + 12}px"
				style:top="{tooltipY - 8}px"
				onmouseenter={cancelHideTooltip}
				onmouseleave={() => { tooltipNode = null }}
			>
				<div class="max-w-48 truncate font-semibold">{tooltipNode.displayName || tooltipNode.handle}</div>
				<div class="max-w-48 truncate text-zinc-400">@{tooltipNode.handle}</div>
				{#if mode === 'cosmic'}
					<table class="mt-1 text-xs">
						<thead>
							<tr>
								<th class="w-20 text-left text-zinc-500"></th>
								<th class="w-14 text-right text-zinc-400">From You</th>
								<th class="w-14 text-right text-zinc-400">To You</th>
							</tr>
						</thead>
						<tbody>
							{#each [['Like', 'like'], ['Repost', 'repost'], ['Reply', 'reply'], ['Quote', 'quote'], ['Mention', 'mention']] as [label, key]}
								<tr>
									<td class="text-zinc-500">{label}</td>
									<td class="text-right tabular-nums">{tooltipNode.actorCounts[key as keyof typeof tooltipNode.actorCounts]}</td>
									<td class="text-right tabular-nums">{tooltipNode.targetCounts[key as keyof typeof tooltipNode.targetCounts]}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<button
						onclick={() => goto(`/universe/${encodeURIComponent(tooltipNode!.handle)}`)}
						class="mt-2 w-full cursor-pointer rounded bg-indigo-600 py-1 text-xs font-bold hover:bg-indigo-500"
					>
						🚀 Warp!
					</button>
				{:else}
					<div class="mt-1 text-xs text-zinc-500">Score: {tooltipNode.totalScore}</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
