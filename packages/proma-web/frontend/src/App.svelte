<script>
  import { initShortcuts } from '$lib/shortcuts';
  import { Router } from 'svelte-router-spa';

  import Dashboard from './routes/Dashboard.svelte';
  import ProjectLayout from './routes/edit/_layout.svelte';
  import ProjectIndex from './routes/edit/index.svelte';
  import NotFound from './routes/_error.svelte';

  const routes = [
    { name: '/', component: Dashboard },
    {
      name: 'edit/:hostId/:projectSlug',
      layout: ProjectLayout,
      component: ProjectIndex,
    },
    {
      name: '404',
      component: NotFound,
    },
  ];

  initShortcuts();

  function handleMousewheel(e) {
    e.preventDefault();
  }
</script>

<svelte:body on:mousewheel|nonpassive={handleMousewheel} />

<Router {routes} />
