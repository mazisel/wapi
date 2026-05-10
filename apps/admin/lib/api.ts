// Tarayıcı: relative URL → Next.js proxy (/api/...) üzerinden backend'e ulaşır
// Sunucu tarafı (SSR): process.env.API_URL kullanılır (proxy route.ts içinde)

// WS URL: bağlantı her zaman tarayıcıdan yapılır, NEXT_PUBLIC_ bake-time değişken
export const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? `ws://${window.location.hostname}:3000`)
    : "";

export function wsUrl(path: string): string {
  return `${WS_URL}${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const masterKey =
    typeof window !== "undefined"
      ? (localStorage.getItem("wapi_master_key") ?? "")
      : "";

  // Content-Type'ı sadece body olan requestlere ekle —
  // boş body + application/json Fastify'da 400 üretir
  const headers: Record<string, string> = {
    Authorization: `Bearer ${masterKey}`,
    ...(options.headers as Record<string, string>),
  };
  if (options.body != null) {
    headers["Content-Type"] = "application/json";
  }

  // Relative URL — Next.js proxy'den geçer
  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
