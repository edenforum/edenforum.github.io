import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { adminPlugin } from './vite-plugin-admin';

export default defineConfig({
	// listen on all interfaces so other devices on the network can reach it
	server: {
		host: true
	},
	// adminPlugin is dev only (apply: serve), it never ships in the build
	plugins: [sveltekit(), adminPlugin()]
});
