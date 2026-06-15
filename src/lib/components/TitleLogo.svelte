<script lang="ts">
	const chars = [
		{ char: '超', color: '#e05a5a' },
		{ char: 'ひ', color: '#e8865a' },
		{ char: 'ろ', color: '#e8c45a' },
		{ char: 'が', color: '#c8e05a' },
		{ char: 'る', color: '#6ac05a' },
		{ char: 'B', color: '#5ab8c8' },
		{ char: 'l', color: '#5aaae0' },
		{ char: 'u', color: '#7a8ae8' },
		{ char: 'e', color: '#a07ae0' },
		{ char: 's', color: '#c05ab8' },
		{ char: 'k', color: '#e05a8a' },
		{ char: 'y', color: '#e05a5a' },
		{ char: '!', color: '#e8865a' },
		{ char: '!', color: '#e8c45a' },
	]
</script>

<h1 class="title-logo">
	{#each chars as { char, color }}
		<span style="color: {color}">{char}</span>
	{/each}
</h1>

<style>
	.title-logo {
		font-size: clamp(2rem, 6vw, 4rem);
		line-height: 1.2;
		letter-spacing: 0.05em;
	}
</style>
