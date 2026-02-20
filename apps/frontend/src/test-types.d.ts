// Type support for test files — processed by TypeScript but not bundled.

declare module '*.svelte' {
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
}
