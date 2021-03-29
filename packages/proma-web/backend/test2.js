export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: 2 }, null, 2),
  };
}
