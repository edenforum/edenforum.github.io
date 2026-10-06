<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: 'hello?',
		author: 'deerfan3',
		date: '05/05/2026 | 12:05',
		comments: '1',
		hidden: false,
	} satisfies PostMeta;
</script>

<script lang="ts">
	import { playerTrack } from '$lib/stores';

	viewPost(meta);
	playerTrack.set('/sounds/weatherchannel.mp3');
</script>

<Post username="deerfan3" userIcon="/icons/deer.png" userHref="/user/deerfan3">is this website just dead or something</Post>
<Post username="frejacat" userIcon="/icons/frejacat.jpg" userHref="/user/frejacat">um um um i hope not...!!</Post>