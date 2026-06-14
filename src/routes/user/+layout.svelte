<script lang="ts">
	const { children = $bindable() } = $props();
</script>

{@render children()}
