<script lang="ts">
	const { children = $bindable() } = $props();
</script>

<div class="nav">
	<button class="back-btn" onclick={() => history.back()}>back</button>
	{@render children()}
</div>

<style>
	.nav {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		background-color: #e8c8f0;
		color: hsl(318, 47%, 64%);
		padding: 0.5em;

		:global(:nth-child(3)) {
			text-align: right;
		}

		.back-btn {
			padding: 0;
			margin: 0;
			outline: none;
			border: none;
			cursor: var(--cur-pointer);
			text-align: left;
			width: fit-content;
			&:hover {
				text-decoration: underline;
			}
		}
	}
</style>
