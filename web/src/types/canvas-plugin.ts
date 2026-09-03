import type { ComponentType, ReactNode } from "react";
import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasConnection, CanvasNodeData, CanvasNodeMetadata } from "@/app/(user)/canvas/types";
import type { LocalCanvasAgentOp } from "@/app/(user)/canvas/agent/local-canvas-agent-ops";

export type CanvasPluginNodeData = Omit<CanvasNodeData, "type"> & { type: string };

export type CanvasPluginModelCapability = "image" | "video" | "text" | "audio";
export type CanvasPluginAi = {
    generateImage: (prompt: string, options?: { signal?: AbortSignal; references?: string[]; model?: string; count?: number; size?: string }) => Promise<{ images: string[] }>;
    generateVideo: (prompt: string, options?: { signal?: AbortSignal; references?: string[]; model?: string; size?: string; seconds?: string }) => Promise<{ url: string; mimeType: string; width?: number; height?: number; durationMs?: number }>;
    generateText: (prompt: string, options?: { signal?: AbortSignal; model?: string; system?: string; onDelta?: (text: string) => void }) => Promise<{ text: string }>;
    listModels: (capability?: CanvasPluginModelCapability) => Array<{ value: string; label: string }>;
    defaultModel: (capability: CanvasPluginModelCapability) => string;
};

export type CanvasPluginNodeToolbarItem = { id: string; title: string; label: string; icon: ReactNode; onClick: () => void; active?: boolean; danger?: boolean };

export type CanvasPluginNodeContext = {
    node: CanvasPluginNodeData;
    theme: CanvasTheme;
    scale: number;
    isSelected: boolean;
    updateMetadata: (patch: CanvasNodeMetadata) => void;
    updateNode: (patch: Partial<Pick<CanvasNodeData, "title" | "width" | "height">>) => void;
    getNode: (id: string) => CanvasNodeData | null;
    getNodes: () => CanvasNodeData[];
    getConnections: () => CanvasConnection[];
    getUpstream: () => CanvasNodeData[];
    getDownstream: () => CanvasNodeData[];
    applyOps: (ops: LocalCanvasAgentOp[]) => void;
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, handler: (payload: unknown) => void) => () => void;
    ai: CanvasPluginAi;
    openPanel: () => void;
    closePanel: () => void;
    storage: { get: <T = unknown>(key: string) => Promise<T | null>; set: (key: string, value: unknown) => Promise<void>; remove: (key: string) => Promise<void> };
};

export type CanvasPluginNodeDefinition = {
    type: string;
    title: string;
    icon: ReactNode;
    description?: string;
    defaultSize: { width: number; height: number };
    defaultMetadata?: CanvasNodeMetadata;
    minimapColor?: string;
    showInCreateMenu?: boolean;
    hasSourceHandle?: boolean;
    hidePanel?: boolean;
    autoOpenPanel?: boolean;
    transparentBackground?: boolean;
    interactionToggle?: boolean;
    forceInteractive?: (node: CanvasPluginNodeData) => boolean;
    keepAspectRatio?: (node: CanvasPluginNodeData) => boolean;
    useBuiltinPanel?: { mode: "image" | "video" | "text" | "audio"; promptPrefix?: string; writeBackToSelf?: boolean };
    resource?: (node: CanvasPluginNodeData) => { kind: "text" | "image" | "video" | "audio" | "panorama" | "director"; text?: string; url?: string } | null;
    Content?: ComponentType<{ ctx: CanvasPluginNodeContext }>;
    Panel?: ComponentType<{ ctx: CanvasPluginNodeContext; onClose: () => void }>;
    toolbar?: (ctx: CanvasPluginNodeContext) => CanvasPluginNodeToolbarItem[];
    onDoubleClick?: (ctx: CanvasPluginNodeContext) => boolean;
};

export type CanvasPluginApp = { version: string; emit: (event: string, payload?: unknown) => void; on: (event: string, handler: (payload: unknown) => void) => () => void; injectCSS: (css: string, key?: string) => () => void };
export type CanvasPlugin = { id: string; name: string; version: string; description?: string; minAppVersion?: string; css?: string; nodes: CanvasPluginNodeDefinition[]; setup?: (app: CanvasPluginApp) => void | (() => void) };
