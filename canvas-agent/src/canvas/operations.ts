import crypto from "node:crypto";

import type { ToolName } from "./schemas.js";
import { nextCanvasX } from "./tools.js";
import type { CanvasNode, CanvasNodeType, CanvasSnapshot } from "./types.js";

export type CanvasToolRequest = { name: "canvas_apply_ops" | "canvas_create_plugin_node" | "canvas_invoke_plugin_action"; input: Record<string, unknown> };

/** 将上层画布工具调用转换为前端可执行的批量操作。 */
export function buildCanvasToolRequest(name: ToolName, input: Record<string, unknown>, state: CanvasSnapshot | null): CanvasToolRequest {
    if (name === "canvas_apply_ops") return { name, input };
    if (name === "canvas_create_node") {
        const data = input as { nodeType: CanvasNodeType; title?: string; x?: number; y?: number; width?: number; height?: number; metadata?: Record<string, unknown> };
        return applyOps([{ type: "add_node", nodeType: data.nodeType, title: data.title, position: { x: data.x ?? nextCanvasX(state), y: data.y ?? 0 }, width: data.width, height: data.height, metadata: data.metadata }]);
    }
    if (name === "canvas_create_text_node") {
        const data = input as { text?: string; x?: number; y?: number; title?: string; width?: number; height?: number };
        return applyOps([textNodeOp(data, data.x ?? nextCanvasX(state), data.y ?? 0)]);
    }
    if (name === "canvas_create_text_nodes") {
        const data = input as { items: Array<{ text: string; title?: string; x?: number; y?: number; width?: number; height?: number }>; x?: number; y?: number; gap?: number; direction?: "row" | "column" };
        const x = Number(data.x ?? nextCanvasX(state));
        const y = Number(data.y ?? 0);
        const gap = Number(data.gap ?? 40);
        return applyOps(data.items.map((item, index) => textNodeOp(item, item.x ?? (data.direction === "row" ? x + index * (340 + gap) : x), item.y ?? (data.direction === "row" ? y : y + index * (240 + gap)))));
    }
    if (name === "canvas_create_image_prompt_flow") return applyOps(generationFlowOps({ ...input, mode: "image" }, state));
    if (name === "canvas_create_config_node") {
        const x = Number(input.x ?? nextCanvasX(state));
        const y = Number(input.y ?? 0);
        const configId = `config-${crypto.randomUUID()}`;
        return applyOps([configNodeOp(configId, input, x, y)]);
    }
    if (name === "canvas_create_generation_flow") return applyOps(generationFlowOps(input, state));
    if (name === "canvas_create_director_video_storyboard") return applyOps(directorVideoStoryboardOps(input, state));
    if (name === "canvas_create_white_model_video") return applyOps(whiteModelVideoOps(input, state));
    if (name === "canvas_create_plugin_node" || name === "canvas_invoke_plugin_action") return { name, input };
    if (name === "canvas_generate_text" || name === "canvas_generate_image" || name === "canvas_generate_video" || name === "canvas_generate_audio") {
        return applyOps(generationFlowOps({ ...input, mode: name.replace("canvas_generate_", ""), autoRun: false }, state));
    }
    if (name === "canvas_update_node") {
        const data = input as { id: string; patch?: Record<string, unknown>; metadata?: Record<string, unknown> };
        return applyOps([{ type: "update_node", id: data.id, patch: data.patch, metadata: data.metadata }]);
    }
    if (name === "canvas_update_node_text") {
        const data = input as { id: string; text: string; title?: string };
        return applyOps([{ type: "update_node", id: data.id, patch: { ...(data.title ? { title: data.title } : {}) }, metadata: { content: data.text, status: "success" } }]);
    }
    if (name === "canvas_move_nodes") {
        const data = input as { items: Array<{ id: string; x?: number; y?: number; dx?: number; dy?: number }> };
        return applyOps(data.items.map((item) => {
            const current = findNode(state, item.id);
            return { type: "update_node", id: item.id, patch: { position: { x: item.x ?? ((current?.position.x || 0) + (item.dx || 0)), y: item.y ?? ((current?.position.y || 0) + (item.dy || 0)) } } };
        }));
    }
    if (name === "canvas_resize_node") {
        const data = input as { id: string; width: number; height: number; freeResize?: boolean };
        return applyOps([{ type: "update_node", id: data.id, patch: { width: data.width, height: data.height }, metadata: data.freeResize === undefined ? undefined : { freeResize: data.freeResize } }]);
    }
    if (name === "canvas_delete_nodes") return applyOps([{ type: "delete_node", ids: (input as { ids: string[] }).ids }]);
    if (name === "canvas_connect_nodes") {
        const data = input as { connections: Array<{ fromNodeId: string; toNodeId: string }> };
        return applyOps(data.connections.map((connection) => ({ type: "connect_nodes", ...connection })));
    }
    if (name === "canvas_select_nodes") return applyOps([{ type: "select_nodes", ids: (input as { ids: string[] }).ids }]);
    if (name === "canvas_set_viewport") return applyOps([{ type: "set_viewport", viewport: (input as { viewport: unknown }).viewport }]);
    if (name === "canvas_run_generation") {
        const data = input as { nodeId: string; mode?: string; prompt?: string };
        return applyOps([{ type: "select_nodes", ids: [data.nodeId] }]);
    }
    throw new Error(`未知工具：${name}`);
}

