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

// Storage-like view over session cookies: shared across every tab of the
// browser session, but dropped when the browser closes
function sessionCookieStorage(): Storage {
	return {
		get length() {
			return 0;
		},
		clear() {},
		getItem(key: string) {
			const match = document.cookie
				.split('; ')
				.find((row) => row.startsWith(`${key}=`));
			return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
		},
		key() {
			return null;
		},
		removeItem(key: string) {
			document.cookie = `${key}=; path=/; Max-Age=0`;
		},
		setItem(key: string, value: string) {
			// no Max-Age/Expires makes this a session cookie
			document.cookie = `${key}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
		},
	};
}

// only for this browser session, shared across tabs (unlike sessionStorage)
// and cleared when the browser closes
function sessionWritable<T>(key: string, initialValue: T) {
	return storageWritable(key, initialValue, () => sessionCookieStorage());
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
