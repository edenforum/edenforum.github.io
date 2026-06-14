<script lang="ts">
	const { children = $bindable() } = $props();
</script>

<section>
	{@render children()}
</section>

<style>
	section :global(p) {
		color: rgb(207, 121, 181);
	}

	section {
		display: flex;
		align-items: start;
		padding: 1em;
		gap: 1em;

		color: #ffffff;
	}

	section {
		background-color: #fedeff64;
		border-spacing: 2.25rem;
	}

	section:nth-child(2n) {
		background-color: #e5d3ff64;
	}

	section :global(a:has(> aside)) {
		display: contents;
	}
</style>
