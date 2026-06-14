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

	allPosts.set(newAllPosts);

	return newAllPosts;
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
