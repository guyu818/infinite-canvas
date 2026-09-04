import assert from "node:assert/strict";
import test from "node:test";

import { CANVAS_BACKUP_APP, assertCanvasBackupManifest, removeBackupSecrets, replaceBackupStorageKeys } from "../src/app/(user)/canvas/utils/canvas-backup-security.ts";

test("canvas backup recursively excludes credentials", () => {
    const clean = removeBackupSecrets({ apiKey: "secret", nested: { password: "secret", agentToken: "secret", title: "safe" }, list: [{ authorization: "Bearer secret", value: 1 }] });
    assert.deepEqual(clean, { nested: { title: "safe" }, list: [{ value: 1 }] });
});

test("canvas backup only accepts this application manifest", () => {
    const manifest = { app: CANVAS_BACKUP_APP, version: 1, projects: [], assets: [], imageGenerationLogs: [], videoGenerationLogs: [], media: [] };
    assert.doesNotThrow(() => assertCanvasBackupManifest(manifest));
    assert.throws(() => assertCanvasBackupManifest({ ...manifest, app: "other-app" }), /不是本项目/);
});

test("canvas backup restore rewrites every reference to restored media keys", () => {
    const restored = replaceBackupStorageKeys({ nodes: [{ metadata: { storageKey: "image:old", references: ["image:old"] } }], untouched: "image:other" }, new Map([["image:old", "image:restored-new"]]));
    assert.deepEqual(restored, { nodes: [{ metadata: { storageKey: "image:restored-new", references: ["image:restored-new"] } }], untouched: "image:other" });
});
