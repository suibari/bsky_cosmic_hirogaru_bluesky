<script lang="ts">
	let { open, onclose }: { open: boolean; onclose: () => void } = $props()
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		onclick={onclose}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-zinc-900 p-6 text-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<button
				onclick={onclose}
				class="absolute right-4 top-4 text-zinc-400 hover:text-white text-xl leading-none"
				aria-label="閉じる"
			>
				✕
			</button>

			<h2 class="mb-5 text-lg font-bold text-white" style="font-family: 'MaruMinya', sans-serif;">使い方ガイド</h2>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-sky-300" style="font-family: 'MaruMinya', sans-serif;">✨ このアプリについて</h3>
				<p class="text-sm text-zinc-300 leading-relaxed">
					Blueskyでのつながりを、宇宙として可視化するアプリです
				</p>
			</section>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-sky-300" style="font-family: 'MaruMinya', sans-serif;">🚀 使い方</h3>
				<ul class="text-sm text-zinc-300 leading-relaxed space-y-1">
					<li>・ トップページでBlueskyのハンドルを入力して「発進!!」を押すと表示されます</li>
					<li>・ サインイン不要でご利用いただけます</li>
					<li>・ 右上のボタンでコズミックとひろがるの2モードを切り替えられます</li>
					<li>・ どちらも、やりとりが多いアカウントほど近くに配置されます</li>
				</ul>
			</section>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-indigo-300" style="font-family: 'MaruMinya', sans-serif;">🌌 コズミックモード</h3>
				<ul class="text-sm text-zinc-300 leading-relaxed space-y-1">
					<li>・ 宇宙のような空間に関係を描くモードです</li>
					<li>・ タイムラインスライダーで、過去の関係をさかのぼって見ることができます</li>
					<li>・ ノードにマウスホバーすると、リプライやいいねの内訳が表示されます</li>
					<li>・ 線が金色・赤色に近づくほど、中心ノードへの興味が高いかも… ✨</li>
					<li>・ 思いもしない人があなたに興味があるかもしれません</li>
				</ul>
			</section>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-sky-400" style="font-family: 'MaruMinya', sans-serif;">🔵 ひろがるモード</h3>
				<ul class="text-sm text-zinc-300 leading-relaxed space-y-1">
					<li>・ フォロー関係の相関図モードです</li>
					<li>・ スライダーでノードの大きさと表示数を動的に調節できます</li>
					<li>・ シェア機能でBlueskyに画像つきで簡単にシェアできます</li>
				</ul>
			</section>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-yellow-300" style="font-family: 'MaruMinya', sans-serif;">💡 TIPS</h3>
				<ul class="text-sm text-zinc-300 leading-relaxed space-y-1">
					<li>・ 初回アクセス時は最低限のデータしか収集されないため、過去のデータが不十分な場合があります</li>
					<li>・ 以降は自動的にデータが蓄積されていくので、たまにのぞきに来てみてください</li>
				</ul>
			</section>

			<section class="mb-4">
				<h3 class="mb-1 text-base font-bold text-red-400" style="font-family: 'MaruMinya', sans-serif;">⚠️ 免責事項</h3>
				<p class="text-sm text-zinc-300 leading-relaxed">
					本アプリの利用により生じた損害・トラブルについて、開発者は一切の責任を負いません
				</p>
			</section>

			<section>
				<h3 class="mb-1 text-base font-bold text-zinc-300" style="font-family: 'MaruMinya', sans-serif;">👨‍💻 開発者</h3>
				<p class="text-sm text-zinc-300 leading-relaxed">
					<a
						href="https://bsky.app/profile/suibari.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sky-400 underline hover:text-sky-300"
					>すいばり (@suibari.com)</a> が開発しました
				</p>
				<p class="mt-1 text-sm text-zinc-300 leading-relaxed">
					ソースコードは
					<a
						href="https://github.com/suibari/bsky_cosmic_hirogaru_bluesky"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sky-400 underline hover:text-sky-300"
					>GitHub</a> で公開しています
				</p>
			</section>
		</div>
	</div>
{/if}
