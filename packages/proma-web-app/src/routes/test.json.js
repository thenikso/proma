export async function get({ params }) {
  return {
    body: {
      test: true,
      params,
    },
  };
}
