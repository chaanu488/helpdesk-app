import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: false }), svelteTesting()],
	resolve: {
		conditions: ['browser'],
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			'$app/navigation': path.resolve(__dirname, './src/__mocks__/app-navigation.ts'),
			'@backend': path.resolve(__dirname, '../backend/src'),
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./vitest-setup.ts'],
		include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
		env: { VITE_API_URL: 'http://localhost:3000' },
	},
});
