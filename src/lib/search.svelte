<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { audioMuffled, audioPan, lens, scrollY } from '$lib/stores';

	// click goes to info, hold picks up the magnifier

	let active = $state(false); // magnifier held, not clicked
	let lensX = $state(0);
	let lensY = $state(0);
	let radius = $state(0); // current reveal radius

	const MAX_RADIUS = 150;
	const ICON_RADIUS = 16; // start size, ~half the 2rem icon
	const GROW_MS = 130; // grow time to full lens
	const MAX_PAN = 0.6; // max pan at screen edges

	let growRaf = 0;

	// ease radius toward target, drives lens and mask each frame
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

	const REVEAL_SCALE = 2 / 3; // reveal radius, slightly smaller than icon
	const GLASS_OFFSET = 0.26; // shift glass up-left, fraction of radius

	// edge auto-scroll while the glass is held: the top 20% of the screen
	// scrolls up, the bottom 20% scrolls down (speed ramps toward the edge)
	const EDGE = 0.2;
	const MAX_SCROLL = 16; // px per frame at the very edge
	let scrollRaf = 0;

	function scrollStep() {
		if (!active) {
			scrollRaf = 0;
			return;
		}
		const h = window.innerHeight;
		const top = h * EDGE;
		const bottom = h * (1 - EDGE);
		let dir = 0;
		if (lensY < top) {
			dir = -1;
		} else if (lensY > bottom) {
			dir = 1;
		}
		if (dir !== 0) {
			const depth =
				dir < 0 ? (top - lensY) / top : (lensY - bottom) / (h - bottom);
			const speed = Math.min(1, Math.max(0, depth)) * MAX_SCROLL;
			window.scrollBy(0, dir * speed);
		}
		scrollRaf = requestAnimationFrame(scrollStep);
	}

	// click vs hold
	const HOLD_MS = 160;
	const MOVE_PX = 6;

	let holdTimer = 0;
	let down = false; // pointer down on icon
	let downX = 0;
	let downY = 0;

	// secrets only visible through the lens; entries like { top, left, text }
	const secrets: {
		top: string;
		left: string;
		text?: string;
		img?: string;
	}[] = [];

	function panFor(x: number) {
		const t = (x / window.innerWidth) * 2 - 1; // -1 .. 1
		return Math.max(-1, Math.min(1, t)) * MAX_PAN;
	}

	function activate() {
		if (active) {
			return;
		}
		active = true;
		radius = ICON_RADIUS; // start small
		animateRadius(MAX_RADIUS); // then grow to full lens
		document.body.style.cursor = 'none';
		audioMuffled.set(true);
		audioPan.set(panFor(lensX));
		scrollRaf = requestAnimationFrame(scrollStep); // edge auto-scroll
	}

	function onPointerDown(ev: PointerEvent) {
		ev.preventDefault();
		down = true;
		downX = ev.clientX;
		downY = ev.clientY;
		lensX = ev.clientX;
		lensY = ev.clientY;
		// hold long enough to pick up the magnifier
		clearTimeout(holdTimer);
		holdTimer = window.setTimeout(activate, HOLD_MS);
	}

	function onPointerMove(ev: PointerEvent) {
		if (!down) {
			return;
		}
		lensX = ev.clientX;
		lensY = ev.clientY;
		if (
			!active &&
			Math.hypot(ev.clientX - downX, ev.clientY - downY) > MOVE_PX
		) {
			activate();
		}
		if (active) {
			audioPan.set(panFor(lensX));
		}
	}

	// put the magnifier down without treating it as a click
	function drop() {
		cancelAnimationFrame(growRaf);
		cancelAnimationFrame(scrollRaf);
		scrollRaf = 0;
		active = false;
		radius = 0;
		document.body.style.cursor = '';
		audioMuffled.set(false);
		audioPan.set(0);
	}

	function onPointerUp() {
		if (!down) {
			return;
		}
		down = false;
		clearTimeout(holdTimer);

		if (!active) {
			// click, go to info page
			goto('/info');
			return;
		}

		// drop the magnifier
		drop();
	}

	// if the browser steals the gesture (scroll, context menu, tab switch)
	// pointerup never arrives, so the lens would stay stuck on. drop it here.
	function onPointerCancel() {
		down = false;
		clearTimeout(holdTimer);
		if (active) {
			drop();
		}
	}

	onMount(() => {
		const onScroll = () => scrollY.set(window.scrollY);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerCancel);
		window.addEventListener('blur', onPointerCancel);
		return () => {
			clearTimeout(holdTimer);
			cancelAnimationFrame(growRaf);
			cancelAnimationFrame(scrollRaf);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerCancel);
			window.removeEventListener('blur', onPointerCancel);
		};
	});

	// reveal centered on the glass, not the cursor
	const revealR = $derived(radius * REVEAL_SCALE);
	const revealX = $derived(lensX - radius * GLASS_OFFSET);
	const revealY = $derived(lensY - radius * GLASS_OFFSET);

	const maskCss = $derived(
		`radial-gradient(circle ${revealR}px at ${revealX}px ${revealY}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`
	);

	// share the lens so page secrets can mask too
	$effect(() => {
		// touch the scroll store so the lens is re-published (new object) as
		// the page auto-scrolls, letting masks re-measure under the fixed glass
		void $scrollY;
		lens.set(radius > 0 ? { x: revealX, y: revealY, r: revealR } : null);
	});

	// nav's filter traps position:fixed, so move to <body>
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
		/* holds still read as scroll without this, lens never grabs on touch */
		touch-action: none;
	}

	.search-btn.held {
		opacity: 0; /* hidden, grown lens takes over */
	}

	/* 2rem = 32px, 1x the source */
	.search-btn img {
		height: 2rem;
		width: 2rem;
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
