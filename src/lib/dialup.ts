// Dial-up image loading.
//
// Simulates a baseline JPEG arriving over a slow modem: each image paints in
// from the top down, in chunky bands (as if packets of scanlines are landing),
// with a bright scan line riding the leading edge. Images higher up the page
// start first, so the whole page appears to stream in from top to bottom.
//
// It works by clipping each <img> with clip-path and walking the clip from
// fully-hidden to fully-revealed, so the image simply paints in from the top
// down. The clip is cleared once the image finishes.

const REVEAL_SPEED = 130; // px of image height revealed per second (slow = dial-up)
const PAGE_STAGGER = 0.9; // ms of start delay per px of vertical page position
const MAX_STAGGER = 2200; // cap so images far down the page don't wait forever
const MIN_DURATION = 420; // ms floor, so even tiny icons take a beat to "load"
const BAND = 6; // px — quantise the reveal into chunks for a packet-y feel

// Random "bad line" glitches, so the stream stutters like a flaky modem instead
// of crawling in at a constant rate. Between events the reveal advances normally;
// at each event we either HITCH (the bytes stall for a beat) or SKIP (a burst
// lands and several scanlines snap in at once). Progress only ever moves forward,
// so the image is still guaranteed to finish.
const EVENT_MIN = 90; // ms — soonest until the next glitch is rolled
const EVENT_MAX = 280; // ms — latest until the next glitch is rolled
const HITCH_CHANCE = 0.6; // odds an event is a stall rather than a skip
const HITCH_MIN = 70; // ms — shortest stall
const HITCH_MAX = 260; // ms — longest stall
const SKIP_MIN = 0.05; // fraction of the image to jump forward on a skip
const SKIP_MAX = 0.22; // fraction of the image to jump forward on a skip

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function animate(img: HTMLImageElement) {
	// hide immediately (before the first frame) so there's no flash of the full
	// image between marking and the first paint
	img.style.clipPath = 'inset(0 0 100% 0)';

	const docY = img.getBoundingClientRect().top + window.scrollY;
	const delay = Math.min(MAX_STAGGER, Math.max(0, docY) * PAGE_STAGGER);

	let startTs = 0;
	let lastTs = 0;
	let progress = 0; // 0..1 revealed fraction, advanced frame-by-frame
	let hitchUntil = 0; // ts the current stall holds until (0 = not stalled)
	let nextEventAt = 0; // ts at which the next hitch/skip is rolled

	function frame(ts: number) {
		if (!startTs) {
			startTs = ts;
			lastTs = ts;
		}
		const elapsed = ts - startTs - delay;

		// still waiting for this image's turn in the top-to-bottom cascade
		if (elapsed <= 0) {
			lastTs = ts;
			requestAnimationFrame(frame);
			return;
		}

		const h = img.getBoundingClientRect().height || img.naturalHeight || 80;
		const duration = Math.max(MIN_DURATION, (h / REVEAL_SPEED) * 1000);

		const dt = ts - lastTs;
		lastTs = ts;
		if (!nextEventAt) {
			nextEventAt = ts + rand(EVENT_MIN, EVENT_MAX);
		}

		if (ts < hitchUntil) {
			// stalled — the modem hiccuped, so hold the reveal where it is
		} else {
			// normal advance for this frame
			progress += dt / duration;

			// time to roll the next glitch?
			if (ts >= nextEventAt) {
				if (Math.random() < HITCH_CHANCE) {
					hitchUntil = ts + rand(HITCH_MIN, HITCH_MAX);
				} else {
					// a burst lands: snap several scanlines in at once
					progress += rand(SKIP_MIN, SKIP_MAX);
				}
				nextEventAt = ts + rand(EVENT_MIN, EVENT_MAX);
			}
		}

		const t = Math.min(1, progress);

		// quantise the revealed height into bands so it ticks down in chunks
		const revealedPx = Math.round((t * h) / BAND) * BAND;
		const hiddenPct = Math.max(0, ((h - revealedPx) / h) * 100);
		img.style.clipPath = `inset(0 0 ${hiddenPct}% 0)`;

		if (t < 1) {
			requestAnimationFrame(frame);
		} else {
			// done — restore the image
			img.style.clipPath = '';
		}
	}

	requestAnimationFrame(frame);
}

// Per-session memory of which profile pictures have already done the reveal,
// keyed by image source. Navigating away and back recreates the <img> element,
// so the in-DOM marker alone isn't enough — we persist the set for the session
// so each profile picture only streams in once per visit.
const SEEN_KEY = 'dialupSeen';

function loadSeen(): Set<string> {
	try {
		const raw = sessionStorage.getItem(SEEN_KEY);
		return new Set(raw ? (JSON.parse(raw) as string[]) : []);
	} catch {
		return new Set();
	}
}

function markSeen(seen: Set<string>, src: string) {
	seen.add(src);
	try {
		sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
	} catch {
		// storage unavailable (private mode etc.) — effect just repeats; harmless
	}
}

// Apply the effect to every image not yet processed. Safe to call repeatedly
// (e.g. after each navigation) — already-handled images are skipped, and any
// profile picture already revealed this session is shown without the effect.
export function runDialup() {
	if (typeof document === 'undefined') {
		return;
	}

	const seen = loadSeen();

	// only profile pictures opt in, via the .dialup class
	const imgs = document.querySelectorAll<HTMLImageElement>(
		'img.dialup:not([data-dialup-done])'
	);
	imgs.forEach((img) => {
		img.dataset.dialupDone = '1';

		// already revealed this session — leave it fully visible, no effect
		if (seen.has(img.src)) {
			return;
		}
		markSeen(seen, img.src);

		// wait until the image has real dimensions, so the reveal is measured
		// against its rendered height rather than 0
		if (img.complete && img.naturalWidth) {
			animate(img);
		} else {
			img.addEventListener('load', () => animate(img), { once: true });
			// broken images: nothing to reveal, just leave them be
			img.addEventListener('error', () => {}, { once: true });
		}
	});
}
