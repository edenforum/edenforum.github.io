<script lang="ts">
	import Profile from '$lib/profile.svelte';
	import Section from '$lib/section.svelte';
</script>

<Profile
	username="user1"
	iconURL="/icons/pfp.png"
	joinDate="01/01/1970 12:00 AM"
>
	<p>website creator... i like being mysterious</p>
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
