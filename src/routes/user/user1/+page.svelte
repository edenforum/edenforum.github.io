<script lang="ts">
	import Profile from '$lib/profile.svelte';
	import Section from '$lib/section.svelte';
</script>

<Profile
	username="user1"
	iconURL="/icons/user1.png"
	joinDate="01/01/1970 12:00 AM"
>
	<p>website creator... i like being mysterious</p>
</Profile>

<Section>
	<p>this user has no pinned posts</p>
</Section>

