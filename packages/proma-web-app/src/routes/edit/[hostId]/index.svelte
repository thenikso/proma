<script context="module">
  export async function load({ page, fetch, session, context }) {
    return {
      props: {
        userId: page.params.userId,
      },
    };
  }
</script>

<script>
  export let userId;
</script>

<div>TODO user "{userId}" projects list</div>
