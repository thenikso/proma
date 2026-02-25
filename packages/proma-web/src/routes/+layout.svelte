<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { initShortcuts } from '$lib/shortcuts';
  import { login, logout } from '$lib/stores/auth';

  initShortcuts();

  onMount(() => {
    window.login = login;
    window.logout = logout;
  });
</script>

<slot />
