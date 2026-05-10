import type { NextRequest } from "next/server";

// process.env.API_URL → runtime env var (NEXT_PUBLIC_ değil, Docker'da set edilir)
// Geliştirmede: http://localhost:3000 varsayılan
const API_BASE = process.env.API_URL ?? "http://localhost:3000";

async function proxy(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  // /api/v1/devices → http://api:3000/api/v1/devices (tam path, prefix soyulmuyor)
  const targetUrl = `${API_BASE}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const rawBody =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  // Boş body varsa Content-Type'ı da kaldır → Fastify "body cannot be empty" hatası vermesin
  const body = rawBody && rawBody.byteLength > 0 ? rawBody : undefined;
  if (!body) headers.delete("content-type");

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
