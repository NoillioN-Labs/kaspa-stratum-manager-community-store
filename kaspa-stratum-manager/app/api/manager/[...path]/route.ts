type RouteContext = { params: Promise<{ path: string[] }> };

const managerOrigin = () =>
  (process.env.MANAGER_INTERNAL_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !/^[a-z0-9-]+$/i.test(segment))) {
    return Response.json({ error: "invalid_manager_path" }, { status: 400 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`/api/manager/${path.join("/")}${incoming.search}`, managerOrigin());
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: request.headers.get("content-type")
        ? { "content-type": request.headers.get("content-type") as string }
        : undefined,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const headers = new Headers({ "cache-control": "no-store" });
    const contentType = response.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manager unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
