<script lang="ts">
	import { computePosition, flip, offset } from '@floating-ui/dom';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import {
		playerTrack,
		playerVolume,
		playerPlaying,
		audioMuffled,
		audioPan,
	} from '$lib/stores';

	let open = $state(false);
	let anchor = $state<HTMLButtonElement>();
	let player = $state<HTMLDivElement>();

	// two mixes, normal and _D, swapped when you grab the magnifier
	type Ctx = AudioContext;
	let audioCtx: Ctx | null = null;
	let masterGain: GainNode | null = null; // volume
	let panner: StereoPannerNode | null = null; // cursor pan
	let gNormal: GainNode | null = null; // normal mix
	let gMuffled: GainNode | null = null; // _D mix

	let bufNormal: AudioBuffer | null = null;
	let bufMuffled: AudioBuffer | null = null; // null when no _D variant
	let srcNormal: AudioBufferSourceNode | null = null;
	let srcMuffled: AudioBufferSourceNode | null = null;

	let playing = false; // sources running?
	let duration = 0;
	let startCtxTime = 0; // ctx time the sources started
	let startOffset = 0; // buffer offset they started from
	let loadToken = 0; // guard against out-of-order loads

	const SWAP = 0.02; // crossfade time (s) for the swap

	// alternate mix url: foo.mp3 -> foo_D.mp3
	function deriveD(url: string): string {
		const i = url.lastIndexOf('.');
		return i === -1 ? `${url}_D` : `${url.slice(0, i)}_D${url.slice(i)}`;
	}

	function ensureCtx() {
		if (audioCtx) {
			return;
		}
		const C =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		const ctx = new C();
		masterGain = ctx.createGain();
		panner = ctx.createStereoPanner();
		gNormal = ctx.createGain();
		gMuffled = ctx.createGain();
		gNormal.gain.value = 1;
		gMuffled.gain.value = 0;
		gNormal.connect(panner);
		gMuffled.connect(panner);
		panner.connect(masterGain).connect(ctx.destination);
		audioCtx = ctx;
		// read volume non-reactively, else a drag restarts the song
		applyVolume(get(playerVolume));
	}

	async function fetchDecode(url: string): Promise<AudioBuffer | null> {
		try {
			const res = await fetch(url);
			if (!res.ok || !audioCtx) {
				return null;
			}
			return await audioCtx.decodeAudioData(await res.arrayBuffer());
		} catch {
			return null; // missing or undecodable, e.g. no _D variant
		}
	}

	async function loadTrack(url: string) {
		ensureCtx();
		bufNormal = null;
		bufMuffled = null;
		const [nb, db] = await Promise.all([
			fetchDecode(url),
			fetchDecode(deriveD(url)),
		]);
		bufNormal = nb;
		bufMuffled = db;
	}

	function currentPos(): number {
		if (!audioCtx || !playing) {
			return startOffset;
		}
		return startOffset + (audioCtx.currentTime - startCtxTime);
	}

	function setMuffleGains(muffled: boolean, instant = false) {
		if (!audioCtx || !gNormal || !gMuffled) {
			return;
		}
		const useD = muffled && !!bufMuffled;
		const t = audioCtx.currentTime;
		const nT = useD ? 0 : 1;
		const dT = useD ? 1 : 0;
		gNormal.gain.cancelScheduledValues(t);
		gMuffled.gain.cancelScheduledValues(t);
		if (instant) {
			gNormal.gain.setValueAtTime(nT, t);
			gMuffled.gain.setValueAtTime(dT, t);
		} else {
			// short crossfade, click-free
			gNormal.gain.setValueAtTime(gNormal.gain.value, t);
			gMuffled.gain.setValueAtTime(gMuffled.gain.value, t);
			gNormal.gain.linearRampToValueAtTime(nT, t + SWAP);
			gMuffled.gain.linearRampToValueAtTime(dT, t + SWAP);
		}
	}

	function startSources() {
		if (!audioCtx || !bufNormal || playing) {
			return;
		}
		duration = bufNormal.duration;
		const off = ((startOffset % duration) + duration) % duration;

		srcNormal = audioCtx.createBufferSource();
		srcNormal.buffer = bufNormal;
		srcNormal.loop = true;
		srcNormal.connect(gNormal!);

		if (bufMuffled) {
			srcMuffled = audioCtx.createBufferSource();
			srcMuffled.buffer = bufMuffled;
			srcMuffled.loop = true;
			srcMuffled.connect(gMuffled!);
		}

		// same instant, same offset so the layers stay locked
		const t = audioCtx.currentTime;
		srcNormal.start(t, off);
		srcMuffled?.start(t, off);
		startCtxTime = t;
		startOffset = off;
		playing = true;
		setMuffleGains($audioMuffled, true);
	}

	function stopSources() {
		if (!playing) {
			return;
		}
		startOffset = currentPos();
		try {
			srcNormal?.stop();
		} catch {
			/* already stopped */
		}
		try {
			srcMuffled?.stop();
		} catch {
			/* already stopped */
		}
		srcNormal = null;
		srcMuffled = null;
		playing = false;
	}

	function applyVolume(v: number) {
		if (!masterGain || !audioCtx) {
			return;
		}
		const val = Math.max(0, Math.pow(0.01, 1 - v) - 0.01);
		masterGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.01);
	}

	// popup positioning
	$effect(() => {
		if (!anchor || !player) {
			return;
		}
		computePosition(anchor, player, {
			placement: 'bottom',
			// portalled + fixed, so resolve against the viewport
			strategy: 'fixed',
			middleware: [flip(), offset({ mainAxis: 8 })],
		}).then(({ x, y }) => {
			if (!player) {
				return;
			}
			Object.assign(player.style, { left: `${x}px`, top: `${y}px` });
		});
	});

	// load + decode both layers on track change
	$effect(() => {
		const url = $playerTrack;
		if (!url) {
			return;
		}
		const token = ++loadToken;
		stopSources();
		startOffset = 0;
		loadTrack(url).then(() => {
			if (token !== loadToken) {
				return; // newer load superseded this
			}
			if ($playerPlaying) {
				audioCtx?.resume();
				startSources();
			}
		});
	});

	// play / pause
	$effect(() => {
		const isPlaying = $playerPlaying;
		ensureCtx();
		if (isPlaying) {
			audioCtx?.resume();
			startSources(); // no-op if buffers not ready, the load effect starts it
		} else {
			stopSources();
		}
	});

	// instrument swap on magnifier grab/release
	$effect(() => {
		const muffled = $audioMuffled;
		setMuffleGains(muffled);
	});

	// cursor stereo pan
	$effect(() => {
		const pan = $audioPan;
		if (!panner || !audioCtx) {
			return;
		}
		panner.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.05);
	});

	$effect(() => {
		applyVolume($playerVolume);
	});

	// iOS needs a node played in a real gesture, so unlock on pointerdown
	onMount(() => {
		const unlock = () => {
			ensureCtx();
			if (!audioCtx) {
				return;
			}
			if (audioCtx.state === 'suspended') {
				audioCtx.resume().catch(() => {});
			}
			try {
				const b = audioCtx.createBuffer(1, 1, 22050);
				const s = audioCtx.createBufferSource();
				s.buffer = b;
				s.connect(audioCtx.destination);
				s.start(0);
			} catch {
				// ignore if the silent ping fails
			}
			// if playback was requested, make sure it's running now
			if ($playerPlaying) {
				startSources();
			}
		};
		window.addEventListener('pointerdown', unlock);
		window.addEventListener('touchstart', unlock);
		window.addEventListener('touchend', unlock);
		return () => {
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('touchstart', unlock);
			window.removeEventListener('touchend', unlock);
		};
	});

	// nav's filter traps position:fixed, so move the popup to <body>
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			},
		};
	}
