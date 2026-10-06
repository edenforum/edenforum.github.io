// fake dial up image loading
// imgs reveal top down in bands with a scan line, done by walking a clip-path

const REVEAL_SPEED = 130; // px per second, slow on purpose
const PAGE_STAGGER = 0.9; // ms delay per px down the page
const MAX_STAGGER = 2200; // cap it so lower imgs don't wait forever
const MIN_DURATION = 420; // ms floor so even tiny icons take a beat
const BAND = 6; // px chunks for the packet feel

// random bad line glitches so it stutters instead of crawling evenly
// each event either stalls or skips ahead, progress only moves forward
const EVENT_MIN = 90; // ms until the next glitch
const EVENT_MAX = 280;
const HITCH_CHANCE = 0.6; // odds of a stall over a skip
const HITCH_MIN = 70; // ms
const HITCH_MAX = 260;
const SKIP_MIN = 0.05; // fraction to jump
const SKIP_MAX = 0.22;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function animate(img: HTMLImageElement) {
	// hide before the first paint so there's no flash of the full image
	img.style.clipPath = 'inset(0 0 100% 0)';

	const docY = img.getBoundingClientRect().top + window.scrollY;
	const delay = Math.min(MAX_STAGGER, Math.max(0, docY) * PAGE_STAGGER);

	let startTs = 0;
	let lastTs = 0;
	let progress = 0; // 0..1 revealed
	let hitchUntil = 0; // ts the stall holds until
	let nextEventAt = 0; // ts of the next hitch or skip

	function frame(ts: number) {
		if (!startTs) {
			startTs = ts;
			lastTs = ts;
		}
		const elapsed = ts - startTs - delay;

		// waiting its turn in the top down cascade
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
			// stalled
		} else {
			// normal advance
			progress += dt / duration;

			// roll the next glitch
			if (ts >= nextEventAt) {
				if (Math.random() < HITCH_CHANCE) {
					hitchUntil = ts + rand(HITCH_MIN, HITCH_MAX);
				} else {
					// skip ahead
					progress += rand(SKIP_MIN, SKIP_MAX);
				}
				nextEventAt = ts + rand(EVENT_MIN, EVENT_MAX);
			}
		}

		const t = Math.min(1, progress);

		// snap to bands so it ticks in chunks
		const revealedPx = Math.round((t * h) / BAND) * BAND;
		const hiddenPct = Math.max(0, ((h - revealedPx) / h) * 100);
		img.style.clipPath = `inset(0 0 ${hiddenPct}% 0)`;

		if (t < 1) {
			requestAnimationFrame(frame);
		} else {
			// done
			img.style.clipPath = '';
		}
	}

	requestAnimationFrame(frame);
}

// which images already did the reveal this session, keyed by src
// navigating away recreates the <img> so the dom marker isn't enough
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
		// storage blocked (private mode etc), harmless
	}
}

// run on every img.dialup not handled yet, safe to call after each navigation
export function runDialup() {
	if (typeof document === 'undefined') {
		return;
	}

	const seen = loadSeen();

	// only imgs that opt in via the dialup class
	const imgs = document.querySelectorAll<HTMLImageElement>(
		'img.dialup:not([data-dialup-done])'
	);
	imgs.forEach((img) => {
		img.dataset.dialupDone = '1';

		// already revealed this session
		if (seen.has(img.src)) {
			return;
		}
		markSeen(seen, img.src);

		// wait for real dimensions so the reveal measures right
		if (img.complete && img.naturalWidth) {
			animate(img);
		} else {
			img.addEventListener('load', () => animate(img), { once: true });
			// broken image, nothing to reveal
			img.addEventListener('error', () => {}, { once: true });
		}
	});
}
