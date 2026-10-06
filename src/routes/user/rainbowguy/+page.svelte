<script lang="ts">
	import Profile from '$lib/profile.svelte';
	import Section from '$lib/section.svelte';
</script>

<Profile
	username="rainbowguy"
	iconURL="/icons/rainbowguy.gif"
	joinDate="03/04/2005 14:25 PM"
>
	<p class="rainbow">Guess Who Figured Out How To Make Their Messages Rainbow. Im Basically God.</p>
</Profile>

<Section>
	<p>this user has no pinned posts</p>
</Section>
<style>
	.rainbow {
		color: transparent;
		background: linear-gradient(
			90deg,
			oklch(80% 70% 0deg),
			oklch(80% 70% 30deg),
			oklch(80% 70% 60deg),
			oklch(80% 70% 90deg),
			oklch(80% 70% 120deg),
			oklch(80% 70% 150deg),
			oklch(80% 70% 180deg),
			oklch(80% 70% 210deg),
			oklch(80% 70% 240deg),
			oklch(80% 70% 270deg),
			oklch(80% 70% 300deg),
			oklch(80% 70% 330deg),
			oklch(80% 70% 360deg)
		);
		background-clip: text;
	}
</style>