const WHITE_MODEL_VIDEO_PROMPT = "严格保持参考视频的镜头运动、人物动作、节奏、构图和时长，将所有人物与场景转为纯白色无纹理的 3D 白模/灰盒预演风格。材质统一为哑光白色，不保留肤色、服装纹理、文字、品牌标识和复杂贴图；使用中性灰白环境、柔和工作室光照与清晰轮廓，画面稳定，人物数量、站位、动作轨迹和镜头切换不得改变。";

function whiteModelVideoOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const sourceId = String(input.videoNodeId || "");
    const source = findNode(state, sourceId);
    if (!source || source.type !== "video" || !source.metadata?.content) throw new Error("找不到已有内容的视频节点");
    const id = `video-${crypto.randomUUID()}`;
    const prompt = String(input.prompt || WHITE_MODEL_VIDEO_PROMPT);
    return [
        { type: "add_node", id, nodeType: "video", title: String(input.title || `${source.title || "视频"} 白模`), position: { x: Number(input.x ?? source.position.x + source.width + 96), y: Number(input.y ?? source.position.y) }, width: source.width, height: source.height, metadata: cleanRecord({ status: "idle", prompt, composerContent: prompt, seconds: input.seconds || source.metadata?.seconds, size: input.size || source.metadata?.size, model: input.model, whiteModelSourceNodeId: sourceId }) },
        { type: "connect_nodes", fromNodeId: sourceId, toNodeId: id },
        { type: "select_nodes", ids: [id] },
    ];
}

/** 将导演台截图图片准备为视频首帧，生成仍由用户在网页中手动确认。 */
function directorVideoStoryboardOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const imageNodeId = String(input.imageNodeId || "");
    const image = findNode(state, imageNodeId);
    if (!image || (image.type !== "image" && image.type !== "panorama")) throw new Error("找不到导演台截图图片节点");
    const fromDirector = (state?.connections || []).some((connection) => connection.toNodeId === imageNodeId && findNode(state, connection.fromNodeId)?.type === "director");
    if (!fromDirector) throw new Error("该图片不是由导演台输出的截图");
    const id = `video-${crypto.randomUUID()}`;
    const x = Number(input.x ?? image.position.x + image.width + 96);
    const y = Number(input.y ?? image.position.y);
    const prompt = String(input.prompt || "");
    return [
        { type: "add_node", id, nodeType: "video", title: String(input.title || `${image.title || "导演截图"} 视频分镜`), position: { x, y }, metadata: cleanRecord({ status: "idle", prompt, firstFrameNodeId: imageNodeId, references: image.metadata?.content ? [image.metadata.content] : [], model: input.model, size: input.size, seconds: input.seconds }) },
        { type: "connect_nodes", fromNodeId: imageNodeId, toNodeId: id },
        { type: "select_nodes", ids: [id] },
    ];
}

