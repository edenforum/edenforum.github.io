<script lang="ts">
	import PageNav from '$lib/page-nav.svelte';
	import { currentPostStore } from '$lib/stores';
	const { children = $bindable() } = $props();
</script>

<article>
	<PageNav>
		<h2>{$currentPostStore?.title ?? 'untitled post'}</h2>
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
