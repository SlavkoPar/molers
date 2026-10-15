// Parse a response body as JSON without throwing when the server sent something else
// (for example an HTML error page), so callers can show a readable message.
export async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `Server returned ${res.status} ${res.statusText || ""}`.trim(),
    };
  }
}
