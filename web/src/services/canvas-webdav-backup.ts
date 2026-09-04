"use client";

export type CanvasWebDAVBackupConfig = { url: string; username: string; password: string; directory: string };

const BACKUP_FILE = "canvas-backup.zip";
const TIMEOUT_MS = 120000;

export async function testCanvasWebDAV(config: CanvasWebDAVBackupConfig) {
    await ensureDirectory(config);
    const response = await requestCanvasWebDAV(config, "", { method: "PROPFIND", headers: { Depth: "0" } });
    if (!response.ok && response.status !== 207) throw await responseError(response, "WebDAV 连接测试失败");
}

export async function uploadCanvasWebDAVBackup(config: CanvasWebDAVBackupConfig, archive: Blob) {
    if (!archive.size) throw new Error("不能上传空的画布备份");
    await ensureDirectory(config);
    const response = await requestCanvasWebDAV(config, BACKUP_FILE, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: archive });
    if (!response.ok) throw await responseError(response, "WebDAV 画布备份失败");
}

export async function downloadCanvasWebDAVBackup(config: CanvasWebDAVBackupConfig) {
    validate(config);
    const response = await requestCanvasWebDAV(config, BACKUP_FILE, { method: "GET" });
    if (response.status === 404) throw new Error("WebDAV 中还没有画布备份");
    if (!response.ok) throw await responseError(response, "WebDAV 画布恢复失败");
    const blob = await response.blob();
    if (!blob.size) throw new Error("WebDAV 画布备份为空");
    return new File([blob], BACKUP_FILE, { type: "application/zip" });
}

async function ensureDirectory(config: CanvasWebDAVBackupConfig) {
    validate(config);
    const parts = normalize(config.directory).split("/").filter(Boolean);
    let path = "";
    for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        const response = await requestCanvasWebDAV({ ...config, directory: "" }, path, { method: "MKCOL" });
        if (response.ok || response.status === 405 || response.status === 423) continue;
        throw await responseError(response, "WebDAV 备份目录创建失败");
    }
}

export async function requestCanvasWebDAV(config: CanvasWebDAVBackupConfig, path: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
    validateUrl(config.url);
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(init.headers);
    if (config.username || config.password) headers.set("Authorization", `Basic ${basic(`${config.username}:${config.password}`)}`);
    headers.set("X-WebDAV-Target", remoteUrl(config, path));
    headers.set("X-WebDAV-Method", init.method || "GET");
    try {
        return await fetch("/api/local-webdav", { method: "POST", headers, body: init.body, signal: controller.signal, cache: "no-store" });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("WebDAV 请求超时");
        throw new Error("无法连接 WebDAV，请检查地址和跨域配置");
    } finally {
        globalThis.clearTimeout(timer);
    }
}

function remoteUrl(config: CanvasWebDAVBackupConfig, path: string) {
    const base = config.url.trim().replace(/\/+$/, "");
    const remote = [normalize(config.directory), normalize(path)].filter(Boolean).join("/");
    return remote ? `${base}/${remote.split("/").map(encodeURIComponent).join("/")}` : base;
}

function validate(config: CanvasWebDAVBackupConfig) {
    validateUrl(config.url);
    if (!normalize(config.directory)) throw new Error("请输入 WebDAV 备份目录");
}

function validateUrl(value: string) {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error("WebDAV 地址仅支持 HTTP 或 HTTPS");
}

function normalize(value: string) { return value.trim().replace(/^\/+|\/+$/g, ""); }
function basic(value: string) { return btoa(String.fromCharCode(...new TextEncoder().encode(value))); }
async function responseError(response: Response, fallback: string) {
    if (response.status === 401 || response.status === 403) return new Error("WebDAV 认证失败");
    const detail = await response.text().catch(() => "");
    return new Error(`${fallback}：HTTP ${response.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
}
