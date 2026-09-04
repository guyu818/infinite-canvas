import type { LocalCanvasAgentOp } from "../agent/local-canvas-agent-ops";
import { CanvasNodeType, type CanvasNodeData } from "../types";

export const WHITE_MODEL_VIDEO_PROMPT = "严格保持参考视频的镜头运动、人物动作、节奏、构图和时长，将所有人物与场景转为纯白色无纹理的 3D 白模/灰盒预演风格。材质统一为哑光白色，不保留肤色、服装纹理、文字、品牌标识和复杂贴图；使用中性灰白环境、柔和工作室光照与清晰轮廓，画面稳定，人物数量、站位、动作轨迹和镜头切换不得改变。";

export function buildWhiteModelVideoOps(source: CanvasNodeData, id: string, prompt = WHITE_MODEL_VIDEO_PROMPT): LocalCanvasAgentOp[] {
    if (source.type !== CanvasNodeType.Video || !source.metadata?.content) throw new Error("请选择一个已有内容的视频节点");
    return [
        { type: "add_node", id, nodeType: "video", title: `${source.title || "视频"} 白模`, position: { x: source.position.x + source.width + 96, y: source.position.y }, width: source.width, height: source.height, metadata: { status: "idle", prompt, composerContent: prompt, seconds: source.metadata.seconds, size: source.metadata.size, whiteModelSourceNodeId: source.id } },
        { type: "connect_nodes", fromNodeId: source.id, toNodeId: id },
        { type: "select_nodes", ids: [id] },
    ];
}
