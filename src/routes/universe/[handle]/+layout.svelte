<script lang="ts">
	import type { LayoutData } from './$types'
	let { data, children }: { data: LayoutData; children: any } = $props()

	const title = `@${data.ogpHandle}の超ひろがるBluesky!!`
	const description = data.ogpDisplayName
		? `${data.ogpDisplayName}さんのBlueskyつながりを探索しよう!`
		: 'Blueskyで無限に広がる青い宇宙!'
</script>

<svelte:head>
	<title>{title}</title>
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content="{data.origin}/universe/{data.ogpHandle}" />
	<meta property="og:image" content="{data.origin}/ogp.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="{data.origin}/ogp.png" />
</svelte:head>

{@render children()}