/** 按最大边限制计算附件图片节点尺寸，并保持原始比例。 */
export function fitAttachmentNodeSize(width: number, height: number) {
    const scale = Math.min(1, 640 / width, 640 / height);
    return { width: width * scale, height: height * scale };
}

/** 创建统一的批量画布操作请求。 */
function applyOps(ops: unknown[]): CanvasToolRequest {
    return { name: "canvas_apply_ops", input: { ops } };
}

/** 创建文本节点操作。 */
function textNodeOp(input: { id?: string; text?: string; title?: string; width?: number; height?: number }, x: number, y: number) {
    return { type: "add_node", id: input.id, nodeType: "text", title: input.title, position: { x, y }, width: input.width, height: input.height, metadata: { content: input.text || "", status: "success", fontSize: 14 } };
}

/** 创建生成配置节点操作。 */
function configNodeOp(id: string, input: Record<string, unknown>, x: number, y: number) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    return {
        type: "add_node",
        id,
        nodeType: "config",
        title: String(input.title || generationTitle(mode)),
        position: { x, y },
        width: typeof input.width === "number" ? input.width : undefined,
        height: typeof input.height === "number" ? input.height : undefined,
        metadata: cleanRecord({
            generationMode: mode,
            composerContent: prompt,
            prompt,
            status: "idle",
            model: input.model,
            size: input.size,
            quality: input.quality,
            count: input.count,
            seconds: input.seconds,
            vquality: input.vquality,
            generateAudio: input.generateAudio,
            watermark: input.watermark,
            videoMode: input.videoMode,
            audioVoice: input.audioVoice,
            audioFormat: input.audioFormat,
            audioSpeed: input.audioSpeed,
            audioInstructions: input.audioInstructions,
        }),
    };
}

/** 创建包含提示词、配置节点和引用连线的生成流程。 */
function generationFlowOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    const x = Number(input.x ?? nextCanvasX(state));
    const y = Number(input.y ?? 0);
    const textId = `text-${crypto.randomUUID()}`;
    const configId = `config-${crypto.randomUUID()}`;
    const referenceNodeIds = Array.isArray(input.referenceNodeIds) ? input.referenceNodeIds.filter((id): id is string => typeof id === "string") : [];
    // When the prompt only @-mentions nodes already passed as references, reuse them instead of minting a duplicate text node.
    const mentionedIds = [...prompt.matchAll(/@\[node:([\w-]+)\]/g)].map((match) => match[1]);
    const reuseReferences = referenceNodeIds.length > 0 && mentionedIds.length > 0
        && mentionedIds.every((id) => referenceNodeIds.includes(id))
        && prompt.replace(/@\[node:[\w-]+\]/g, "").trim() === "";
    const tokens = reuseReferences ? referenceNodeIds.map((id) => `@[node:${id}]`) : [`@[node:${textId}]`, ...referenceNodeIds.map((id) => `@[node:${id}]`)];
    return [
        ...(reuseReferences ? [] : [textNodeOp({ id: textId, text: prompt, title: String(input.title || "提示词") }, x, y)]),
        configNodeOp(configId, { ...input, prompt: tokens.join("\n") }, x + 420, y),
        ...(reuseReferences ? [] : [{ type: "connect_nodes", fromNodeId: textId, toNodeId: configId }]),
        ...referenceNodeIds.map((fromNodeId) => ({ type: "connect_nodes", fromNodeId, toNodeId: configId })),
        { type: "select_nodes", ids: [configId] },
    ];
}

/** 将未知生成模式归一为画布支持的模式。 */
function generationMode(value: unknown): "text" | "image" | "video" | "audio" {
    return value === "text" || value === "video" || value === "audio" ? value : "image";
}

/** 获取生成模式对应的默认节点标题。 */
function generationTitle(mode: "text" | "image" | "video" | "audio") {
    if (mode === "text") return "文本生成";
    if (mode === "video") return "视频生成";
    if (mode === "audio") return "音频生成";
    return "图片生成";
}

/** 按节点 ID 查找当前画布节点。 */
function findNode(state: CanvasSnapshot | null, id: string): CanvasNode | undefined {
    return (state?.nodes || []).find((node) => node.id === id);
}

/** 移除对象中未设置的生成参数。 */
function cleanRecord(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}
