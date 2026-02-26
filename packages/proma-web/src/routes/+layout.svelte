<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { initShortcuts } from '$lib/shortcuts';
	import { initTheme } from '$lib/theme';

	let { children } = $props();

	initShortcuts();
	initTheme();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
