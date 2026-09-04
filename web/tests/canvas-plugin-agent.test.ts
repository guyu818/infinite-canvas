import assert from "node:assert/strict";
import test from "node:test";

import { buildCanvasPluginActionOps, buildCanvasPluginCreateOps, listCanvasPluginAgentNodes } from "../src/lib/canvas-plugin-agent.ts";
import { registerCanvasPluginNodes, unregisterCanvasPluginNodes } from "../src/lib/canvas-plugin-registry.ts";
import { CanvasNodeType } from "../src/app/(user)/canvas/types.ts";

test("Codex can discover, create and invoke declared plugin node actions", (t) => {
    registerCanvasPluginNodes("fixture", [{
        type: "fixture:note",
        title: "Note",
        icon: "N",
        description: "A note",
        defaultSize: { width: 320, height: 200 },
        defaultMetadata: { content: "" },
        agentActions: [{ id: "set-content", title: "Set content", description: "Replace note text", run: (_node, input) => [{ type: "update_node", id: _node.id, metadata: { content: String(input.content || "") } }] }],
    }]);
    t.after(() => unregisterCanvasPluginNodes("fixture"));

    assert.deepEqual(listCanvasPluginAgentNodes(), [{ type: "fixture:note", title: "Note", description: "A note", defaultSize: { width: 320, height: 200 }, actions: [{ id: "set-content", title: "Set content", description: "Replace note text" }] }]);
    assert.deepEqual(buildCanvasPluginCreateOps("fixture:note", { id: "plugin-1", x: 12, y: 24 }), [
        { type: "add_node", id: "plugin-1", nodeType: "plugin", title: "Note", position: { x: 12, y: 24 }, width: 320, height: 200, metadata: { content: "", pluginType: "fixture:note" } },
        { type: "select_nodes", ids: ["plugin-1"] },
    ]);
    const node = { id: "plugin-1", type: CanvasNodeType.Plugin, title: "Note", position: { x: 12, y: 24 }, width: 320, height: 200, metadata: { pluginType: "fixture:note" } };
    assert.deepEqual(buildCanvasPluginActionOps(node, "set-content", { content: "hello" }), [{ type: "update_node", id: "plugin-1", metadata: { content: "hello" } }]);
});

test("undeclared plugin actions cannot be invoked", () => {
    const node = { id: "missing", type: CanvasNodeType.Plugin, title: "Missing", position: { x: 0, y: 0 }, width: 1, height: 1, metadata: { pluginType: "missing:type" } };
    assert.throws(() => buildCanvasPluginActionOps(node, "anything", {}), /插件未安装/);
});
