"use client";

import { useEffect, useRef, useState } from "react";
import { App, Button, List, Modal, Switch, Tag } from "antd";
import { fetchOfficialCanvasPlugins, installLocalCanvasPlugin, installOfficialCanvasPlugin, loadEnabledCanvasPlugins, setCanvasPluginEnabled, uninstallCanvasPlugin, type OfficialCanvasPlugin } from "@/lib/canvas-plugin-loader";
import { usePluginStore } from "@/stores/use-plugin-store";

export function CanvasPluginManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const plugins = usePluginStore((state) => state.plugins);
    const [official, setOfficial] = useState<OfficialCanvasPlugin[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { void loadEnabledCanvasPlugins(); }, []);
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        void fetchOfficialCanvasPlugins().then(setOfficial).catch((error) => message.warning(error instanceof Error ? error.message : "官方插件列表不可用")).finally(() => setLoading(false));
    }, [message, open]);
    const installedIds = new Set(plugins.map((item) => item.id));
    return <Modal title="画布插件" open={open} onCancel={onClose} footer={null} width={720} centered>
        <div className="space-y-5 border-t pt-4">
            <div className="flex items-center justify-between"><p className="text-sm text-stone-500">仅支持你的 fork 官方注册表和本地插件包。</p><Button onClick={() => inputRef.current?.click()}>导入本地插件</Button></div>
            <List header="已安装" locale={{ emptyText: "暂无已安装插件" }} dataSource={plugins} renderItem={(item) => <List.Item actions={[<Switch key="enabled" checked={item.enabled} onChange={(enabled) => void setCanvasPluginEnabled(item, enabled).catch((error) => message.error(String(error)))} />, <Button key="remove" type="link" danger onClick={() => uninstallCanvasPlugin(item.id)}>卸载</Button>]}><List.Item.Meta title={<span>{item.name} <Tag>{item.official ? "官方" : "本地"}</Tag></span>} description={`${item.version}${item.description ? ` · ${item.description}` : ""}`} /></List.Item>} />
            <List loading={loading} header="官方插件" locale={{ emptyText: "官方注册表暂无插件" }} dataSource={official} renderItem={(item) => <List.Item actions={[<Button key="install" disabled={installedIds.has(item.id)} onClick={() => void installOfficialCanvasPlugin(item).then(() => message.success("插件已安装")).catch((error) => message.error(String(error)))}>{installedIds.has(item.id) ? "已安装" : "安装"}</Button>]}><List.Item.Meta title={item.name} description={`${item.version}${item.description ? ` · ${item.description}` : ""}`} /></List.Item>} />
            <input ref={inputRef} className="hidden" type="file" accept=".js,.mjs,text/javascript" onChange={(event) => { const file = event.target.files?.[0]; if (file) void installLocalCanvasPlugin(file).then(() => message.success("本地插件已安装")).catch((error) => message.error(String(error))); event.currentTarget.value = ""; }} />
        </div>
    </Modal>;
}
