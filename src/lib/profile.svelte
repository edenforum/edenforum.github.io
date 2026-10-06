<script lang="ts">
	import PageNav from './page-nav.svelte';
	import Section from './section.svelte';

	const {
		username = '',
		iconURL = '',
		joinDate = '',
		children = $bindable(),
	} = $props();
</script>

<PageNav>
	<div></div>
	<datetime>joined on {joinDate}</datetime>
</PageNav>

<Section>
	<aside>
		<img class="dialup" src={iconURL} alt={`${username}'s profile picture`} />
		<span class="user-name">{username}</span>
	</aside>
	<div>
		{@render children()}
	</div>
</Section>

<style>
	aside {
		display: flex;
		flex-direction: column;
		align-items: center;

		img {
			width: 8rem;
			height: 8rem;
		}

		.user-name {
			color: var(--blue-2);
		}
	}
</style>
