import ProjectEditor from './ProjectEditor.svelte';

export const routes = [
  {
    name: '/:hostId/:projectSlug',
    component: ProjectEditor,
  },
];
