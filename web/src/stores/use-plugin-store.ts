"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { localForageStorage } from "@/lib/localforage-storage";

export type InstalledCanvasPlugin = { id: string; name: string; version: string; description?: string; source: string; enabled: boolean; official: boolean; installedAt: string };
type PluginStore = { plugins: InstalledCanvasPlugin[]; upsert: (plugin: InstalledCanvasPlugin) => void; setEnabled: (id: string, enabled: boolean) => void; remove: (id: string) => void };

export const usePluginStore = create<PluginStore>()(persist((set) => ({
    plugins: [],
    upsert: (plugin) => set((state) => ({ plugins: [plugin, ...state.plugins.filter((item) => item.id !== plugin.id)] })),
    setEnabled: (id, enabled) => set((state) => ({ plugins: state.plugins.map((item) => item.id === id ? { ...item, enabled } : item) })),
    remove: (id) => set((state) => ({ plugins: state.plugins.filter((item) => item.id !== id) })),
}), { name: "infinite-canvas:plugin-store", storage: createJSONStorage(() => localForageStorage) }));
