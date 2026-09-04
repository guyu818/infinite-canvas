"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, Modal } from "antd";

import { downloadCanvasWebDAVBackup, testCanvasWebDAV, uploadCanvasWebDAVBackup, type CanvasWebDAVBackupConfig } from "@/services/canvas-webdav-backup";
import type { CanvasProject } from "../stores/use-canvas-store";
import { createCanvasBackupArchive } from "../utils/canvas-backup-archive";

const CONFIG_KEY = "infinite-canvas:canvas-webdav-backup";
const defaults: CanvasWebDAVBackupConfig = { url: "", username: "", password: "", directory: "infinite-canvas-backup" };

export function CanvasWebDAVBackupModal({ open, projects, onClose, onRestore }: { open: boolean; projects: CanvasProject[]; onClose: () => void; onRestore: (file: File) => Promise<void> }) {
    const { message, modal } = App.useApp();
    const [config, setConfig] = useState(defaults);
    const [loading, setLoading] = useState<"test" | "backup" | "restore" | "">("");
    useEffect(() => {
        try { setConfig({ ...defaults, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") }); } catch { setConfig(defaults); }
    }, []);
    const run = async (type: typeof loading, action: () => Promise<void>) => {
        setLoading(type);
        try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); await action(); } catch (error) { message.error(error instanceof Error ? error.message : "WebDAV 操作失败"); } finally { setLoading(""); }
    };
    return <Modal title="WebDAV 画布备份" open={open} onCancel={onClose} footer={null} centered>
        <div className="space-y-3 border-t pt-4">
            <Input value={config.url} placeholder="WebDAV 地址" onChange={(event) => setConfig({ ...config, url: event.target.value })} />
            <Input value={config.directory} placeholder="独立备份目录" onChange={(event) => setConfig({ ...config, directory: event.target.value })} />
            <Input value={config.username} placeholder="用户名" onChange={(event) => setConfig({ ...config, username: event.target.value })} />
            <Input.Password value={config.password} placeholder="密码 / 应用密码" onChange={(event) => setConfig({ ...config, password: event.target.value })} />
            <p className="text-xs text-stone-500">独立于媒体存储。备份包含画布、素材索引、导演台工程、生成记录及必要本地媒体，不包含模型 Key、WebDAV 密码和本地 Agent 令牌。</p>
            <div className="flex flex-wrap justify-end gap-2">
                <Button loading={loading === "test"} onClick={() => void run("test", async () => { await testCanvasWebDAV(config); message.success("WebDAV 连接正常"); })}>测试连接</Button>
                <Button loading={loading === "restore"} onClick={() => modal.confirm({ title: "从 WebDAV 恢复画布？", content: "恢复内容会作为新画布导入，不会静默覆盖现有画布。", okText: "恢复", onOk: () => run("restore", async () => { await onRestore(await downloadCanvasWebDAVBackup(config)); message.success("WebDAV 画布已恢复"); }) })}>恢复</Button>
                <Button type="primary" loading={loading === "backup"} disabled={!projects.length} onClick={() => void run("backup", async () => { await uploadCanvasWebDAVBackup(config, await createCanvasBackupArchive(projects)); message.success("画布已备份到 WebDAV"); })}>立即备份</Button>
            </div>
        </div>
    </Modal>;
}
