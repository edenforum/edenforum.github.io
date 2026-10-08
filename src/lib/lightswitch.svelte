<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { lightsOn, playerPlaying, playerVolume } from '$lib/stores';

	// same volume curve as the music player, so the intro tracks the slider
	function curve(v: number) {
		return Math.max(0, Math.pow(0.01, 1 - v) - 0.01);
	}

	// rope physics for the lightswitch

	let canvas = $state<HTMLCanvasElement>();

	// rope
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
	let armed = false; // pulled past the line waiting on release

	let lit = $state(false); // lights on: reveal site while cord retracts
	let retracting = false; // cord flying up off screen
	let retractSpeed = 0;

	// room ambience
	let roomAudio: HTMLAudioElement | null = null;

	function stopRoom() {
		if (roomAudio) {
			roomAudio.pause();
			roomAudio = null;
		}
	}

	// crossfaded loop for the cord pull
	let audioCtx: AudioContext | null = null;
	let bedBuffer: AudioBuffer | null = null;
	let masterGain: GainNode | null = null;
	let bedTimer = 0;
	let bedStarted = false;
	const BED_XFADE = 1.5; 
	const BED_MAX_VOL = 0.6; // max volume when pulled all the way

	const GRAVITY = 0.9;
	const FRICTION = 0.98;
	const CONSTRAINT_ITERS = 24;
	const GRAB_RADIUS = 70;
	// drop below rest length needed to click on
	const PULL_TRIGGER = 100;

	function bead() {
		return points[points.length - 1];
	}

	function resetRope(w: number) {
		// switch lives here!!
		const contentW = Math.min(w, 16 * 50);
		const leftBlank = Math.max(0, (w - contentW) / 2);
		anchorX = Math.max(48, leftBlank / 2);
		anchorY = 0;
		segLen = 14;
		restLength = SEGMENTS * segLen;
		// spawn off to the side so it swings in
		const swingAngle = 1.5; // radians off vertical
		const dx = -Math.sin(swingAngle) * segLen;
		const dy = Math.cos(swingAngle) * segLen;
		points = [];
		for (let i = 0; i <= SEGMENTS; i++) {
			const x = anchorX + i * dx;
			const y = anchorY + i * dy;
			points.push({ x, y, px: x, py: y });
		}
	}

	// click sound panned for immersion
	function playClick() {
		try {
			const AudioCtx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			const ctx = new AudioCtx();
			const click = new Audio('/sounds/switch.mp3');
			click.volume = curve(get(playerVolume));
			const src = ctx.createMediaElementSource(click);
			const pan = ctx.createStereoPanner();
			pan.pan.value = -0.1; // slightly left
			src.connect(pan).connect(ctx.destination);
			click.play().catch(() => {});
			click.onended = () => ctx.close();
		} catch {
		}
	}

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
		}
	}

	// keep the loop seamless
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
			// fade in and out
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
			bedTimer = window.setTimeout(scheduleVoice, (dur - xf) * 1000);
		}
		scheduleVoice();
	}

	// pull volume
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
			target = p * p * BED_MAX_VOL * curve(get(playerVolume)); // slow start then swell
		}
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

		// kill ambience
		stopRoom();

		playerPlaying.set(true);
		// reveal site
		lit = true;
		retracting = true;
		// yank the light up
		retractSpeed = 1;
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

		// warm up the audio
		ensureBed();

		// start room tone
		roomAudio = new Audio('/sounds/room.mp3');
		roomAudio.loop = true;
		roomAudio.volume = curve(get(playerVolume));
		const startRoom = () => {
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
				// start the reverb
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

			// past the line but not released
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
			// released lights on
			if (armed) {
				trigger();
			}
		}

		function step() {
			// fly the anchor up
			if (retracting) {
				retractSpeed = Math.min(retractSpeed + 0.6, 22);
				anchorY -= retractSpeed;
			}

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

			// pin bead to cursor
			let grabX = pointerX;
			let grabY = pointerY;
			if (dragging) {
				// give the pull some slack
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

			// recoil
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

			// ceiling mount
			ctx.fillStyle = '#f7a8c0';
			ctx.fillRect(anchorX - 14, anchorY, 28, 8);

			ctx.lineWidth = 3;
			ctx.lineCap = 'round';
			ctx.strokeStyle = '#ffc2d4';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.stroke();

			// pull handle
			const b = bead();
			const prev = points[points.length - 2];
			const angle = Math.atan2(b.x - prev.x, b.y - prev.y);
			const big = hovering || dragging;
			const hw = (big ? 18 : 15) / 2;
			const hh = big ? 40 : 34;
			ctx.fillStyle = '#ffc2d4';
			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(-angle); // 0 is straight down so handle hangs along cord
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
			// unmount once site is revealed
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
		/* stop cord-pull from scrolling the page */
		touch-action: none;
	}
</style>
