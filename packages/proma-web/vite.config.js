import path from 'path';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

const PROD = process.env.NODE_ENV === 'production';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	resolve: {
		alias: {
			'@proma/core': path.resolve('../proma-core/core/index.mjs'),
			'@proma/svelte-components': path.resolve('../proma-svelte-components/src/index.js'),
			stream: path.resolve('./node_modules/stream-browserify/index.js'),
		},
	},
	define: {
		IS_PRODUCTION: PROD ? 'true' : 'false',
		BACKEND_ENDPOINT: `'${process.env.BACKEND_ENDPOINT || 'http://localhost:3000/dev'}'`,
		AUTH0_DOMAIN: '"thenikso.eu.auth0.com"',
		AUTH0_CLIENTID: '"I0Vdf3zf7yoUnuvqKxYydiihHstUPd2G"',
		AUTH0_AUDIENCE: `"${process.env.SERVICE || 'dev-proma-web'}"`,
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},

			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
});
