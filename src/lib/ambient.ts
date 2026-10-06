// per scene ambient loops, crossfade over FADE seconds

const FADE = 0.5;
const SFX_VOLUME = 0.8;

type Voice = { source: AudioBufferSourceNode; gain: GainNode; src: string };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const failed = new Set<string>();
const sfxFailed = new Set<string>();
let voice: Voice | null = null;
let wanted: string | undefined;
let loading = false;
let armed = false;
let volume = 0.8;

// same volume curve as the music player
function curve(v: number) {
	return Math.max(0, Math.pow(0.01, 1 - v) - 0.01);
}

export function setAmbientVolume(v: number) {
	volume = v;
	if (master && ctx) {
		master.gain.setTargetAtTime(curve(v), ctx.currentTime, 0.02);
	}
}

function context(): AudioContext | null {
	if (ctx) {
		return ctx;
	}
	if (typeof window === 'undefined') {
		return null;
	}
	const Ctor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!Ctor) {
		return null;
	}
	ctx = new Ctor();
	master = ctx.createGain();
	master.gain.value = curve(volume);
	master.connect(ctx.destination);
	return ctx;
}

// browsers block audio until a gesture
function wake() {
	if (!ctx) {
		return;
	}
	if (ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
	}
	try {
		const ping = ctx.createBufferSource();
		ping.buffer = ctx.createBuffer(1, 1, 22050);
		ping.connect(ctx.destination);
		ping.start(0);
	} catch {
		// best effort
	}
}

function unlock() {
	wake();
	setAmbient(wanted);
}

function arm() {
	if (armed || typeof window === 'undefined') {
		return;
	}
	armed = true;
	const off = () => {
		window.removeEventListener('pointerdown', off);
		window.removeEventListener('touchstart', off);
		window.removeEventListener('touchend', off);
		unlock();
	};
	window.addEventListener('pointerdown', off);
	window.addEventListener('touchstart', off);
	window.addEventListener('touchend', off);
}

async function load(c: AudioContext, src: string) {
	const cached = buffers.get(src);
	if (cached) {
		return cached;
	}
	const res = await fetch(src);
	if (!res.ok) {
		return null;
	}
	const buf = await c.decodeAudioData(await res.arrayBuffer());
	buffers.set(src, buf);
	return buf;
}

// skip leading near-silence so one-shots hit right away
function leadIn(buf: AudioBuffer) {
	const data = buf.getChannelData(0);
	let peak = 0;
	for (let i = 0; i < data.length; i++) {
		const a = Math.abs(data[i]);
		if (a > peak) {
			peak = a;
		}
	}
	const threshold = peak * 0.05;
	for (let i = 0; i < data.length; i++) {
		if (Math.abs(data[i]) > threshold) {
			return i / buf.sampleRate;
		}
	}
	return 0;
}

function fadeOut(c: AudioContext, v: Voice, at: number) {
	v.gain.gain.cancelScheduledValues(at);
	v.gain.gain.setValueAtTime(v.gain.gain.value, at);
	v.gain.gain.linearRampToValueAtTime(0, at + FADE);
	try {
		v.source.stop(at + FADE + 0.05);
	} catch {
		// already stopped
	}
}

export async function setAmbient(src?: string) {
	wanted = src;
	const c = context();
	if (!c) {
		return;
	}
	if (c.state === 'suspended') {
		arm();
	}

	if (!src) {
		const v = voice;
		voice = null;
		if (v) {
			fadeOut(c, v, c.currentTime);
		}
		return;
	}

	if (voice?.src === src || failed.has(src) || loading) {
		return;
	}

	loading = true;
	const buf = await load(c, src).catch(() => null);
	loading = false;

	if (buf === null) {
		failed.add(src);
		if (wanted !== src) {
			setAmbient(wanted);
		}
		return;
	}
	if (wanted !== src) {
		setAmbient(wanted);
		return;
	}

	c.resume().catch(() => {});
	const at = c.currentTime;
	const gain = c.createGain();
	const source = c.createBufferSource();
	gain.gain.setValueAtTime(0, at);
	gain.gain.linearRampToValueAtTime(1, at + FADE);
	source.buffer = buf;
	source.loop = true;
	source.connect(gain);
	gain.connect(master!);
	source.start(at);

	if (voice) {
		fadeOut(c, voice, at);
	}
	voice = { source, gain, src };
}

export function stopAmbient() {
	setAmbient(undefined);
}

export async function playSfx(src: string) {
	if (sfxFailed.has(src)) {
		return;
	}
	const c = context();
	if (!c) {
		return;
	}
	if (c.state !== 'running') {
		wake();
		await c.resume().catch(() => {});
	}
	const buf = await load(c, src).catch(() => null);
	if (!buf) {
		sfxFailed.add(src);
		return;
	}
	const gain = c.createGain();
	gain.gain.value = curve(volume) * SFX_VOLUME;
	const source = c.createBufferSource();
	source.buffer = buf;
	source.connect(gain);
	gain.connect(c.destination);
	source.start(c.currentTime, leadIn(buf));
}
