<script lang="ts">
	import { onMount } from 'svelte';
	import { lightsOn, playerPlaying } from '$lib/stores';

	// A physical pull-cord. The cord is simulated as a verlet rope: a chain of
	// point masses joined by stiff distance constraints, pinned to the ceiling.
	// Pull the bead down past the trigger line — it clicks — then release to
	// switch the lights on.

	let canvas = $state<HTMLCanvasElement>();

	// rope state, kept outside of runes (mutated every frame, never rendered)
	type Point = { x: number; y: number; px: number; py: number };
	let points: Point[] = [];
	const SEGMENTS = 16;
	let segLen = 14;
	let restLength = SEGMENTS * segLen;

	let anchorX = 0;
	let anchorY = 0;

	let dragging = false;
	let pointerX = 0;
	let pointerY = 0;
	let hovering = false;
	let triggered = false;
	let armed = false; // pulled past the line and "clicked"; waiting for release

	let lit = $state(false); // lights on: reveal the site while the cord retracts
	let retracting = false; // cord is flying up off the top of the screen
	let retractSpeed = 0;

	// ambient room tone — loops continuously while the lights are off (the dark
	// intro), then stops the instant the cord is released and the lights come on
	let roomAudio: HTMLAudioElement | null = null;

	function stopRoom() {
		if (roomAudio) {
			roomAudio.pause();
			roomAudio = null;
		}
	}

	// --- reverb bed -----------------------------------------------------------
	// introreverb.wav loops infinitely via crossfade for the whole sequence. Its
	// volume starts at 0 and swells with how far the cord is pulled, then snaps
	// back to 0 with a fast release the moment the cord is let go.
	let audioCtx: AudioContext | null = null;
	let bedBuffer: AudioBuffer | null = null;
	let masterGain: GainNode | null = null;
	let bedTimer = 0; // setTimeout handle for scheduling the next crossfade voice
	let bedStarted = false;
	const BED_XFADE = 1.5; // seconds of overlap between successive loop voices
	const BED_MAX_VOL = 0.8; // ceiling when the cord is pulled all the way

	const GRAVITY = 0.9;
	const FRICTION = 0.98;
	const CONSTRAINT_ITERS = 24;
	const GRAB_RADIUS = 70;
	// how far below its resting length the bead must travel to click "on"
	const PULL_TRIGGER = 150;

	function bead() {
		return points[points.length - 1];
	}

	function resetRope(w: number) {
		// hang in the blank space to the left of the centred content column
		const contentW = Math.min(w, 16 * 50); // matches main's 50rem max-width
		const leftBlank = Math.max(0, (w - contentW) / 2);
		anchorX = Math.max(48, leftBlank / 2);
		anchorY = 0;
		segLen = 14;
		restLength = SEGMENTS * segLen;
		// spawn angled up-and-to-the-left of the anchor so gravity swings the
		// cord down into its resting vertical position when the site opens.
		// px/py == x/y means no initial velocity — the swing comes purely from
		// gravity acting on the offset rest pose.
		const swingAngle = 0.5; // radians from vertical, toward the left
		const dx = -Math.sin(swingAngle) * segLen;
		const dy = Math.cos(swingAngle) * segLen;
		points = [];
		for (let i = 0; i <= SEGMENTS; i++) {
			const x = anchorX + i * dx;
			const y = anchorY + i * dy;
			points.push({ x, y, px: x, py: y });
		}
	}

	// the switch "click" — plays switch.mp3 from the sounds folder, panned 30%
	// to the left (routed through WebAudio since <audio> can't pan on its own)
	function playClick() {
		try {
			const AudioCtx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			const ctx = new AudioCtx();
			const click = new Audio('/sounds/switch.mp3');
			const src = ctx.createMediaElementSource(click);
			const pan = ctx.createStereoPanner();
			pan.pan.value = -0.1; // 30% left
			src.connect(pan).connect(ctx.destination);
			click.play().catch(() => {});
			click.onended = () => ctx.close();
		} catch {
			// ignore — audio is a nicety, not a requirement
		}
	}

	// create the context (suspended is fine) and preload + decode the loop
	async function ensureBed() {
		if (audioCtx) {
			return;
		}
		try {
			const AudioCtx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			audioCtx = new AudioCtx();
			masterGain = audioCtx.createGain();
			masterGain.gain.value = 0;
			masterGain.connect(audioCtx.destination);
			const res = await fetch('/sounds/introreverb.wav');
			bedBuffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
		} catch {
			// audio is a nicety — if it fails, the switch still works silently
		}
	}

	// schedule overlapping voices of the same buffer so it loops with no seam:
	// each voice fades in over BED_XFADE and fades out over BED_XFADE, and the
	// next voice is queued to begin its fade-in just as this one starts fading out
	function startBed() {
		if (!audioCtx || !bedBuffer || bedStarted) {
			return;
		}
		bedStarted = true;
		const dur = bedBuffer.duration;
		const xf = Math.min(BED_XFADE, dur / 2);

		function scheduleVoice() {
			if (!audioCtx || !bedBuffer || !bedStarted || !masterGain) {
				return;
			}
			const now = audioCtx.currentTime;
			const src = audioCtx.createBufferSource();
			src.buffer = bedBuffer;
			const g = audioCtx.createGain();
			src.connect(g).connect(masterGain);
			// crossfade envelope: in over xf, hold, out over xf
			g.gain.setValueAtTime(0, now);
			g.gain.linearRampToValueAtTime(1, now + xf);
			g.gain.setValueAtTime(1, now + dur - xf);
			g.gain.linearRampToValueAtTime(0, now + dur);
			src.start(now);
			src.stop(now + dur + 0.05);
			src.onended = () => {
				src.disconnect();
				g.disconnect();
			};
			// next voice begins xf before this one ends, so the fades overlap
			bedTimer = window.setTimeout(scheduleVoice, (dur - xf) * 1000);
		}
		scheduleVoice();
	}

	// drive the bed volume from how far the cord is pulled. While pulling, swell
	// toward the ceiling (eased so it grows gently); once released or triggered,
	// chase 0 with a short time-constant for a fast release.
	function updateBedVolume() {
		if (!audioCtx || !masterGain) {
			return;
		}
		const pulling = (dragging || armed) && !triggered;
		let target = 0;
		if (pulling) {
			const restY = anchorY + restLength;
			const pull = (bead().y - restY) / PULL_TRIGGER;
			const p = Math.max(0, Math.min(1, pull));
			target = p * p * BED_MAX_VOL; // ease-in: slow at first, then swells
		}
		// short tau while pulling for a responsive swell; even shorter on release
		const tau = pulling ? 0.12 : 0.04;
		masterGain.gain.setTargetAtTime(target, audioCtx.currentTime, tau);
	}

	function teardownBed() {
		bedStarted = false;
		if (bedTimer) {
			clearTimeout(bedTimer);
			bedTimer = 0;
		}
		const ctx = audioCtx;
		if (ctx && masterGain) {
			// quick fade to silence before closing, so it doesn't cut off harshly
			masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
			window.setTimeout(() => ctx.close().catch(() => {}), 400);
		}
		audioCtx = null;
		masterGain = null;
		bedBuffer = null;
	}

	function trigger() {
		if (triggered) {
			return;
		}
		triggered = true;
		dragging = false;
		hovering = false;

		// the lights are coming on — kill the ambient room tone immediately
		stopRoom();

		// the pull is a genuine user gesture, so autoplay is permitted
		playerPlaying.set(true);
		// reveal the lit site immediately, then draw the cord up off-screen
		lit = true;
		retracting = true;
		// kick off with real momentum so it reads as a fling, not a slow lift
		retractSpeed = 9;
	}

	onMount(() => {
		const cv = canvas!;
		const ctx = cv.getContext('2d')!;
		let raf = 0;
		let dpr = 1;

		function size() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			cv.width = window.innerWidth * dpr;
			cv.height = window.innerHeight * dpr;
			cv.style.width = window.innerWidth + 'px';
			cv.style.height = window.innerHeight + 'px';
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			resetRope(window.innerWidth);
		}
		size();

		// preload + decode the reverb bed now (context stays suspended until a
		// real user gesture starts it on pointer-down)
		ensureBed();

		// start the looping ambient room tone for the dark intro. Browsers block
		// audio before any user gesture, so if autoplay is refused we kick it off
		// on the first pointer interaction (still well before the cord is released).
		roomAudio = new Audio('/sounds/room.mp3');
		roomAudio.loop = true;
		const startRoom = () => {
			// don't restart once the lights are already on
			roomAudio?.play().catch(() => {});
		};
		startRoom();
		const kickRoom = () => {
			startRoom();
			window.removeEventListener('pointerdown', kickRoom);
		};
		window.addEventListener('pointerdown', kickRoom);

		function localPointer(ev: PointerEvent) {
			const r = cv.getBoundingClientRect();
			pointerX = ev.clientX - r.left;
			pointerY = ev.clientY - r.top;
		}

		function onDown(ev: PointerEvent) {
			localPointer(ev);
			const b = bead();
			if (Math.hypot(pointerX - b.x, pointerY - b.y) <= GRAB_RADIUS) {
				dragging = true;
				cv.setPointerCapture(ev.pointerId);
				// grabbing the cord is a genuine gesture — wake the audio and
				// kick off the infinite crossfade loop (still silent until pulled)
				audioCtx?.resume?.();
				startBed();
			}
		}

		function onMove(ev: PointerEvent) {
			localPointer(ev);
			const b = bead();
			hovering =
				!dragging &&
				Math.hypot(pointerX - b.x, pointerY - b.y) <= GRAB_RADIUS;

			// pulled past the line: it clicks, and arms. Lights wait for release.
			if (
				dragging &&
				!armed &&
				pointerY >= anchorY + restLength + PULL_TRIGGER
			) {
				armed = true;
				playClick();
			}
		}

		function onUp() {
			dragging = false;
			// releasing after the click is what actually switches the lights on
			if (armed) {
				trigger();
			}
		}

		function step() {
			// after the pull, draw the anchor up so the whole cord slides offscreen
			if (retracting) {
				retractSpeed = Math.min(retractSpeed + 0.6, 22);
				anchorY -= retractSpeed;
			}

			// integrate. Gravity is off while retracting so the soft cord follows
			// the rising anchor up instead of sagging back down off-screen.
			const gravity = retracting ? 0 : GRAVITY;
			for (let i = 1; i < points.length; i++) {
				const p = points[i];
				const vx = (p.x - p.px) * FRICTION;
				const vy = (p.y - p.py) * FRICTION;
				p.px = p.x;
				p.py = p.y;
				p.x += vx;
				p.y += vy + gravity;
			}

			// pinned bead follows the cursor while held (keeps release velocity),
			// but clamped so it can't be dragged past a hard reach limit. We
			// compute the clamped target once here and reuse it when the constraint
			// loop re-pins the bead below — otherwise the raw cursor would win and
			// the cord would keep stretching past the line.
			let grabX = pointerX;
			let grabY = pointerY;
			if (dragging) {
				// allow a bit of overshoot past the trigger line so the pull has some
				// give after it clicks, but still cap it so it can't stretch forever
				const maxReach = restLength + PULL_TRIGGER + 40;
				const dx = grabX - anchorX;
				const dy = grabY - anchorY;
				const dist = Math.hypot(dx, dy);
				if (dist > maxReach) {
					grabX = anchorX + (dx / dist) * maxReach;
					grabY = anchorY + (dy / dist) * maxReach;
				}
				const b = bead();
				b.x = grabX;
				b.y = grabY;
			}

			// satisfy constraints. While retracting we use a moderate stiffness so
			// the stretched cord pings back to length with a visible recoil —
			// quicker than a slow ease, but not an instant one-frame snap.
			const iters = retracting ? 3 : CONSTRAINT_ITERS;
			const stiff = retracting ? 0.2 : 1;
			for (let k = 0; k < iters; k++) {
				points[0].x = anchorX;
				points[0].y = anchorY;
				for (let i = 0; i < points.length - 1; i++) {
					const a = points[i];
					const b = points[i + 1];
					const dx = b.x - a.x;
					const dy = b.y - a.y;
					const d = Math.hypot(dx, dy) || 0.0001;
					const diff = ((d - segLen) / d) * stiff;
					const ma = i === 0 ? 0 : 0.5;
					const mb = 0.5 + (i === 0 ? 0.5 : 0);
					a.x += dx * diff * ma;
					a.y += dy * diff * ma;
					b.x -= dx * diff * mb;
					b.y -= dy * diff * mb;
				}
				if (dragging) {
					const b = bead();
					b.x = grabX;
					b.y = grabY;
				}
			}
		}

		function draw() {
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

			// ceiling mount — sits at the anchor, so it slides up on retract and
			// the rest of the cord trails after it with physics
			ctx.fillStyle = '#f7a8c0';
			ctx.fillRect(anchorX - 14, anchorY, 28, 8);

			// cord
			ctx.lineWidth = 3;
			ctx.lineCap = 'round';
			ctx.strokeStyle = '#ffc2d4';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.stroke();

			// rectangular pull handle, hanging from the end of the cord and
			// rotated to continue the direction of the cord's final segment
			const b = bead();
			const prev = points[points.length - 2];
			const angle = Math.atan2(b.x - prev.x, b.y - prev.y);
			const big = hovering || dragging;
			const hw = (big ? 18 : 15) / 2;
			const hh = big ? 40 : 34;
			ctx.fillStyle = '#ffc2d4';
			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(-angle); // 0 = straight down, so the handle hangs along the cord
			ctx.fillRect(-hw, 0, hw * 2, hh);
			ctx.restore();

			cv.style.cursor = dragging
				? 'grabbing'
				: hovering
					? 'grab'
					: 'default';
		}

		function loop() {
			step();
			draw();
			updateBedVolume();
			// once the trailing handle has cleared the top, the cord is gone —
			// unmount the overlay (with a safety fallback if it lingers)
			if (retracting && (bead().y < -60 || anchorY < -1600)) {
				lightsOn.set(true);
				teardownBed();
				return;
			}
			raf = requestAnimationFrame(loop);
		}

		cv.addEventListener('pointerdown', onDown);
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('resize', size);
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			cv.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('resize', size);
			window.removeEventListener('pointerdown', kickRoom);
			teardownBed();
			stopRoom();
		};
	});
</script>

<div class="lightswitch" class:lit aria-hidden="true">
	<div class="darkness"></div>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.lightswitch {
		position: fixed;
		inset: 0;
		z-index: 9999;
		overflow: hidden;
	}

	/* lights on: the site shows through and is clickable while the cord
	   finishes whipping off-screen */
	.lightswitch.lit {
		pointer-events: none;
	}

	.darkness {
		position: absolute;
		inset: 0;
		background: #0b0b0d;
	}

	.lightswitch.lit .darkness {
		display: none;
	}

	canvas {
		position: absolute;
		inset: 0;
	}
</style>
