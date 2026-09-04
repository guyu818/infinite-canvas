/** 画布坐标。 */
export type Position = { x: number; y: number };
export type Viewport = { x: number; y: number; k: number };
export type CanvasNodeType = "image" | "panorama" | "text" | "config" | "video" | "audio" | "director" | "plugin";
export type CanvasNode = { id: string; type: CanvasNodeType; title?: string; position: Position; width: number; height: number; metadata?: Record<string, unknown> };
export type CanvasConnection = { id: string; fromNodeId: string; toNodeId: string };
export type CanvasPluginSummary = { type: string; title: string; description?: string; defaultSize: { width: number; height: number }; actions: Array<{ id: string; title: string; description?: string }> };
export type CanvasSnapshot = { projectId?: string; title?: string; nodes?: CanvasNode[]; connections?: CanvasConnection[]; selectedNodeIds?: string[]; viewport?: Viewport; plugins?: CanvasPluginSummary[]; clientId?: string };
