<script lang="ts">
	import { readPosts, type Post } from '$lib/postMeta';
	import { playerTrack, viewedPosts, lens } from '$lib/stores';
	import Secret from '$lib/secret.svelte';

	playerTrack.set('/sounds/weatherchannel.mp3');

	const posts = readPosts();
	const entries = Object.entries(posts);
	const visible = entries.filter(([, post]) => !post.hidden);
	// hidden posts, shh
	const hidden = entries.filter(([, post]) => post.hidden);

	// lens discovery state
	let discovered = $state<Record<string, boolean>>({});
	const revealEls: Record<string, HTMLDivElement> = {};

	// latch post as found once lens hits its title link
	$effect(() => {
		const l = $lens;
		if (!l) {
			return;
		}
		for (const [path] of hidden) {
			if (discovered[path]) {
				continue;
			}
			const el = revealEls[path];
			if (!el) {
				continue;
			}
			const r = el.getBoundingClientRect();
			const nx = Math.max(r.left, Math.min(l.x, r.right));
			const ny = Math.max(r.top, Math.min(l.y, r.bottom));
			if (Math.hypot(l.x - nx, l.y - ny) <= l.r) {
				discovered[path] = true;
			}
		}
	});

	// reveal overlay mask, offset so circle lines up with glass
	function maskFor(path: string): string {
		const l = $lens;
		const el = revealEls[path];
		if (!l || !el) {
			return 'opacity:0'; // glass down: hide overlay keep linger
		}
		const r = el.getBoundingClientRect();
		const x = l.x - r.left;
		const y = l.y - r.top;
		const m = `radial-gradient(circle ${l.r}px at ${x}px ${y}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`;
		return `-webkit-mask-image:${m};mask-image:${m}`;
	}
</script>

<div class="listing">
	<div class="row head">
		<div class="col new">new</div>
		<div class="col title">title</div>
		<div class="col date">date posted</div>
		<div class="col comments">comments</div>
	</div>

	{#each visible as [path, post] (path)}
		<div class="row post">
			{@render cols(path, post)}
		</div>
	{/each}
</div>

{#snippet cols(path: string, post: Post)}
	<div class="col new">
		{#if !$viewedPosts[path]}
			<img src="/icons/post_new.png" alt="unread" />
		{:else}
			<button
				class="mark-unread"
				onclick={() => ($viewedPosts[path] = false)}
			>
				<img src="/icons/post_viewed.png" alt="mark as unread" />
			</button>
		{/if}
	</div>
	<div class="col title">
		<a href={post.hidden && !discovered[path] ? undefined : path}>
			{#if post.hidden}
				<Secret value={post.title} shown={discovered[path]} placeholder="…" />
			{:else}
				{post.title}
			{/if}
		</a>
	</div>
	<div class="col date">{post.date}</div>
	<div class="col comments">{post.comments}</div>
{/snippet}

{#if hidden.length}
	<div class="secrets">
		{#each hidden as [path, post] (path)}
			<div class="secret">
				<!-- base layer: the lingering 20% title once found -->
				<div class="row linger" class:found={discovered[path]}>
					{@render cols(path, post)}
				</div>
				<!-- overlay: the whole post, revealed through the lens -->
				<div
					class="row reveal"
					class:revealing={!!$lens}
					bind:this={revealEls[path]}
					style={maskFor(path)}
					aria-hidden="true"
				>
					{@render cols(path, post)}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.listing {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1px;
		color: white;
	}
	/* gridlines */
	.row.head .col {
		background-color: var(--blue);
	}
	.row.post .col {
		background-color: var(--pink);
	}
	.mark-unread {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		outline: none;
		cursor: var(--cur-pointer);
	}

	/* hidden posts */
	.secrets {
		margin-top: 1px;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.secret {
		position: relative;
	}

	.row {
		display: flex;
		width: 100%;
		gap: 1px;
	}
	.row .col {
		padding: 0.5em;
		text-align: center;
		color: rgb(207, 121, 181);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.row .col.new {
		flex: 0 0 4rem;
	}
	.row .col.new img {
		display: block;
	}
	.row .col.title {
		flex: 1;
	}
	.row .col.date {
		flex: 0 0 12rem;
	}
	.row .col.comments {
		flex: 0 0 6rem;
	}
	.row a {
		color: rgb(207, 121, 181);
	}


	.row.reveal {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* stay hidden unless the glass is actually revealing it, so a
		   missing/stale mask can't leave a solid bar behind */
		opacity: 0;
	}
	.row.reveal.revealing {
		opacity: 1;
	}
	.row.reveal .col {
		background-color: var(--pink);
	}

	/* magnifier linger */
	.row.linger .col:not(.title):not(.new) {
		visibility: hidden;
	}
	.row.linger .col.title a,
	.row.linger .col.new {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
		/* keep one stable layer so the pixel-art flower isn't
		   re-rasterized (and resized) when the fade starts */
		will-change: opacity;
	}
	.row.linger.found .col.title a,
	.row.linger.found .col.new {
		opacity: 0.2;
		pointer-events: auto;
	}
</style>
