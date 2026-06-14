<script lang="ts">
	import { goto } from '$app/navigation'

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

<main class="flex min-h-screen flex-col items-center justify-center bg-black text-white">
	<h1 class="mb-2 text-4xl font-bold tracking-wide">超ひろがるBluesky!!</h1>
	<p class="mb-8 text-sm text-zinc-400">Blueskyの人間関係を宇宙として可視化</p>

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
			探索
		</button>
	</form>

	{#if error}
		<p class="mt-4 text-sm text-red-400">{error}</p>
	{/if}
</main>
