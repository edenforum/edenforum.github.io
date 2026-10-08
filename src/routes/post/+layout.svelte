<script lang="ts">
	import PageNav from '$lib/page-nav.svelte';
	import { currentPostStore } from '$lib/stores';
	import { dec } from '$lib/obfuscate';
	const { children = $bindable() } = $props();

	// hidden posts carry an obfuscated title (see $lib/obfuscate)
	const title = $derived(
		$currentPostStore
			? $currentPostStore.hidden
				? dec($currentPostStore.title)
				: $currentPostStore.title
			: 'untitled post'
	);
</script>

<article>
	<PageNav>
		<h2>{title}</h2>
		<time>
			{$currentPostStore?.date ?? '-'}
		</time>
	</PageNav>
	{@render children()}
</article>

<style>
	h2 {
		margin: 0;
		font-size: 1rem;
		color: var(--blue-2);
		text-align: center;
	}
	time {
		text-align: right;
	}
</style>
