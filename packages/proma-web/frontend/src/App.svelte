<script>
  import { initShortcuts } from '$lib/shortcuts';
  import { login, logout, isAuthenticated } from '$lib/stores';
  import Router from '$lib/Router.svelte';

  import Dashboard from './routes/Dashboard.svelte';
  import ProjectLayout from './routes/edit/$layout.svelte';
  import ProjectIndex from './routes/edit/index.svelte';
  import NotFound from './routes/$error.svelte';

  const routes = [
    { path: '/', component: Dashboard },
    {
      path: 'edit/:hostId/:projectSlug',
      layout: ProjectLayout,
      component: ProjectIndex,
    },
    {
      path: '*',
      component: NotFound,
    },
  ];

  initShortcuts();

  function handleMousewheel(e) {
    e.preventDefault();
  }

  window.login = login;
  window.logout = logout;

  $: console.log('authenticated', $isAuthenticated);
</script>

<svelte:body on:mousewheel|nonpassive={handleMousewheel} />

<Router {routes} />
