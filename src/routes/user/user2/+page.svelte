<script lang="ts">
	import Profile from '$lib/profile.svelte';
	import Section from '$lib/section.svelte';
</script>

<Profile
	username="user2"
	iconURL="/icons/pfp.png"
	joinDate="01/01/1970 12:00 AM"
>
	<p>uhhh i like dogs</p>
	<p></p>
	<p>user1 was here</p>
</Profile>

<Section>
	<p>this user has no pinned posts</p>
</Section>