export const OFFICIAL_PLUGIN_REGISTRY_URL = "https://raw.githubusercontent.com/guyu818/infinite-canvas/plugins-dist/official-plugins.json";
export const OFFICIAL_PLUGIN_PREFIX = "https://raw.githubusercontent.com/guyu818/infinite-canvas/plugins-dist/";

export type OfficialCanvasPlugin = { id: string; name: string; version: string; description?: string; entry: string };

export function parseOfficialCanvasPluginRegistry(value: unknown): OfficialCanvasPlugin[] {
    const data = value as { version?: unknown; plugins?: unknown };
    if (data?.version !== 1 || !Array.isArray(data.plugins)) throw new Error("官方插件注册表格式错误");
    return data.plugins.flatMap((item): OfficialCanvasPlugin[] => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const entry = new URL(String(record.entry || ""), OFFICIAL_PLUGIN_REGISTRY_URL).toString();
        if (!entry.startsWith(OFFICIAL_PLUGIN_PREFIX) || !record.id) return [];
        return [{ id: String(record.id), name: String(record.name || record.id), version: String(record.version || "0.0.0"), description: record.description ? String(record.description) : undefined, entry }];
    });
}

export function assertOfficialCanvasPluginEntry(entry: string) {
    if (!entry.startsWith(OFFICIAL_PLUGIN_PREFIX)) throw new Error("只允许安装当前 fork 官方注册表中的插件");
}

export function assertLocalCanvasPluginFileName(name: string) {
    if (!/\.(?:js|mjs)$/i.test(name)) throw new Error("请选择构建后的 .js 或 .mjs 插件包");
}
