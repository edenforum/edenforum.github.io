<script lang="ts">
	import { lens } from '$lib/stores';
	import Secret from '$lib/secret.svelte';

	const {
		children = $bindable(),
		username = '',
		userHref = undefined as string | undefined,
		userIcon = '/icons/pfp.png',
		class: className = '',
		hidden = false,
		secret = '',
	} = $props();

	let el = $state<HTMLElement>();
	let found = $state(false);

	// latch found once the magnifier grazes this comment
	$effect(() => {
		const l = $lens;
		if (!hidden || found || !l || !el) {
			return;
		}
		const r = el.getBoundingClientRect();
		const nx = Math.max(r.left, Math.min(l.x, r.right));
		const ny = Math.max(r.top, Math.min(l.y, r.bottom));
		if (Math.hypot(l.x - nx, l.y - ny) <= l.r) {
			found = true;
		}
	});

	// reveal overlay mask, offset so the circle lines up with the glass
	function maskFor(): string {
		const l = $lens;
		if (!l || !el) {
			return 'opacity:0'; // glass down: hide overlay, keep the linger
		}
		const r = el.getBoundingClientRect();
		const x = l.x - r.left;
		const y = l.y - r.top;
		const m = `radial-gradient(circle ${l.r}px at ${x}px ${y}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`;
		return `-webkit-mask-image:${m};mask-image:${m}`;
	}
</script>

{#snippet content()}
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
	<p class={className}>
		{#if secret}
			<Secret value={secret} shown={found} placeholder="…" />
		{:else}
			{@render children()}
		{/if}
	</p>
{/snippet}

{#if hidden}
	<section class="secret" class:found bind:this={el}>
		<!-- base layer: the lingering 20% comment once found -->
		<div class="layer base">
			{@render content()}
		</div>
		<!-- overlay: the whole comment, revealed through the lens -->
		<div class="layer reveal" class:revealing={!!$lens} style={maskFor()} aria-hidden="true">
			{@render content()}
		</div>
	</section>
{:else}
	<section>
		{@render content()}
	</section>
{/if}

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

	/* hidden comments: revealed through the magnifier like hidden posts */
	section.secret {
		position: relative;
		display: block;
		padding: 0;
		background: none;
	}

	section.secret .layer {
		display: flex;
		align-items: start;
		padding: 1em;
		gap: 1em;

		color: #ffffff;
		background-color: #fedeff64;
	}

	section.secret:nth-child(2n) .layer {
		background-color: #e5d3ff64;
	}

	section.secret .layer.base {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
		will-change: opacity;
	}

	section.secret.found .layer.base {
		opacity: 0.2;
		pointer-events: auto;
	}

	/* the avatar/username lingers along with the message */

	section.secret .layer.reveal {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* hidden unless the glass is over it, so a stale mask can't leave
		   the whole comment sitting on the page */
		opacity: 0;
	}

	section.secret .layer.reveal.revealing {
		opacity: 1;
	}
</style>
