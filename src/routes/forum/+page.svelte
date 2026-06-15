<script lang="ts">
	import { readPosts, type Post } from '$lib/postMeta';
	import { playerTrack, viewedPosts, lens } from '$lib/stores';

	playerTrack.set('/sounds/weatherchannel.mp3');

	const posts = readPosts();
	const entries = Object.entries(posts);
	// shown normally, in their natural order...
	const visible = entries.filter(([, post]) => !post.hidden);
	// ...then hidden posts pinned to the bottom, revealed only with the glass
	const hidden = entries.filter(([, post]) => post.hidden);

	// Each hidden post is drawn as two stacked, identical layers:
	//   • linger — the base layer, in normal flow. Hidden until the post has been
	//     found; after that it shows just the title link at 20% (and is clickable).
	//   • reveal — an overlay masked to the lens, showing the whole post. It simply
	//     follows the glass; as the circle leaves the row it fades out via the mask
	//     (no state switch, so no flash), uncovering the lingering title beneath.
	let discovered = $state<Record<string, boolean>>({});
	const revealEls: Record<string, HTMLDivElement> = {};

	// latch a post as found once the lens circle has actually passed over its
	// title link (not just anywhere on the row)
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
			const titleEl = el?.querySelector('.col.title a');
			if (!titleEl) {
				continue;
			}
			const r = titleEl.getBoundingClientRect();
			const nx = Math.max(r.left, Math.min(l.x, r.right));
			const ny = Math.max(r.top, Math.min(l.y, r.bottom));
			if (Math.hypot(l.x - nx, l.y - ny) <= l.r) {
				discovered[path] = true;
			}
		}
	});

	// the lens mask for one reveal overlay, offset by its own box so the reveal
	// circle lines up with the glass
	function maskFor(path: string): string {
		const l = $lens;
		const el = revealEls[path];
		if (!l || !el) {
			return 'opacity:0'; // glass down: hide the overlay, leaving the linger
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
	<div class="col title"><a href={path}>{post.title}</a></div>
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
	/* the post listing — header + visible rows. Both visible and hidden posts
	   use the same .row/.col flex grid below, so every column lines up exactly. */
	.listing {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1px;
		color: white;
	}
	/* gridlines: each cell carries its own background, and the 1px gaps between
	   cells (and rows) let the page show through as thin grid separators */
	.row.head .col {
		background-color: var(--blue);
	}
	.row.post .col {
		background-color: var(--pink);
	}
	.mark-unread {
		background: none;
		border: none;
		outline: none;
		cursor: var(--cur-pointer);
	}

	/* hidden posts: each is a relative box holding the linger + reveal layers */
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
		/* same column gap on every row (head, post, linger, reveal) so all of
		   them line up identically — this is what the gridlines ride in */
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

	/* reveal overlay: the full post on a pink bar, masked to the lens. Purely
	   decorative and never intercepts clicks (so the linger link stays clickable).
	   No opacity transition — the mask alone fades it as the glass moves off. */
	.row.reveal {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* match the listing: cell backgrounds (not a solid bar) so the revealed
	   post shows the same gridlines as the visible rows above */
	.row.reveal .col {
		background-color: var(--pink);
	}

	/* linger base: only the title shows, and only once found — faded to 20% and
	   clickable. The other columns stay present (invisible) to reserve the layout
	   so the two layers line up exactly. */
	.row.linger .col:not(.title) {
		visibility: hidden;
	}
	.row.linger .col.title a {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
	}
	.row.linger.found .col.title a {
		opacity: 0.2;
		pointer-events: auto;
	}
</style>
