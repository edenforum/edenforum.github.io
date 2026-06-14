import { writable } from 'svelte/store';
import type { Subscriber, Unsubscriber } from 'svelte/store';
import type { Post } from './postMeta';

function storageWritable<T>(
	key: string,
	initialValue: T,
	getStorage: () => Storage
) {
	const store = writable(initialValue);

	let storage: Storage | null = null;
	try {
		storage = typeof window !== 'undefined' ? getStorage() : null;
	} catch {
		// storage can throw (private mode, blocked cookies) — degrade to memory
		storage = null;
	}

	if (storage) {
		const storedValue = storage.getItem(key);

		// TODO: this should probably be validated
		if (storedValue) {
			store.set(JSON.parse(storedValue));
		}
	}

	return {
		subscribe(subscriber: Subscriber<T>) {
			const unsub = store.subscribe(subscriber);

			return (() => {
				unsub();
			}) satisfies Unsubscriber;
		},
		set(newValue: T) {
			store.set(newValue);
			if (storage) {
				storage.setItem(key, JSON.stringify(newValue));
			}
		},
	};
}

// persists for the lifetime of the install (survives browser restarts)
function persistentWritable<T>(key: string, initialValue: T) {
	return storageWritable(key, initialValue, () => localStorage);
}

// persists only for the current browser session (cleared when the tab/session
// ends), so it survives reloads within a visit but resets on a fresh session
function sessionWritable<T>(key: string, initialValue: T) {
	return storageWritable(key, initialValue, () => sessionStorage);
}

export const allPosts = writable<Record<string, Post>>({});
export const currentPostStore = writable<Post | null>(null);
export const playerTrack = writable<string | null>(null);
export const playerVolume = persistentWritable('playerVolume', 0.8);

// Whether the lights are on. Persisted per browser session: the lightswitch
// greets you once at the start of a visit, then stays out of the way across
// reloads and navigation until the session ends.
export const lightsOn = sessionWritable('lightsOn', false);

// Drives the music player's play/pause from anywhere (e.g. the lightswitch).
export const playerPlaying = writable(false);

// When true, the player runs the audio through a low-pass filter so it sounds
// muffled (used while the magnifying glass is held).
export const audioMuffled = writable(false);

// Stereo pan for the player, -1 (left) .. 1 (right). Driven by cursor position
// while the magnifying glass is held.
export const audioPan = writable(0);

// The magnifying glass's current lens, in viewport pixels (null when it's not
// held). Published so any element on the page can mask itself to this circle
// and so reveal hidden text only when the lens passes over it.
export const lens = writable<{ x: number; y: number; r: number } | null>(null);
export const viewedPosts = persistentWritable<Record<string, boolean>>(
	'viewedPosts',
	{}
);
