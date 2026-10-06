<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { findScene, startScene, type Hotspot } from '$lib/explore';
	import { setAmbient, setAmbientVolume, stopAmbient, playSfx } from '$lib/ambient';
	import { visiblePostPaths } from '$lib/postMeta';
	import {
		exploreScene,
		lens,
		playerPlaying,
		playerVolume,
		viewedPosts
	} from '$lib/stores';

	const first = startScene();
	const saved = get(exploreScene);
	const startId = saved && findScene(saved) ? saved : first.id;
	let currentId = $state(startId);
	let history = $state<string[]>([]);
	let caption = $state<string | null>(null);

	const scene = $derived(findScene(currentId) ?? first);
	const debug = $derived($page.url.searchParams.has('debug'));

	let sceneEl = $state<HTMLDivElement>();
	let missing = $state<Record<string, boolean>>({});

	// scene-1.png becomes scene-1_D.png
	function deriveD(url: string) {
		const i = url.lastIndexOf('.');
		return i === -1 ? `${url}_D` : `${url.slice(0, i)}_D${url.slice(i)}`;
	}

	const dSrc = $derived(deriveD(scene.image));

	// v viewed / n new for each unhidden post, top first
	const paths = visiblePostPaths();
	const lockCode = $derived(
		paths.map((p) => ($viewedPosts[p] ? 'v' : 'n')).join('')
	);

	// hidden layer, only shows through the glass
	function layerMask(): string {
		const l = $lens;
		if (!l || !sceneEl) {
			return 'opacity:0';
		}
		const r = sceneEl.getBoundingClientRect();
		const x = l.x - r.left;
		const y = l.y - r.top;
		const m = `radial-gradient(circle ${l.r}px at ${x}px ${y}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`;
		return `-webkit-mask-image:${m};mask-image:${m}`;
	}

	$effect(() => {
		setAmbientVolume($playerVolume);
	});

	$effect(() => {
		setAmbient(scene.ambient);
	});

	$effect(() => {
		exploreScene.set(currentId);
	});

	// pause the music so it doesn't play over the ambience
	$effect(() => {
		const wasPlaying = get(playerPlaying);
		playerPlaying.set(false);
		return () => {
			if (wasPlaying) {
				playerPlaying.set(true);
			}
		};
	});

	onDestroy(stopAmbient);

	function goTo(id: string) {
		if (id === currentId || !findScene(id)) {
			return;
		}
		history = [...history, currentId];
		currentId = id;
		caption = null;
	}

	function back() {
		if (!history.length) {
			return;
		}
		currentId = history[history.length - 1];
		history = history.slice(0, -1);
		caption = null;
	}

	function pick(h: Hotspot) {
		if (h.sound) {
			playSfx(h.sound);
		}
		if (h.to) {
			return goTo(h.to);
		}
		if (h.back) {
			return back();
		}
		if (h.href) {
			window.open(h.href, '_blank', 'noopener');
			return;
		}
		if (h.text) {
			caption = h.text;
		}
	}
</script>

<svelte:head>
	<title>edenforum — home</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (caption = null)} />

<div class="explore">
	<div
		class="scene"
		bind:this={sceneEl}
		style={scene.aspect ? `aspect-ratio:${scene.aspect}` : undefined}
	>
		<img
			class="frame"
			class:sized={!!scene.aspect}
			src={scene.image}
			alt={scene.alt ?? scene.id}
			draggable="false"
		/>

		{#if !missing[dSrc]}
			<img
				class="layer"
				src={dSrc}
				alt=""
				aria-hidden="true"
				style={layerMask()}
				onerror={() => (missing[dSrc] = true)}
			/>
		{/if}

		{#each scene.hotspots as h, i (i)}
			{@const locked = !!h.code && lockCode.slice(0, h.code.length) !== h.code}
			<button
				class="hotspot"
				class:debug
				disabled={locked}
				style="left:{h.x}%;top:{h.y}%;width:{h.w}%;height:{h.h}%"
				aria-label={h.label ?? h.text ?? 'hotspot'}
				onclick={() => pick(h)}
			>
				{#if debug && h.label}<span>{h.label}</span>{/if}
			</button>
		{/each}
	</div>

	{#if caption}
		<div class="caption" role="status">
			<p>{caption}</p>
			<button class="close" aria-label="dismiss" onclick={() => (caption = null)}>
				×
			</button>
		</div>
	{/if}
</div>

<style>
	.explore {
		position: relative;
	}

	.scene {
		position: relative;
		line-height: 0;
		overflow: hidden;
	}

	.frame {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
		-webkit-user-drag: none;
	}

	.frame.sized {
		position: absolute;
		inset: 0;
		height: 100%;
		object-fit: cover;
	}

	.layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	.hotspot {
		position: absolute;
		padding: 0;
		border: none;
		background: transparent;
		border-radius: 6px;
		cursor: var(--cur-pointer);
	}

	.hotspot:disabled {
		cursor: default;
	}

	.hotspot:focus-visible {
		outline: 1px solid #fff;
		outline-offset: -2px;
	}

	.hotspot.debug {
		outline: 1px solid #ff79ce;
		background: rgba(255, 121, 206, 0.18);
	}

	.hotspot span {
		position: absolute;
		top: 0;
		left: 0;
		font-size: 0.7rem;
		line-height: 1.2;
		padding: 0.15em 0.35em;
		color: #fff;
		background: rgba(0, 0, 0, 0.7);
		white-space: nowrap;
	}

	.caption {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.75em;
		width: max-content;
		max-width: 85%;
		padding: 0.6em 0.9em;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.8);
		color: #fff;
	}

	.caption p {
		margin: 0;
	}

	.close {
		background: none;
		border: none;
		padding: 0;
		color: #fff;
		cursor: var(--cur-pointer);
	}
</style>
