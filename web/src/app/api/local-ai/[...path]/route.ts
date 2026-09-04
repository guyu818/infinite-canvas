import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const baseUrl = request.headers.get("x-local-ai-base-url")?.trim();
    const authorization = request.headers.get("authorization");
    if (!baseUrl || !authorization) return Response.json({ code: 1, msg: "缺少本地渠道配置" }, { status: 400 });
    let upstream: URL;
    try {
        const base = new URL(baseUrl);
        if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error();
        const { path } = await context.params;
        const prefix = base.pathname.replace(/\/+$/, "").endsWith("/v1") ? base.pathname.replace(/\/+$/, "") : `${base.pathname.replace(/\/+$/, "")}/v1`;
        upstream = new URL(`${prefix}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, base.origin);
    } catch {
        return Response.json({ code: 1, msg: "本地渠道地址格式错误" }, { status: 400 });
    }
    const headers = new Headers({ authorization });
    for (const name of ["content-type", "accept"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    const response = await fetch(upstream, { method: request.method, headers, body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(), cache: "no-store" });
    const responseHeaders = new Headers(response.headers);
    for (const name of ["content-length", "content-encoding", "transfer-encoding", "connection"]) responseHeaders.delete(name);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
