<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: 'test post',
		author: 'user 1',
		date: '10/20/2024 | 13:37',
		comments: '3',
		// only visible through the magnifying glass, pinned to the bottom of the
		// home list (see the home page's secret-posts handling)
		hidden: true,
	} satisfies PostMeta;
</script>

<script lang="ts">
	viewPost(meta);
</script>

<Post username="red">how do i post</Post>
<Post username="user2" userHref="/forum/user/user2" userIcon="/icons/pfp.png">
	u did
</Post>
<Post username="red">btw if anybody gets to this post there's probably an exploit we haven't patched. this is probably a good post to keep up just in case.
</Post>

