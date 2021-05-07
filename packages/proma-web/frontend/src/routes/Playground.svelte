<script>
  import FileTree from '$lib/components/FileTree.svelte';

  const files = [
    'www/intex.html',
    'readme.md',
    'endpoints/greet.proma',
    'www/imgs/image.png',
  ];

  let selectedFile;
  let expandedFolders = [];

  function handleFileClick(e) {
    const { file, folder } = e.detail;
    if (file) {
      selectedFile = file;
    } else {
      if (expandedFolders.some((s) => s.startsWith(folder))) {
        expandedFolders = expandedFolders.filter(
          (s) => !s.startsWith(folder + '/') && s !== folder,
        );
      } else {
        expandedFolders = [...expandedFolders, folder];
      }
    }
  }
</script>

<div>Playground for</div>

<FileTree
  {files}
  expand={expandedFolders}
  select={selectedFile}
  on:click={handleFileClick}
/>
