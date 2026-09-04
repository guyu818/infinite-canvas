import { nanoid } from "nanoid";

import type { LocalCanvasAgentOp } from "@/app/(user)/canvas/agent/local-canvas-agent-ops";
import type { CanvasNodeData } from "@/app/(user)/canvas/types";
import { getCanvasPluginNode, listCanvasPluginNodes } from "@/lib/canvas-plugin-registry";

export function listCanvasPluginAgentNodes() {
    return listCanvasPluginNodes().map((node) => ({
        type: node.type,
        title: node.title,
        description: node.description,
        defaultSize: node.defaultSize,
        actions: (node.agentActions || []).map(({ id, title, description }) => ({ id, title, description })),
    }));
}

export function buildCanvasPluginCreateOps(pluginType: string, input: { id?: string; title?: string; x?: number; y?: number; width?: number; height?: number; metadata?: Record<string, unknown> }): LocalCanvasAgentOp[] {
    const definition = getCanvasPluginNode(pluginType);
    if (!definition) throw new Error(`插件未安装或已停用：${pluginType}`);
    const id = input.id || `plugin-${nanoid()}`;
    return [
        { type: "add_node", id, nodeType: "plugin", title: input.title || definition.title, position: { x: input.x || 0, y: input.y || 0 }, width: input.width || definition.defaultSize.width, height: input.height || definition.defaultSize.height, metadata: { ...definition.defaultMetadata, ...input.metadata, pluginType } },
        { type: "select_nodes", ids: [id] },
    ];
}

export function buildCanvasPluginActionOps(node: CanvasNodeData, actionId: string, input: Record<string, unknown>): LocalCanvasAgentOp[] {
    const definition = getCanvasPluginNode(node.metadata?.pluginType);
    if (!definition) throw new Error(`插件未安装或已停用：${node.metadata?.pluginType || "unknown"}`);
    const action = definition.agentActions?.find((item) => item.id === actionId);
    if (!action) throw new Error(`插件动作不存在：${actionId}`);
    return action.run({ ...node, type: definition.type }, input);
}
