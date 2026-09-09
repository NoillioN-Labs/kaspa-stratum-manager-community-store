type RouteContext = { params: Promise<{ path: string[] }> };

const managerOrigin = () =>
  (process.env.MANAGER_INTERNAL_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !/^[a-z0-9-]+$/i.test(segment))) {
    return Response.json({ error: "invalid_manager_path" }, { status: 400 });
  }

  const incoming = new URL(request.url);
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutation) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || incoming.host;
    let originMatches = !origin;
    try { if(origin){const parsed=new URL(origin);originMatches=["http:","https:"].includes(parsed.protocol)&&parsed.host===host;} } catch { originMatches=false; }
    if (request.headers.get("sec-fetch-site") === "cross-site" || !originMatches) {
      return Response.json({ error:"Cross-origin changes are not allowed" }, {status:403});
    }
    if (!request.headers.get("content-type")?.startsWith("application/json") && request.body) return Response.json({error:"JSON required"},{status:415});
  }
  const target = new URL(`/api/manager/${path.join("/")}${incoming.search}`, managerOrigin());
  let body:Uint8Array<ArrayBuffer>|undefined;
  if (mutation && request.body) {
    const reader = request.body.getReader(), chunks:Uint8Array[]=[];
    let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return Response.json({error:"Request too large"},{status:413});}chunks.push(value);}
    body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: request.headers.get("content-type")
        ? { "content-type": request.headers.get("content-type") as string }
        : undefined,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(mutation ? 90_000 : 10_000),
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
export const PUT = proxy;
export const OPTIONS = proxy;

