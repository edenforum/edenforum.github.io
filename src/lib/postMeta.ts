import { get } from 'svelte/store';
import { allPosts, currentPostStore, viewedPosts } from './stores';
import { stripAffixes } from './util';

export interface Post {
	title: string;
	author: string;
	date: string;
	comments: string;
	music?: string;
	hidden?: boolean;
}

export function postMeta(post: Post): Post {
	return post;
}

// "MM/DD/YYYY | HH:mm" -> ms since epoch, for sorting by post date
function postTimestamp(date: string): number {
	const [dayPart, timePart = '00:00'] = date.split('|');
	const [month, day, year] = dayPart.trim().split('/').map(Number);
	const [hours, minutes] = timePart.trim().split(':').map(Number);
	return new Date(
		year || 0,
		(month || 1) - 1,
		day || 1,
		hours || 0,
		minutes || 0
	).getTime();
}

export function readPosts() {
	const posts = import.meta.glob<true, string, { meta: Post }>(
		'../routes/post/**/+page.svelte',
		{ eager: true }
	);

	const newAllPosts: Record<string, Post> = {};

	for (const [k, v] of Object.entries(posts)) {
		const cleanPath = stripAffixes(k, '../routes/', '+page.svelte');
		newAllPosts[cleanPath] = v.meta;
	}

	// newest first; string-keyed objects keep this insertion order
	const ordered: Record<string, Post> = {};
	for (const [path, post] of Object.entries(newAllPosts).sort(
		([, a], [, b]) => (postTimestamp(b.date) || 0) - (postTimestamp(a.date) || 0)
	)) {
		ordered[path] = post;
	}

	allPosts.set(ordered);

	return ordered;
}

// unhidden post paths in homepage order
export function visiblePostPaths() {
	return Object.entries(readPosts())
		.filter(([, post]) => !post.hidden)
		.map(([path]) => path);
}

export function postPath(post: Post) {
	const posts = get(allPosts);

	for (const [k, v] of Object.entries(posts)) {
		if (Object.is(post, v)) {
			return k;
		}
	}
	return null;
}

export function viewPost(post: Post) {
	currentPostStore.set(post);

	const path = postPath(post);
	if (!path) {
		return;
	}

	const previouslyViewed = get(viewedPosts);
	viewedPosts.set({ ...previouslyViewed, [path]: true });
}
