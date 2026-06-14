<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { audioMuffled, audioPan, lens } from '$lib/stores';

	// The info / magnifying-glass icon is dual-purpose:
	//  - a quick click navigates to the info page
	//  - holding it picks it up: the icon detaches onto the cursor and grows,
	//    revealing secret text and images masked into a hidden layer beneath it.

	let active = $state(false); // magnifier picked up (a hold, not a click)
	let lensX = $state(0);
	let lensY = $state(0);
	let radius = $state(0); // current reveal radius

	const MAX_RADIUS = 150;
	const ICON_RADIUS = 16; // starting size: roughly the 2rem nav icon's half-width
	const GROW_MS = 130; // quick grow from icon size up to the full lens
	const MAX_PAN = 0.6; // how far the music pans at the screen edges

	let growRaf = 0;

	// animate `radius` toward a target with a snappy ease-out, driving both the
	// lens image and the reveal mask each frame
	function animateRadius(to: number) {
		cancelAnimationFrame(growRaf);
		const from = radius;
		let startTs = 0;
		function step(ts: number) {
			if (!startTs) {
				startTs = ts;
			}
			const t = Math.min(1, (ts - startTs) / GROW_MS);
			const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
			radius = from + (to - from) * e;
			if (t < 1) {
				growRaf = requestAnimationFrame(step);
			}
		}
		growRaf = requestAnimationFrame(step);
	}

	const REVEAL_SCALE = 2 / 3; // reveal radius = icon radius minus a third
	const GLASS_OFFSET = 0.26; // fraction of icon radius to shift up-and-left

	// distinguish a click from a hold
	const HOLD_MS = 160;
	const MOVE_PX = 6;

	let holdTimer = 0;
	let down = false; // pointer is currently down on the icon
	let downX = 0;
	let downY = 0;

	// secrets scattered around the viewport, only visible through the lens.
	// add entries like { top: '40%', left: '50%', text: '...' } or
	// { top: '60%', left: '30%', img: '/icons/whatever.png' }.
	const secrets: { top: string; left: string; text?: string; img?: string }[] =
		[];

	function panFor(x: number) {
		const t = (x / window.innerWidth) * 2 - 1; // -1 .. 1
		return Math.max(-1, Math.min(1, t)) * MAX_PAN;
	}

	function activate() {
		if (active) {
			return;
		}
		active = true;
		radius = ICON_RADIUS; // start at the small icon size...
		animateRadius(MAX_RADIUS); // ...then grow quickly to the full lens
		document.body.style.cursor = 'none';
		audioMuffled.set(true);
		audioPan.set(panFor(lensX));
	}

	function onPointerDown(ev: PointerEvent) {
		ev.preventDefault();
		down = true;
		downX = ev.clientX;
		downY = ev.clientY;
		lensX = ev.clientX;
		lensY = ev.clientY;
		// a press held long enough (without releasing) becomes the magnifier
		clearTimeout(holdTimer);
		holdTimer = window.setTimeout(activate, HOLD_MS);
	}

	function onPointerMove(ev: PointerEvent) {
		if (!down) {
			return;
		}
		lensX = ev.clientX;
		lensY = ev.clientY;
		if (!active && Math.hypot(ev.clientX - downX, ev.clientY - downY) > MOVE_PX) {
			activate();
		}
		if (active) {
			audioPan.set(panFor(lensX));
		}
	}

	function onPointerUp() {
		if (!down) {
			return;
		}
		down = false;
		clearTimeout(holdTimer);

		if (!active) {
			// it was a click — go to the info page
			goto('/info');
			return;
		}

		// drop the magnifier
		cancelAnimationFrame(growRaf);
		active = false;
		radius = 0;
		document.body.style.cursor = '';
		audioMuffled.set(false);
		audioPan.set(0);
	}

	onMount(() => {
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		return () => {
			clearTimeout(holdTimer);
			cancelAnimationFrame(growRaf);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};
	});

	// reveal circle: smaller than the icon and centred on the glass, not the
	// icon's middle (where the cursor — and so lensX/lensY — sits)
	const revealR = $derived(radius * REVEAL_SCALE);
	const revealX = $derived(lensX - radius * GLASS_OFFSET);
	const revealY = $derived(lensY - radius * GLASS_OFFSET);

	const maskCss = $derived(
		`radial-gradient(circle ${revealR}px at ${revealX}px ${revealY}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`
	);

	// publish the lens so page-level secrets can mask themselves to it too
	$effect(() => {
		lens.set(radius > 0 ? { x: revealX, y: revealY, r: revealR } : null);
	});

	// The nav has a `filter`, which makes any descendant `position: fixed`
	// resolve against the nav instead of the viewport. Move the overlay to
	// <body> so it tracks the real cursor and sits above everything.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			},
		};
	}
</script>

<button
	class="search-btn"
	class:held={active}
	onpointerdown={onPointerDown}
	aria-label="info"
	title="info"
>
	<img src="/icons/info.png" alt="info" />
</button>

{#if radius > 0}
	<div use:portal style="display:contents;">
		<!-- hidden layer; only what's under the lens shows through -->
		<div
			class="secrets"
			style="-webkit-mask-image:{maskCss};mask-image:{maskCss};"
			aria-hidden="true"
		>
			{#each secrets as s (s.top + s.left)}
				<div class="secret" style="top:{s.top};left:{s.left};">
					{#if s.img}
						<img src={s.img} alt="" />
					{:else}
						<span>{s.text}</span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- the icon itself, grown and riding the cursor -->
		<img
			class="lens"
			src="/icons/info.png"
			alt=""
			style="left:{lensX}px;top:{lensY}px;width:{radius * 2}px;"
			aria-hidden="true"
		/>
	</div>
{/if}

<style>
	.search-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		outline: none;
		padding: 0;
		cursor: var(--cur-pointer);
	}

	.search-btn.held {
		opacity: 0; /* hidden instantly — the grown lens takes over on the cursor */
	}

	/* 32x32 source → exactly 1x, pixel-perfect nearest-neighbor */
	.search-btn img {
		height: 32px;
		width: 32px;
		image-rendering: pixelated;
	}

	.secrets {
		position: fixed;
		inset: 0;
		z-index: 2147483646;
		pointer-events: none;
	}

	.secret {
		position: absolute;
		transform: translate(-50%, -50%);
		color: #ff79ce;
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-style: italic;
		font-size: 1.1rem;
		text-align: center;
		width: max-content;
		max-width: 16rem;
		text-shadow: 0 0 8px rgba(255, 121, 206, 0.6);
	}

	.secret img {
		max-width: 9rem;
		max-height: 9rem;
		filter: drop-shadow(0 0 10px rgba(255, 121, 206, 0.5));
	}

	.lens {
		position: fixed;
		z-index: 2147483647;
		transform: translate(-50%, -50%);
		pointer-events: none;
		height: auto;
	}
</style>
