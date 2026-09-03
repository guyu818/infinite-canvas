import assert from "node:assert/strict";
import test from "node:test";

import { downloadCanvasWebDAVBackup, requestCanvasWebDAV, testCanvasWebDAV, uploadCanvasWebDAVBackup } from "../src/services/canvas-webdav-backup.ts";

const config = { url: "https://dav.example/root", username: "user", password: "pass", directory: "canvas" };

test("WebDAV connection creates and probes the dedicated directory", async (t) => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string | null; authorization: string | null }> = [];
    globalThis.fetch = async (url, init) => { const headers = new Headers(init?.headers); calls.push({ url: String(url), method: headers.get("X-WebDAV-Method"), authorization: headers.get("Authorization") }); return new Response("", { status: headers.get("X-WebDAV-Method") === "PROPFIND" ? 207 : 201 }); };
    t.after(() => { globalThis.fetch = originalFetch; });
    await testCanvasWebDAV(config);
    assert.deepEqual(calls.map((call) => call.method), ["MKCOL", "PROPFIND"]);
    assert.match(calls[0].authorization || "", /^Basic /);
});

test("WebDAV rejects empty uploads and empty downloads", async (t) => {
    await assert.rejects(uploadCanvasWebDAVBackup(config, new Blob()), /空/);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => new Response(init?.method === "GET" ? new Blob() : "", { status: init?.method === "GET" ? 200 : 201 });
    t.after(() => { globalThis.fetch = originalFetch; });
    await assert.rejects(downloadCanvasWebDAVBackup(config), /为空/);
});

test("WebDAV reports authentication failures", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("", { status: 401 });
    t.after(() => { globalThis.fetch = originalFetch; });
    await assert.rejects(testCanvasWebDAV(config), /认证失败/);
});

test("WebDAV request timeout is reported", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    t.after(() => { globalThis.fetch = originalFetch; });
    await assert.rejects(requestCanvasWebDAV(config, "file", { method: "GET" }, 5), /超时/);
});
