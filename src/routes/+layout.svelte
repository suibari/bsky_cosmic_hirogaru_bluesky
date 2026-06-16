<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
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
{@render children()}
