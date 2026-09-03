"use client";

import { useMemo } from "react";
import localforage from "localforage";

import { getCanvasPluginNode } from "@/lib/canvas-plugin-registry";
import type { CanvasTheme } from "@/lib/canvas-theme";
import { requestEdit, requestGeneration, requestImageQuestion, type ChatCompletionMessage } from "@/services/api/image";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { resolveModelForCapability, selectableModelsByCapability, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { CanvasPluginAi, CanvasPluginNodeContext, CanvasPluginNodeToolbarItem } from "@/types/canvas-plugin";
import type { LocalCanvasAgentOp } from "../agent/local-canvas-agent-ops";
import type { CanvasConnection, CanvasNodeData, CanvasNodeMetadata } from "../types";

const events = new EventTarget();

export type PluginNodeProps = {
    node: CanvasNodeData;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    theme: CanvasTheme;
    scale: number;
    selected: boolean;
    onUpdate: (patch: Partial<CanvasNodeData>, metadata?: CanvasNodeMetadata) => void;
    onApplyOps: (ops: LocalCanvasAgentOp[]) => void;
    onOpenPanel: () => void;
    onClosePanel: () => void;
};

export function CanvasPluginNodeContent(props: PluginNodeProps) {
    const definition = getCanvasPluginNode(props.node.metadata?.pluginType);
    const ctx = useCanvasPluginNodeContext(props);
    if (!definition?.Content) return <div className="grid h-full place-items-center text-sm" style={{ color: props.theme.node.muted }}>插件未安装或已停用</div>;
    const Content = definition.Content;
    const interactive = !definition.interactionToggle || definition.forceInteractive?.(props.node) || props.node.metadata?.interactive;
    return <div className="h-full w-full" style={{ pointerEvents: interactive ? "auto" : "none" }}><Content ctx={ctx} /></div>;
}

export function CanvasPluginNodePanel(props: PluginNodeProps) {
    const definition = getCanvasPluginNode(props.node.metadata?.pluginType);
    const ctx = useCanvasPluginNodeContext(props);
    if (!definition?.Panel) return null;
    const Panel = definition.Panel;
    return <Panel ctx={ctx} onClose={props.onClosePanel} />;
}

export function useCanvasPluginToolbarItems(props: PluginNodeProps): CanvasPluginNodeToolbarItem[] {
    const definition = getCanvasPluginNode(props.node.metadata?.pluginType);
    const ctx = useCanvasPluginNodeContext(props);
    const custom = definition?.toolbar?.(ctx) || [];
    if (!definition?.interactionToggle || definition.forceInteractive?.(props.node)) return custom;
    const interactive = Boolean(props.node.metadata?.interactive);
    return [{ id: "plugin-interaction-toggle", title: interactive ? "切换为移动节点" : "切换为操作插件内容", label: interactive ? "移动" : "交互", icon: interactive ? "✋" : "🖐", active: interactive, onClick: () => props.onUpdate({}, { interactive: !interactive }) }, ...custom];
}

function useCanvasPluginNodeContext(props: PluginNodeProps): CanvasPluginNodeContext {
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const store = useMemo(() => localforage.createInstance({ name: "infinite-canvas", storeName: `plugin_${props.node.metadata?.pluginType?.split(":")[0] || "unknown"}` }), [props.node.metadata?.pluginType]);
    const ai = useMemo<CanvasPluginAi>(() => {
        const ensureReady = (config: AiConfig) => {
            if (isAiConfigReady(config, config.model)) return;
            openConfigDialog(true);
            throw new Error("请先配置可用的模型渠道");
        };
        const references = (items?: string[]): ReferenceImage[] => (items || []).filter(Boolean).map((dataUrl, index) => ({ id: `plugin-ref-${index}`, name: `plugin-ref-${index}.png`, type: "image/png", dataUrl }));
        return {
            generateImage: async (prompt, options) => {
                options?.signal?.throwIfAborted();
                const config = pluginGenerationConfig(effectiveConfig, "image", options?.model, options?.size);
                config.count = String(options?.count || 1);
                ensureReady(config);
                const refs = references(options?.references);
                const result = refs.length ? await requestEdit(config, prompt, refs) : await requestGeneration(config, prompt);
                options?.signal?.throwIfAborted();
                return { images: result.map((item) => item.dataUrl) };
            },
            generateVideo: async (prompt, options) => {
                options?.signal?.throwIfAborted();
                const config = pluginGenerationConfig(effectiveConfig, "video", options?.model, options?.size);
                if (options?.seconds) config.videoSeconds = options.seconds;
                ensureReady(config);
                const file = storeGeneratedVideo(await requestVideoGeneration(config, prompt, references(options?.references)));
                options?.signal?.throwIfAborted();
                return { url: file.url, mimeType: file.mimeType, width: file.width, height: file.height, durationMs: file.durationMs };
            },
            generateText: async (prompt, options) => {
                options?.signal?.throwIfAborted();
                const config = pluginGenerationConfig(effectiveConfig, "text", options?.model);
                ensureReady(config);
                const messages: ChatCompletionMessage[] = [...(options?.system ? [{ role: "system" as const, content: options.system }] : []), { role: "user", content: prompt }];
                const text = await requestImageQuestion(config, messages, (value) => options?.onDelta?.(value));
                options?.signal?.throwIfAborted();
                return { text };
            },
            listModels: (capability) => selectableModelsByCapability(effectiveConfig, capability).map((value) => ({ value, label: value })),
            defaultModel: (capability) => resolveModelForCapability(effectiveConfig, undefined, capability),
        };
    }, [effectiveConfig, isAiConfigReady, openConfigDialog]);
    const linked = (direction: "up" | "down") => props.connections.flatMap((edge) => {
        const id = direction === "up" && edge.toNodeId === props.node.id ? edge.fromNodeId : direction === "down" && edge.fromNodeId === props.node.id ? edge.toNodeId : "";
        return id ? props.nodes.filter((item) => item.id === id) : [];
    });
    return {
        node: { ...props.node, type: props.node.metadata?.pluginType || props.node.type },
        theme: props.theme,
        scale: props.scale,
        isSelected: props.selected,
        updateMetadata: (metadata) => props.onUpdate({}, metadata),
        updateNode: (patch) => props.onUpdate(patch),
        getNode: (id) => props.nodes.find((item) => item.id === id) || null,
        getNodes: () => props.nodes,
        getConnections: () => props.connections,
        getUpstream: () => linked("up"),
        getDownstream: () => linked("down"),
        applyOps: props.onApplyOps,
        emit: (event, payload) => events.dispatchEvent(new CustomEvent(event, { detail: payload })),
        on: (event, handler) => { const listener = (value: Event) => handler((value as CustomEvent).detail); events.addEventListener(event, listener); return () => events.removeEventListener(event, listener); },
        ai,
        openPanel: props.onOpenPanel,
        closePanel: props.onClosePanel,
        storage: { get: <T,>(key: string) => store.getItem<T>(key), set: (key, value) => store.setItem(key, value).then(() => undefined), remove: (key) => store.removeItem(key) },
    };
}

function pluginGenerationConfig(config: AiConfig, capability: "image" | "video" | "text" | "audio", model?: string, size?: string): AiConfig {
    const selectedModel = model || resolveModelForCapability(config, undefined, capability);
    const channelId = capability === "image" ? config.imageChannelId : capability === "video" ? config.videoChannelId : capability === "audio" ? config.audioChannelId : config.textChannelId;
    return { ...config, model: selectedModel, activeChannelId: channelId || config.activeChannelId, ...(capability === "image" && size ? { size } : {}), ...(capability === "video" && size ? { videoSize: size } : {}) };
}
