<script>
  import { initShortcuts } from '$lib/shortcuts';
  import { login, logout, user } from '$lib/stores';
  import Router from '$lib/Router.svelte';

  import Index from './routes/index.svelte';
  import Playground from './routes/Playground.svelte';
  import ProjectLayout from './routes/edit/$layout.svelte';
  import ProjectIndex from './routes/edit/index.svelte';
  import NotFound from './routes/$error.svelte';

  const routes = [
    { path: '/', component: Index },
    { path: '/playground', component: Playground },
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

  window.login = login;
  window.logout = logout;
</script>

<Router {routes} />