</script>

<button class="wrapper-btn" bind:this={anchor} onclick={() => (open = !open)}>
	<img src="/icons/music.png" alt="open music player" />
</button>

{#if open}
	<div bind:this={player} class="popup-player" use:portal>
		<button
			class="play-button"
			onclick={() => ($playerPlaying = !$playerPlaying)}
		>
			{!$playerPlaying ? 'play' : 'pause'}
		</button>
		<input
			type="range"
			min="0.01"
			step="0.01"
			max="1.0"
			bind:value={$playerVolume}
		/>
	</div>
{/if}

<style>
	.wrapper-btn {
		cursor: var(--cur-pointer);
		appearance: none;
		background: none;
		outline: none;
		border: none;

		/* 32x32 at 1x, pixel perfect, 1.6rem was blurry */
		& img {
			height: 2rem;
			width: 2rem;
			image-rendering: pixelated;
		}
	}

	.play-button {
		cursor: var(--cur-pointer);
		padding: 0.25rem 0.5rem;
	}

	.popup-player {
		background-color: var(--pink);
		padding: 0.5rem;
		position: fixed;
		top: 0;
		left: 0;
		width: max-content;
		display: flex;
		flex-direction: row;
		gap: 0.25rem;
		align-items: center;
	}
	.popup-player input {
		appearance: auto;
		cursor: var(--cur-pointer);
		/* drag thumb without scrolling the page */
		touch-action: none;
	}
</style>
