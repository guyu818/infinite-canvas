"use client";

import { useEffect, useRef, useState } from "react";
import { App, Button, Input, Modal, Tag } from "antd";
import { nanoid } from "nanoid";

import { DEFAULT_LOCAL_CANVAS_AGENT_URL, LocalCanvasAgentClient, type LocalCanvasAgentSnapshot, type LocalCanvasAgentToolCall } from "@/services/local-canvas-agent";
import { summarizeLocalCanvasAgentOps } from "../agent/local-canvas-agent-ops";
import { buildCanvasPluginActionOps, buildCanvasPluginCreateOps } from "@/lib/canvas-plugin-agent";

const URL_KEY = "infinite-canvas:local-agent-url";
const TOKEN_KEY = "infinite-canvas:local-agent-token";

export function LocalCanvasAgentModal({ open, snapshot, onClose, onApplyOps }: {
    open: boolean;
    snapshot: LocalCanvasAgentSnapshot;
    onClose: () => void;
    onApplyOps: (ops: unknown) => LocalCanvasAgentSnapshot & { skippedGenerationCount: number };
}) {
    const { message, modal } = App.useApp();
    const [endpoint, setEndpoint] = useState(DEFAULT_LOCAL_CANVAS_AGENT_URL);
    const [token, setToken] = useState("");
    const [status, setStatus] = useState<"offline" | "connecting" | "connected">("offline");
    const clientRef = useRef<LocalCanvasAgentClient | null>(null);
    const snapshotRef = useRef(snapshot);

    useEffect(() => {
        setEndpoint(localStorage.getItem(URL_KEY) || DEFAULT_LOCAL_CANVAS_AGENT_URL);
        setToken(localStorage.getItem(TOKEN_KEY) || "");
        return () => clientRef.current?.disconnect();
    }, []);
    useEffect(() => {
        snapshotRef.current = snapshot;
        clientRef.current?.updateSnapshot(snapshot);
    }, [snapshot]);

    const handleToolCall = async (call: LocalCanvasAgentToolCall) => {
        const client = clientRef.current;
        if (!client) return;
        if (["canvas_get_state", "canvas_export_snapshot"].includes(call.name)) return void client.reply(call.requestId, snapshotRef.current);
        if (call.name === "canvas_get_selection") {
            const selected = new Set(snapshotRef.current.selectedNodeIds);
            return void client.reply(call.requestId, { nodes: snapshotRef.current.nodes.filter((node) => selected.has(node.id)), selectedNodeIds: [...selected] });
        }
        let ops: unknown = call.input?.ops;
        try {
            if (call.name === "canvas_create_plugin_node") {
                const input = call.input || {};
                ops = buildCanvasPluginCreateOps(String(input.pluginType || ""), input as Parameters<typeof buildCanvasPluginCreateOps>[1]);
            } else if (call.name === "canvas_invoke_plugin_action") {
                const input = call.input || {};
                const node = snapshotRef.current.nodes.find((item) => item.id === input.nodeId);
                if (!node) throw new Error("找不到插件节点");
                ops = buildCanvasPluginActionOps(node, String(input.actionId || ""), (input.input || {}) as Record<string, unknown>);
            }
        } catch (error) {
            return void client.reply(call.requestId, undefined, error instanceof Error ? error.message : "插件操作失败");
        }
        if (!Array.isArray(ops)) return void client.reply(call.requestId, undefined, `目标项目暂不支持本地 Agent 工具：${call.name}`);
        modal.confirm({
            title: "允许本地 Agent 修改画布？",
            content: summarizeLocalCanvasAgentOps(ops),
            okText: "允许",
            cancelText: "拒绝",
            onOk: async () => {
                const result = onApplyOps(ops);
                snapshotRef.current = result;
                client.updateSnapshot(result);
                await client.reply(call.requestId, { ...result, generationStarted: false });
                if (result.skippedGenerationCount) message.info("已准备生成流程，自动生成请求已跳过");
            },
            onCancel: () => void client.reply(call.requestId, undefined, "用户拒绝了画布修改"),
        });
    };

    const connect = () => {
        try {
            clientRef.current?.disconnect();
            localStorage.setItem(URL_KEY, endpoint.trim());
            localStorage.setItem(TOKEN_KEY, token.trim());
            const client = new LocalCanvasAgentClient({
                endpoint,
                token,
                clientId: nanoid(),
                onConnected: () => setStatus("connected"),
                onDisconnected: (error) => { setStatus("offline"); message.error(error); },
                onToolCall: handleToolCall,
            });
            clientRef.current = client;
            setStatus("connecting");
            client.connect(snapshotRef.current);
        } catch (error) {
            setStatus("offline");
            message.error(error instanceof Error ? error.message : "本地 Agent 连接失败");
        }
    };

    const disconnect = () => {
        clientRef.current?.disconnect();
        clientRef.current = null;
        setStatus("offline");
    };

    return (
        <Modal title="本地 Canvas Agent" open={open} onCancel={onClose} footer={null} centered destroyOnHidden={false}>
            <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between text-sm"><span>连接状态</span><Tag color={status === "connected" ? "success" : status === "connecting" ? "processing" : "default"}>{status === "connected" ? "已连接" : status === "connecting" ? "连接中" : "未连接"}</Tag></div>
                <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={DEFAULT_LOCAL_CANVAS_AGENT_URL} disabled={status !== "offline"} />
                <Input.Password value={token} onChange={(event) => setToken(event.target.value)} placeholder="Connect token" disabled={status !== "offline"} />
                <p className="text-xs text-stone-500">令牌仅保存在当前浏览器。本地 Agent 的画布写操作必须确认；生成操作只准备节点，不会自动调用模型。</p>
                <div className="flex justify-end gap-2">
                    {status === "offline" ? <Button type="primary" onClick={connect}>连接</Button> : <Button onClick={disconnect}>断开</Button>}
                </div>
            </div>
        </Modal>
    );
}
