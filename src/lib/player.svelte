<script lang="ts">
	import { computePosition, flip, offset } from '@floating-ui/dom';
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

	// --- audio engine --------------------------------------------------------
	// The track plays as two perfectly-synced layers: the normal mix and an
	// alternate "_D" mix (same song, different instruments). Both are decoded to
	// buffers and started at the same sample offset off the same AudioContext
	// clock, so they stay sample-locked forever (no drift, no phasing). Grabbing
	// the magnifying glass crossfades the audible layer between the two over a
	// few ms — a completely seamless instrument swap rather than a filter.
	type Ctx = AudioContext;
	let audioCtx: Ctx | null = null;
	let masterGain: GainNode | null = null; // volume
	let panner: StereoPannerNode | null = null; // cursor-driven pan
	let gNormal: GainNode | null = null; // audible when not muffled
	let gMuffled: GainNode | null = null; // audible when muffled (the _D mix)

	let bufNormal: AudioBuffer | null = null;
	let bufMuffled: AudioBuffer | null = null; // null if the track has no _D variant
	let srcNormal: AudioBufferSourceNode | null = null;
	let srcMuffled: AudioBufferSourceNode | null = null;

	let playing = false; // are buffer sources currently running
	let duration = 0;
	let startCtxTime = 0; // ctx time when the current sources started
	let startOffset = 0; // buffer offset they started from (for pause/resume)
	let loadToken = 0; // guards against out-of-order async track loads

	const SWAP = 0.02; // crossfade time (s) for the seamless instrument swap

	// derive the alternate mix url: weatherchannel.mp3 -> weatherchannel_D.mp3
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
		applyVolume($playerVolume);
	}

	async function fetchDecode(url: string): Promise<AudioBuffer | null> {
		try {
			const res = await fetch(url);
			if (!res.ok || !audioCtx) {
				return null;
			}
			return await audioCtx.decodeAudioData(await res.arrayBuffer());
		} catch {
			return null; // missing/undecodable (e.g. no _D variant) — handled gracefully
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
			// short crossfade so the swap is click-free yet effectively instant
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

		// start both at the same instant + same offset → sample-locked layers
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
			middleware: [flip(), offset({ mainAxis: 8 })],
		}).then(({ x, y }) => {
			if (!player) {
				return;
			}
			Object.assign(player.style, { left: `${x}px`, top: `${y}px` });
		});
	});

	// load (and decode both layers of) the current track when it changes
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
				return; // a newer track load superseded this one
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
			startSources(); // no-op if buffers aren't ready yet; the load effect starts it
		} else {
			stopSources();
		}
	});

	// seamless instrument swap when the magnifying glass is grabbed / released
	$effect(() => {
		const muffled = $audioMuffled;
		setMuffleGains(muffled);
	});

	// cursor-driven stereo pan
	$effect(() => {
		const pan = $audioPan;
		if (!panner || !audioCtx) {
			return;
		}
		panner.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.05);
	});

	// volume slider
	$effect(() => {
		applyVolume($playerVolume);
	});
</script>

<button class="wrapper-btn" bind:this={anchor} onclick={() => (open = !open)}>
	<img src="/icons/music.png" alt="open music player" />
</button>

{#if open}
	<div bind:this={player} class="popup-player">
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

		/* 32x32 source → exactly 1x, pixel-perfect nearest-neighbor
		   (was 1.6rem = 25.6px, a fractional scale that blurred it) */
		& img {
			height: 32px;
			width: 32px;
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
	}
</style>
