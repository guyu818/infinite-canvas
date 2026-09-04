export const CANVAS_BACKUP_APP = "guyu818-infinite-canvas-canvas-backup";

export function removeBackupSecrets(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(removeBackupSecrets);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/(?:api.?key|password|authorization|access.?token|agent.?token|secret)/i.test(key)).map(([key, item]) => [key, removeBackupSecrets(item)]));
}

export function replaceBackupStorageKeys(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
    if (typeof value === "string") return replacements.get(value) || value;
    if (Array.isArray(value)) return value.map((item) => replaceBackupStorageKeys(item, replacements));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceBackupStorageKeys(item, replacements)]));
}

export function assertCanvasBackupManifest(value: unknown): asserts value is { app: typeof CANVAS_BACKUP_APP; version: 1; projects: unknown[]; assets: unknown[]; imageGenerationLogs: unknown[]; videoGenerationLogs: unknown[]; media: unknown[] } {
    const manifest = value as Record<string, unknown> | null;
    if (!manifest || manifest.app !== CANVAS_BACKUP_APP || manifest.version !== 1 || !Array.isArray(manifest.projects) || !Array.isArray(manifest.assets) || !Array.isArray(manifest.imageGenerationLogs) || !Array.isArray(manifest.videoGenerationLogs) || !Array.isArray(manifest.media)) throw new Error("不是本项目生成的 WebDAV 画布备份");
}
