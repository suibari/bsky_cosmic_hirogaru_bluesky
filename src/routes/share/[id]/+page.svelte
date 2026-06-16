<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	let handle = $state('')
	let error = $state('')

	async function handleSubmit() {
		const trimmed = handle.trim().replace(/^@/, '')
		if (!trimmed) {
			error = 'ハンドルを入力してください'
			return
		}
		error = ''
		await goto(`/universe/${encodeURIComponent(trimmed)}`)
	}
</script>

<svelte:head>
	<title>@{data.handle}の超ひろがるBluesky!!</title>
	<meta property="og:title" content="@{data.handle}の超ひろがるBluesky!!" />
	<meta property="og:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta property="og:url" content="{data.origin}/share/{data.id}" />
	<meta property="og:image" content="{data.origin}/api/share/{data.id}/image" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="@{data.handle}の超ひろがるBluesky!!" />
	<meta name="twitter:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta name="twitter:image" content="{data.origin}/api/share/{data.id}/image" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-6">
	<img
		src="/api/share/{data.id}/image"
		alt="@{data.handle}のひろがるネットワーク"
		class="max-w-2xl w-full rounded-2xl shadow-2xl"
	/>
	<p class="text-xl font-bold text-white">@{data.handle}の超ひろがるBluesky!!</p>

	<form
		onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
		class="flex gap-2"
	>
		<input
			bind:value={handle}
			placeholder="handle.bsky.social"
			autocomplete="off"
			spellcheck="false"
			class="w-64 rounded bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-sky-500"
		/>
		<button
			type="submit"
			class="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
		>
			自分のひろがりを見る
		</button>
	</form>

	{#if error}
		<p class="text-sm text-red-400">{error}</p>
	{/if}
</div>
