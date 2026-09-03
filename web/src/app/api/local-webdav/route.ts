import { NextRequest, NextResponse } from "next/server";

const METHODS = new Set(["GET", "PUT", "PROPFIND", "MKCOL"]);

export async function POST(request: NextRequest) {
    try {
        const target = new URL(request.headers.get("x-webdav-target") || "");
        const method = (request.headers.get("x-webdav-method") || "GET").toUpperCase();
        if (!/^https?:$/.test(target.protocol) || !METHODS.has(method)) return NextResponse.json({ error: "WebDAV 请求无效" }, { status: 400 });
        const headers = new Headers();
        for (const name of ["authorization", "content-type", "depth"]) {
            const value = request.headers.get(name);
            if (value) headers.set(name, value);
        }
        const body = method === "PUT" ? await request.arrayBuffer() : undefined;
        const response = await fetch(target, { method, headers, body, cache: "no-store", redirect: "manual" });
        const outputHeaders = new Headers();
        for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
            const value = response.headers.get(name);
            if (value) outputHeaders.set(name, value);
        }
        return new NextResponse(response.body, { status: response.status, headers: outputHeaders });
    } catch {
        return NextResponse.json({ error: "WebDAV 上游连接失败" }, { status: 502 });
    }
}
