<script>
  import { Router } from 'svelte-router-spa';

  import Dashboard from './pages/Dashboard.svelte';
  import ProjectEditor from './pages/ProjectEditor.svelte';
  import NotFound from './pages/_error.svelte';

  const routes = [
    { name: '/', component: Dashboard },
    { name: 'edit/:hostId/:projectSlug', component: ProjectEditor },
    {
      name: '404',
      component: NotFound,
    },
  ];
</script>

<Router {routes} />
