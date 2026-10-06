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
		// storage can throw (private mode), fall back to memory
		storage = null;
	}

	if (storage) {
		const storedValue = storage.getItem(key);

		// TODO validate this
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

// lives for the install, survives restarts
function persistentWritable<T>(key: string, initialValue: T) {
	return storageWritable(key, initialValue, () => localStorage);
}

// only for this browser session, survives reloads but resets on a new visit
function sessionWritable<T>(key: string, initialValue: T) {
	return storageWritable(key, initialValue, () => sessionStorage);
}

export const allPosts = writable<Record<string, Post>>({});
export const currentPostStore = writable<Post | null>(null);
export const playerTrack = writable<string | null>(null);
export const playerVolume = persistentWritable('playerVolume', 0.8);

// lights on or off, kept per session so the switch only greets you once
export const lightsOn = sessionWritable('lightsOn', false);

// drives play/pause from anywhere, eg the lightswitch
export const playerPlaying = writable(false);

// muffle the music while the glass is held
export const audioMuffled = writable(false);

// stereo pan, follows the cursor with the glass
export const audioPan = writable(0);

// glass lens in viewport px, null when down, pages mask to it
export const lens = writable<{ x: number; y: number; r: number } | null>(null);
export const viewedPosts = persistentWritable<Record<string, boolean>>(
	'viewedPosts',
	{}
);

// last scene visited in /home2
export const exploreScene = persistentWritable('exploreScene', '');
