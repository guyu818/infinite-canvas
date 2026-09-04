import assert from "node:assert/strict";
import test from "node:test";

import { assertLocalCanvasPluginFileName, assertOfficialCanvasPluginEntry, parseOfficialCanvasPluginRegistry } from "../src/lib/canvas-plugin-policy.ts";

test("official registry only accepts entries from the fork plugins-dist branch", () => {
    const plugins = parseOfficialCanvasPluginRegistry({ version: 1, plugins: [{ id: "markdown", entry: "markdown.js", name: "Markdown", version: "1.0.0" }, { id: "evil", entry: "https://evil.example/plugin.js" }] });
    assert.deepEqual(plugins.map((item) => item.id), ["markdown"]);
    assert.doesNotThrow(() => assertOfficialCanvasPluginEntry(plugins[0].entry));
    assert.throws(() => assertOfficialCanvasPluginEntry("https://evil.example/plugin.js"), /只允许/);
});

test("local plugin import only accepts built JavaScript packages", () => {
    assert.doesNotThrow(() => assertLocalCanvasPluginFileName("sticky-note.mjs"));
    assert.throws(() => assertLocalCanvasPluginFileName("plugin.zip"), /js 或 .mjs/);
});
