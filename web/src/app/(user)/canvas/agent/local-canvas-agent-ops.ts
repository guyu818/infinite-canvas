import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "../constants";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type ViewportTransform } from "../types";
import type { LocalCanvasAgentSnapshot } from "@/services/local-canvas-agent";

export type LocalCanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: string; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeData["metadata"] }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeData["metadata"] }
    | { type: "delete_node"; id?: string; ids?: string[] }
    | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "run_generation"; nodeId: string; mode?: string; prompt?: string };

export function applyLocalCanvasAgentOps(snapshot: LocalCanvasAgentSnapshot, input: unknown) {
    const requested = Array.isArray(input) ? (input as LocalCanvasAgentOp[]) : [];
    const ops = requested.filter((op) => op?.type && op.type !== "run_generation");
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;

    ops.forEach((op, index) => {
        if (op.type === "add_node") {
            const type = nodeType(op.nodeType);
            const spec = NODE_DEFAULT_SIZE[type];
            const node: CanvasNodeData = {
                id: op.id || `${type}-${nanoid()}`,
                type,
                title: op.title || spec.title,
                position: op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 },
                width: op.width || spec.width,
                height: op.height || spec.height,
                metadata: { status: "idle", ...op.metadata },
            };
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
        } else if (op.type === "update_node") {
            nodes = nodes.map((node) => node.id === op.id ? { ...node, ...op.patch, metadata: { ...node.metadata, ...op.patch?.metadata, ...op.metadata } } : node);
        } else if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((edge) => !ids.has(edge.fromNodeId) && !ids.has(edge.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
        } else if (op.type === "delete_connections") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            connections = op.all ? [] : connections.filter((edge) => !ids.has(edge.id));
        } else if (op.type === "connect_nodes") {
            const valid = nodes.some((node) => node.id === op.fromNodeId) && nodes.some((node) => node.id === op.toNodeId);
            const exists = connections.some((edge) => edge.fromNodeId === op.fromNodeId && edge.toNodeId === op.toNodeId);
            if (valid && !exists) connections = [...connections, { id: op.id || nanoid(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId } satisfies CanvasConnection];
        } else if (op.type === "set_viewport") viewport = op.viewport;
        else if (op.type === "select_nodes") selectedNodeIds = op.ids.filter((id) => nodes.some((node) => node.id === id));
    });

    return { ...snapshot, nodes, connections, selectedNodeIds, viewport, skippedGenerationCount: requested.length - ops.length };
}

export function summarizeLocalCanvasAgentOps(input: unknown) {
    const labels: Record<string, string> = { add_node: "创建节点", update_node: "更新节点", delete_node: "删除节点", delete_connections: "删除连线", connect_nodes: "创建连线", set_viewport: "调整视口", select_nodes: "选择节点", run_generation: "生成请求（将跳过）" };
    const counts = (Array.isArray(input) ? input : []).reduce<Record<string, number>>((result, item) => {
        const type = typeof item === "object" && item ? String((item as { type?: unknown }).type || "") : "";
        if (type) result[type] = (result[type] || 0) + 1;
        return result;
    }, {});
    return Object.entries(counts).map(([type, count]) => `${labels[type] || type} ${count}`).join("，") || "无有效画布操作";
}

function nodeType(value?: string) {
    return Object.values(CanvasNodeType).includes(value as CanvasNodeType) ? value as CanvasNodeType : CanvasNodeType.Text;
}
