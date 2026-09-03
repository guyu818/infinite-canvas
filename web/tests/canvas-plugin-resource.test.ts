import assert from "node:assert/strict";
import test from "node:test";

import { registerCanvasPluginNodes, unregisterCanvasPluginNodes } from "../src/lib/canvas-plugin-registry.ts";
import { buildAllCanvasResourceReferences } from "../src/app/(user)/canvas/utils/canvas-resource-references.ts";
import { CanvasNodeType } from "../src/app/(user)/canvas/types.ts";

test("plugin nodes expose host-consumable resources", (t) => {
    registerCanvasPluginNodes("fixture", [{ type: "fixture:markdown", title: "Markdown", icon: "M", defaultSize: { width: 320, height: 240 }, resource: (node) => ({ kind: "text", text: String(node.metadata?.content || "") }) }]);
    t.after(() => unregisterCanvasPluginNodes("fixture"));
    const references = buildAllCanvasResourceReferences([{ id: "plugin-1", type: CanvasNodeType.Plugin, title: "说明", position: { x: 0, y: 0 }, width: 320, height: 240, metadata: { pluginType: "fixture:markdown", content: "分镜内容" } }]);
    assert.equal(references.length, 1);
    assert.equal(references[0].kind, "text");
    assert.equal(references[0].text, "分镜内容");
});
