/* Источники данных: API при его настройке, иначе локальный JSON */

async function fetchData(apiUrl, fallbackUrl, audience) {
  const apiBase =
    typeof window.TOK_API_BASE === "string"
      ? window.TOK_API_BASE.replace(/\/$/, "")
      : "";
  if (apiBase) {
    try {
      const endpoint = `${apiBase}${apiUrl.replace(/^\/api/, "")}?audience=${encodeURIComponent(audience)}`;
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("API unavailable");
      return await response.json();
    } catch {
      // Пока API недоступно, сайт продолжает работать на локальных данных.
    }
  }

  const fallback = await fetch(fallbackUrl);
  if (!fallback.ok) throw new Error("Fallback data unavailable");
  return await fallback.json();
}
