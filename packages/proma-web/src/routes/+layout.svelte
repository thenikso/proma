<script>
  import './layout.css';
	import favicon from '$lib/assets/favicon.png';
  import { onMount } from 'svelte';
  import { initShortcuts } from '$lib/shortcuts';
  import { login, logout } from '$lib/stores/auth';

	let { children } = $props();

  initShortcuts();

  onMount(() => {
    window.login = login;
    window.logout = logout;
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
