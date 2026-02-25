<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { initShortcuts } from '$lib/shortcuts';

	let { children } = $props();

	initShortcuts();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
