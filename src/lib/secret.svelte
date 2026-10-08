<script lang="ts">
	import { dec } from '$lib/obfuscate';

	// value: encoded payload. shown: whether the secret has been revealed.
	// until then the plaintext is never in the DOM.
	const {
		value,
		shown = false,
		placeholder = '',
	}: { value: string; shown?: boolean; placeholder?: string } = $props();

	const text = $derived(shown ? dec(value) : placeholder);
</script>

{text}
