<script lang="ts">
	const {
		children = $bindable(),
		username = '',
		userHref = undefined as string | undefined,
		userIcon = '/icons/pfp.png',
	} = $props();
</script>

<section>
	{#if typeof userHref !== 'undefined'}
		<a href={userHref}>
			<aside>
				<img class="dialup" src={userIcon} alt="" />
				<span class="user-name">{username}</span>
			</aside>
		</a>
	{:else}
		<aside>
			<img class="dialup" src={userIcon} alt="" />
			<span class="user-name">{username}</span>
		</aside>
	{/if}
	<p>
		{@render children()}
	</p>
</section>

<style>
	p {
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

	section a:has(> aside) {
		display: contents;
	}

	section aside {
		display: flex;
		flex-direction: column;
		align-items: center;

		& img {
			width: 6rem;
			height: 6rem;
		}

		.user-name {
			color: var(--blue-2);
		}
	}
</style>
