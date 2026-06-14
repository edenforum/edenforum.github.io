<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: 'WELCOME TO EDENFORUM',
		author: 'user1',
		date: '02/05/2001 | 15:54',
		comments: '4',
		hidden: false,
	} satisfies PostMeta;
</script>

<script lang="ts">
	import { playerTrack } from '$lib/stores';

	viewPost(meta);
	playerTrack.set('/sounds/weatherchannel.mp3');
</script>

<Post username="user1" userIcon="/icons/user1.png" userHref="/user/user1">WELCOME TO EDENFORUM!!! i was sick of using the Other one so we're moving over here. i just hope people actually use it. </Post>
<Post username="megaman49" userIcon="/icons/megaman.png" userHref="/user/megaman49">HIIIII!!!!!!!!</Post>
