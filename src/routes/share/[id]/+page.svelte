<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>@{data.handle}の超ひろがるBluesky!!</title>
	<meta property="og:title" content="@{data.handle}の超ひろがるBluesky!!" />
	<meta property="og:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta property="og:image" content="/api/share/{data.id}/image" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="@{data.handle}の超ひろがるBluesky!!" />
	<meta name="twitter:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta name="twitter:image" content="/api/share/{data.id}/image" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-6">
	<img
		src="/api/share/{data.id}/image"
		alt="@{data.handle}のひろがるネットワーク"
		class="max-w-2xl w-full rounded-2xl shadow-2xl"
	/>
	<p class="text-xl font-bold text-white">@{data.handle}の超ひろがるBluesky!!</p>
	<button
		onclick={() => goto(`/universe/${encodeURIComponent(data.handle)}`)}
		class="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
	>
		自分のひろがりを見る
	</button>
</div>
