<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: 'I WIN!!!111!',
		author: 'rainbowguy',
		date: '07/05/2009 | 20:44',
		comments: '5',
		hidden: false,
	} satisfies PostMeta;
</script>

<script lang="ts">
	viewPost(meta);
</script>

<Post username="rainbowguy" userIcon="/icons/rainbowguy.gif" userHref="/user/rainbowguy" class="rainbow">1. I FIGURED OUT HOW TO GET RAINBOW TEXT XD 2. I FOUND SOOOOO MANY SECRETS WTF!!!! 3.... IM AWESOME</Post>
<Post username="user2" userHref="/user/user2">wtf..... thats admin only and i cant even ban u for hacking because theres no ban feature yet....</Post>
<Post username="rainbowguy" userIcon="/icons/rainbowguy.gif" userHref="/user/rainbowguy" class="rainbow">Your Day Will Come User2... YOUR DAY WILL COME</Post>
<Post username="megaman49" userIcon="/icons/megaman.png" userHref="/user/megaman49">Off topic sorry, but where did user1 go???? They haven't been online in a while</Post>
<Post username="user1" userIcon="/icons/user1.png" userHref="/user/user1" hidden>I'm here??? Can nobody see my messages????</Post>