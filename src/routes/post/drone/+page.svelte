<script module lang="ts">
	import { viewPost, type Post as PostMeta } from '$lib/postMeta';
	import Post from '$lib/post.svelte';

	export const meta = {
		title: '\'drone\' OUT NOW',
		author: 'edenforum',
		date: '10/10/2026 | 00:00',
		comments: '6',
		hidden: false,
	} satisfies PostMeta;
</script>

<script lang="ts">
	import { playerTrack } from '$lib/stores';
	import './theme.css';

	viewPost(meta);
	playerTrack.set('/sounds/drone.mp3');

	// no class on svelte:body so toggle on mount
	$effect(() => {
		document.body.classList.add('drone-page');
		return () => document.body.classList.remove('drone-page');
	});
</script>

<Post username="edenforum" userIcon="/icons/edenforumpfp.png" userHref="/user/edenforum"> listen to my new EP, 'drone' !!! it's really cool i promise guys! you can click the image to listen &lt;3<br><a href="https://too.fm/drone"><img src="/icons/embeds/drone_coverart.png" alt="listen now!!!"></a></Post>
<Post username="deerfan3" userIcon="/icons/deer.png" userHref="/user/deerfan3">did you seriously sign up just to advertise your own music ??? i guess i respect the grind . cool song tho</Post>
<Post username="megaman49" userIcon="/icons/megaman.png" userHref="/user/megaman49">Lol, Kinda sounds like the Mega Man 2 Ending Theme or like Pokemon or something</Post>
<Post username="frejacat" userIcon="/icons/frejacat.jpg" userHref="/user/frejacat">wow i just listened to it, lovely stuff in there :3</Post>
<Post username="rainbowguy" userIcon="/icons/rainbowguy.gif" userHref="/user/rainbowguy" class="rainbow">My Text Looks So Cool On This Page. Also How Did You Make It Look Like That.</Post>
<Post username="edenforum" userIcon="/icons/edenforumpfp.png" userHref="/user/edenforum">haha thanks guys im glad u like it!! also thats my little scret rainbowguy. dont worry about it.</Post>
<Post username="rainbowguy" userIcon="/icons/rainbowguy.gif" userHref="/user/rainbowguy" class="rainbow">Man</Post>