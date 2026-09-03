import type { CanvasPluginNodeDefinition } from "@/types/canvas-plugin";

const definitions = new Map<string, CanvasPluginNodeDefinition>();
const owners = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

export function registerCanvasPluginNodes(pluginId: string, nodes: CanvasPluginNodeDefinition[]) {
    nodes.forEach((node) => { definitions.set(node.type, node); owners.set(node.type, pluginId); });
    version += 1; listeners.forEach((listener) => listener());
}
export function unregisterCanvasPluginNodes(pluginId: string) {
    for (const [type, owner] of owners) if (owner === pluginId) { owners.delete(type); definitions.delete(type); }
    version += 1; listeners.forEach((listener) => listener());
}
export function getCanvasPluginNode(type?: string) { return type ? definitions.get(type) : undefined; }
export function listCanvasPluginNodes() { return [...definitions.values()]; }
export function getCanvasPluginRegistryVersion() { return version; }
export function subscribeCanvasPluginRegistry(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
