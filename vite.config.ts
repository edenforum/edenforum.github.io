import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { adminPlugin } from './vite-plugin-admin';

export default defineConfig({
	// adminPlugin only attaches in dev (`apply: 'serve'`); it is absent from the
	// production build, so the authoring API does not ship with the site.
	plugins: [sveltekit(), adminPlugin()]
});
