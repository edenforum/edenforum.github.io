<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	// this is how u get the post to show up on the main page
	export const meta = {
		title: 'another post',
		author: 'admin',
		date: '10/20/2024 | 13:37',
		comments: '∞',
		hidden: false,
	} satisfies PostMeta;
</script>

<script lang="ts">
	import { playerTrack } from '$lib/stores';

	// u need this so that it marks the post as read
	viewPost(meta);

	// this is how u set the music for a page
	playerTrack.set('/sounds/detective.mp3');
</script>

<Post username="user1" userIcon="/icons/user1.png" userHref="/forum/user/user1">hiiiiiiii</Post>
<Post username="admin">thread locked</Post>
