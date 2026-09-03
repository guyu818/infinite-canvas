"use client";

import localforage from "localforage";
import { nanoid } from "nanoid";

import { createZip, readZip } from "@/lib/zip";
import { getMediaBlob, setMediaBlob } from "@/services/file-storage";
import { getImageBlob, setImageBlob } from "@/services/image-storage";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import type { CanvasProject } from "../stores/use-canvas-store";
import { CANVAS_BACKUP_APP, assertCanvasBackupManifest, removeBackupSecrets, replaceBackupStorageKeys } from "./canvas-backup-security";

const IMAGE_LOG_STORE = "image_generation_logs";
const VIDEO_LOG_STORE = "video_generation_logs";

type BackupRecord = { key: string; value: unknown };
type BackupMedia = { storageKey: string; path: string; mimeType: string; bytes: number };
export type CanvasBackupManifest = {
    app: typeof CANVAS_BACKUP_APP;
    version: 1;
    exportedAt: string;
    projects: CanvasProject[];
    assets: Asset[];
    imageGenerationLogs: BackupRecord[];
    videoGenerationLogs: BackupRecord[];
    media: BackupMedia[];
};

export async function createCanvasBackupArchive(projects: CanvasProject[]) {
    const raw = {
        projects,
        assets: useAssetStore.getState().assets,
        imageGenerationLogs: await readStore(IMAGE_LOG_STORE),
        videoGenerationLogs: await readStore(VIDEO_LOG_STORE),
    };
    const clean = removeBackupSecrets(raw) as Omit<CanvasBackupManifest, "app" | "version" | "exportedAt" | "media">;
    const files: Array<{ name: string; data: BlobPart }> = [];
    const media: BackupMedia[] = [];
    for (const storageKey of collectStorageKeys(clean)) {
        const blob = await getImageBlob(storageKey) || await getMediaBlob(storageKey);
        if (!blob) continue;
        const path = `media/${safeFileName(storageKey)}.${fileExtension(blob.type)}`;
        files.push({ name: path, data: blob });
        media.push({ storageKey, path, mimeType: blob.type || "application/octet-stream", bytes: blob.size });
    }
    const manifest: CanvasBackupManifest = { app: CANVAS_BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), ...clean, media };
    return createZip([{ name: "backup.json", data: JSON.stringify(manifest, null, 2) }, ...files]);
}

export async function readCanvasBackupArchive(file: Blob) {
    const zip = await readZip(file);
    const manifestFile = zip.get("backup.json");
    if (!manifestFile) return null;
    const manifest = JSON.parse(await manifestFile.text()) as CanvasBackupManifest;
    assertCanvasBackupManifest(manifest);
    const replacements = new Map(manifest.media.map((item) => [item.storageKey, restoredStorageKey(item.storageKey)]));
    for (const item of manifest.media) {
        const blob = zip.get(item.path);
        if (!blob) throw new Error(`备份媒体缺失：${item.path}`);
        const typed = blob.slice(0, blob.size, item.mimeType);
        const storageKey = replacements.get(item.storageKey) || item.storageKey;
        await (item.mimeType.startsWith("image/") ? setImageBlob(storageKey, typed) : setMediaBlob(storageKey, typed));
    }
    return replaceBackupStorageKeys(manifest, replacements) as CanvasBackupManifest;
}

export async function restoreCanvasBackupRecords(manifest: CanvasBackupManifest) {
    const assets = useAssetStore.getState();
    manifest.assets.forEach((asset) => assets.addAsset({ kind: asset.kind, title: asset.title, coverUrl: asset.coverUrl, tags: asset.tags, source: asset.source, note: asset.note, metadata: asset.metadata, data: asset.data } as Omit<Asset, "id" | "createdAt" | "updatedAt">));
    await restoreStore(IMAGE_LOG_STORE, manifest.imageGenerationLogs);
    await restoreStore(VIDEO_LOG_STORE, manifest.videoGenerationLogs);
}

async function readStore(storeName: string) {
    const records: BackupRecord[] = [];
    await localforage.createInstance({ name: "infinite-canvas", storeName }).iterate((value, key) => { records.push({ key, value }); });
    return records;
}

async function restoreStore(storeName: string, records: BackupRecord[]) {
    const store = localforage.createInstance({ name: "infinite-canvas", storeName });
    for (const record of records || []) {
        let key = record.key;
        for (let index = 1; await store.getItem(key) !== null; index += 1) key = `${record.key}-restored-${index}`;
        await store.setItem(key, record.value);
    }
}

function collectStorageKeys(value: unknown, keys = new Set<string>()): string[] {
    if (!value || typeof value !== "object") return [...keys];
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => collectStorageKeys(item, keys));
    return [...keys];
}

function safeFileName(value: string) { return value.replace(/[\\/:*?"<>|]/g, "_"); }
function restoredStorageKey(value: string) { return `${value.split(":", 1)[0] || "file"}:restored-${nanoid()}`; }
function fileExtension(mimeType: string) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    return mimeType.includes("mp4") ? "mp4" : "bin";
}
