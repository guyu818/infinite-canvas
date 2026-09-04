"use client";

import type { CanvasConnection, CanvasNodeData, ViewportTransform } from "@/app/(user)/canvas/types";

export const LOCAL_CANVAS_AGENT_PROTOCOL_VERSION = 6;
export const DEFAULT_LOCAL_CANVAS_AGENT_URL = "http://127.0.0.1:17371";

export type LocalCanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
    plugins?: Array<{ type: string; title: string; description?: string; defaultSize: { width: number; height: number }; actions: Array<{ id: string; title: string; description?: string }> }>;
};

export type LocalCanvasAgentToolCall = { requestId: string; name: string; input?: Record<string, unknown> };

type LocalCanvasAgentOptions = {
    endpoint: string;
    token: string;
    clientId: string;
    onConnected?: () => void;
    onDisconnected?: (message: string) => void;
    onToolCall: (call: LocalCanvasAgentToolCall) => void | Promise<void>;
};

export class LocalCanvasAgentClient {
    private source: EventSource | null = null;
    private snapshot: LocalCanvasAgentSnapshot | null = null;
    private reportTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly endpoint: string;

    constructor(private readonly options: LocalCanvasAgentOptions) {
        const endpoint = options.endpoint.trim().replace(/\/+$/, "");
        const parsed = new URL(endpoint);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("本地 Agent 地址仅支持 HTTP 或 HTTPS");
        if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) throw new Error("本地 Agent 只能连接 127.0.0.1 或 localhost");
        if (!options.token.trim()) throw new Error("请输入本地 Agent 连接令牌");
        this.endpoint = endpoint;
    }

    connect(snapshot: LocalCanvasAgentSnapshot) {
        this.disconnect();
        this.snapshot = snapshot;
        const source = new EventSource(`${this.endpoint}/events?${this.query()}`);
        this.source = source;
        source.addEventListener("hello", (event) => {
            const payload = parseEvent<{ protocolVersion?: number }>(event);
            if (payload?.protocolVersion !== LOCAL_CANVAS_AGENT_PROTOCOL_VERSION) {
                this.disconnect();
                this.options.onDisconnected?.("本地 Canvas Agent 版本不兼容，请更新后重试");
                return;
            }
            void this.reportNow();
            void this.activate();
            this.options.onConnected?.();
        });
        source.addEventListener("tool_call", (event) => {
            const call = parseEvent<LocalCanvasAgentToolCall>(event);
            if (call?.requestId && call.name) void this.options.onToolCall(call);
        });
        source.onerror = () => this.options.onDisconnected?.("本地 Canvas Agent 连接中断");
    }

    updateSnapshot(snapshot: LocalCanvasAgentSnapshot) {
        this.snapshot = snapshot;
        if (!this.source) return;
        if (this.reportTimer) clearTimeout(this.reportTimer);
        this.reportTimer = setTimeout(() => void this.reportNow(), 300);
    }

    async reply(requestId: string, result?: unknown, error?: string) {
        await this.post(`/canvas/result?${this.query()}`, { requestId, result, error });
    }

    disconnect() {
        this.source?.close();
        this.source = null;
        if (this.reportTimer) clearTimeout(this.reportTimer);
        this.reportTimer = null;
    }

    private reportNow() {
        return this.post(`/canvas/state?${this.query()}`, this.snapshot ? { ...this.snapshot, hasCanvas: true } : { hasCanvas: false });
    }

    private activate() {
        return this.post(`/canvas/activate?${this.query()}`, {});
    }

    private async post(path: string, body: unknown) {
        const response = await fetch(`${this.endpoint}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `本地 Agent 请求失败：${response.status}`);
        return response.json().catch(() => ({}));
    }

    private query() {
        return new URLSearchParams({ token: this.options.token.trim(), clientId: this.options.clientId }).toString();
    }
}

function parseEvent<T>(event: Event) {
    try {
        return JSON.parse((event as MessageEvent<string>).data) as T;
    } catch {
        return null;
    }
}
