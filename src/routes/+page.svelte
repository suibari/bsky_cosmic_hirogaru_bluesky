<script lang="ts">
	import { goto } from '$app/navigation'
	import TitleLogo from '$lib/components/TitleLogo.svelte'
	import HelpModal from '$lib/components/HelpModal.svelte'

	let handle = $state('')
	let error = $state('')
	let helpOpen = $state(false)

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
	<title>超ひろがるBluesky</title>
	<meta property="og:title" content="超ひろがるBluesky" />
	<meta property="og:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta property="og:image" content="/ogp.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="超ひろがるBluesky" />
	<meta name="twitter:description" content="Blueskyで無限に広がる青い宇宙!" />
	<meta name="twitter:image" content="/ogp.png" />
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-black text-white">
	<TitleLogo />
	<p class="mb-8 text-sm text-zinc-400" style="font-family: 'MaruMinya', sans-serif;">Blueskyで無限にひろがる青い宇宙!!</p>

	<form
		onsubmit={(e) => {
			e.preventDefault()
			handleSubmit()
		}}
		class="flex gap-2"
	>
		<input
			bind:value={handle}
			placeholder="handle.bsky.social"
			autocomplete="off"
			spellcheck="false"
			class="w-64 rounded bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500"
		/>
		<button
			type="submit"
			class="rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 active:bg-blue-700"
		>
			発進!!
		</button>
	</form>

	{#if error}
		<p class="mt-4 text-sm text-red-400">{error}</p>
	{/if}

	<button
		onclick={() => (helpOpen = true)}
		class="mt-6 text-sm text-zinc-500 underline hover:text-zinc-300 transition-colors"
		style="font-family: 'MaruMinya', sans-serif;"
	>
		ヘルプはこちら
	</button>
</main>

<HelpModal open={helpOpen} onclose={() => (helpOpen = false)} />
