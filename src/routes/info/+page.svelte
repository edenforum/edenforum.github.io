<script lang="ts">
	import Section from '$lib/section.svelte';
	import PageNav from '$lib/page-nav.svelte';
	import Secret from '$lib/secret.svelte';
	import { lens, playerTrack } from '$lib/stores';

	playerTrack.set('/sounds/detective.mp3');

	// info page secret (obfuscated, see $lib/obfuscate)
	const secret = 'HAsQTgAABxsJDR5WQlM=';

	let secretEl = $state<HTMLParagraphElement>();
	const mask = $derived.by(() => {
		const l = $lens;
		if (!l || !secretEl) {
			return null;
		}
		const rect = secretEl.getBoundingClientRect();
		const x = l.x - rect.left;
		const y = l.y - rect.top;
		return `radial-gradient(circle ${l.r}px at ${x}px ${y}px, #000 62%, rgba(0,0,0,0.5) 84%, transparent 100%)`;
	});

	// only decode the text once the glass is actually over it
	const shown = $derived.by(() => {
		const l = $lens;
		if (!l || !secretEl) {
			return false;
		}
		const r = secretEl.getBoundingClientRect();
		const nx = Math.max(r.left, Math.min(l.x, r.right));
		const ny = Math.max(r.top, Math.min(l.y, r.bottom));
		return Math.hypot(l.x - nx, l.y - ny) <= l.r;
	});
</script>

<svelte:head>
	<title>edenforum — info</title>
</svelte:head>

<PageNav>
	<span>info</span>
	<span></span>
</PageNav>

<Section>
<div>
	<p>welcome to edenforum. this is an internet safe space. i hope it evolves into a haven for us all one day!</p>
	<br>
	<p>TODO:</p>
	<p>- fix grabbable info button. i dont even know how that happens.</p>
	<p>- knock knock knock knock knock.....</p>
	<p>- add a way to actually sign up without having to ask me personally.</p>
	</div>
</Section>

<p
	bind:this={secretEl}
	class="secret"
	style={mask ? `-webkit-mask-image:${mask};mask-image:${mask}` : 'opacity:0'}
	aria-hidden="true"
>
	<Secret value={secret} shown={shown} />
</p>

<style>
	.secret {
		margin: 0;
		padding: 1em;
		color: #ff79ce;
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-style: italic;
		text-shadow: 0 0 8px rgba(255, 121, 206, 0.6);
		pointer-events: none;
	}
</style>
