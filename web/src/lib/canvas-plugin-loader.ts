"use client";

import React from "react";
import { registerCanvasPluginNodes, unregisterCanvasPluginNodes } from "@/lib/canvas-plugin-registry";
import { usePluginStore, type InstalledCanvasPlugin } from "@/stores/use-plugin-store";
import type { CanvasPlugin, CanvasPluginApp } from "@/types/canvas-plugin";
import { OFFICIAL_PLUGIN_REGISTRY_URL, assertLocalCanvasPluginFileName, assertOfficialCanvasPluginEntry, parseOfficialCanvasPluginRegistry, type OfficialCanvasPlugin } from "@/lib/canvas-plugin-policy";

export { OFFICIAL_PLUGIN_REGISTRY_URL } from "@/lib/canvas-plugin-policy";
const cleanups = new Map<string, () => void>();
const runtimeEvents = new EventTarget();
type PluginRuntime = CanvasPluginApp & { React: typeof React; jsx: typeof React.createElement; Fragment: typeof React.Fragment };
let runtime: PluginRuntime | null = null;
let loaded = false;

export type { OfficialCanvasPlugin } from "@/lib/canvas-plugin-policy";

export async function fetchOfficialCanvasPlugins() {
    const response = await fetch(OFFICIAL_PLUGIN_REGISTRY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`官方插件注册表拉取失败：${response.status}`);
    return parseOfficialCanvasPluginRegistry(await response.json());
}

export async function installOfficialCanvasPlugin(entry: OfficialCanvasPlugin) {
    assertOfficialCanvasPluginEntry(entry.entry);
    const response = await fetch(entry.entry, { cache: "no-store" });
    if (!response.ok) throw new Error(`插件下载失败：${response.status}`);
    return install(await response.text(), true);
}

export async function installLocalCanvasPlugin(file: File) {
    assertLocalCanvasPluginFileName(file.name);
    return install(await file.text(), false);
}

export async function setCanvasPluginEnabled(record: InstalledCanvasPlugin, enabled: boolean) {
    usePluginStore.getState().setEnabled(record.id, enabled);
    if (!enabled) return deactivate(record.id);
    activate(await evaluate(record.source));
}

export function uninstallCanvasPlugin(id: string) { deactivate(id); usePluginStore.getState().remove(id); }

export async function loadEnabledCanvasPlugins() {
    if (loaded) return;
    loaded = true;
    await usePluginStore.persist.rehydrate();
    for (const record of usePluginStore.getState().plugins.filter((item) => item.enabled)) {
        try { activate(await evaluate(record.source)); } catch (error) { console.error(`[plugin] ${record.id}`, error); }
    }
}

async function install(source: string, official: boolean) {
    const plugin = await evaluate(source);
    deactivate(plugin.id);
    usePluginStore.getState().upsert({ id: plugin.id, name: plugin.name, version: plugin.version, description: plugin.description, source, enabled: true, official, installedAt: new Date().toISOString() });
    activate(plugin);
    return plugin;
}

async function evaluate(source: string) {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
        const app = pluginApp();
        (globalThis as typeof globalThis & { InfiniteCanvasRuntime?: unknown }).InfiniteCanvasRuntime = app;
        const module = await import(/* webpackIgnore: true */ url) as { default?: unknown; plugin?: unknown };
        const exported = module.default ?? module.plugin;
        const plugin = typeof exported === "function" ? (exported as (runtime: unknown) => unknown)(app) : exported;
        assertPlugin(plugin);
        return plugin;
    } finally { URL.revokeObjectURL(url); }
}

function assertPlugin(value: unknown): asserts value is CanvasPlugin {
    const plugin = value as Partial<CanvasPlugin> | null;
    if (!plugin || typeof plugin !== "object" || !plugin.id || !plugin.name || !plugin.version || !Array.isArray(plugin.nodes) || !plugin.nodes.length) throw new Error("插件导出格式无效");
    if (plugin.nodes.some((node) => !node.type.startsWith(`${plugin.id}:`))) throw new Error("插件节点类型必须使用插件 ID 作为命名空间");
}

function activate(plugin: CanvasPlugin) {
    registerCanvasPluginNodes(plugin.id, plugin.nodes);
    if (plugin.css) {
        const style = document.createElement("style"); style.dataset.canvasPlugin = plugin.id; style.textContent = plugin.css; document.head.appendChild(style);
        cleanups.set(plugin.id, () => style.remove());
    }
    const cleanup = plugin.setup?.(pluginApp());
    if (typeof cleanup === "function") { const previous = cleanups.get(plugin.id); cleanups.set(plugin.id, () => { previous?.(); cleanup(); }); }
}
function deactivate(id: string) { cleanups.get(id)?.(); cleanups.delete(id); unregisterCanvasPluginNodes(id); }

function pluginApp(): PluginRuntime {
    if (runtime) return runtime;
    runtime = {
        React,
        jsx: React.createElement,
        Fragment: React.Fragment,
        version: "dev",
        emit: (event: string, payload?: unknown) => runtimeEvents.dispatchEvent(new CustomEvent(event, { detail: payload })),
        on: (event: string, handler: (payload: unknown) => void) => {
            const listener = (value: Event) => handler((value as CustomEvent).detail);
            runtimeEvents.addEventListener(event, listener);
            return () => runtimeEvents.removeEventListener(event, listener);
        },
        injectCSS: (css: string, key = "runtime") => {
            const selector = `style[data-canvas-plugin-runtime="${CSS.escape(key)}"]`;
            document.head.querySelector(selector)?.remove();
            const style = document.createElement("style");
            style.dataset.canvasPluginRuntime = key;
            style.textContent = css;
            document.head.appendChild(style);
            return () => style.remove();
        },
    };
    return runtime;
}
