import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCanvasToolRequest } from "./operations.js";
import { toolInputSchemas } from "./schemas.js";
import type { CanvasConnection, CanvasNode, CanvasSnapshot } from "./types.js";

function opsOf(name: Parameters<typeof buildCanvasToolRequest>[0], input: Record<string, unknown>) {
    const request = buildCanvasToolRequest(name, input, null);
    return (request.input as { ops: Array<Record<string, any>> }).ops;
}

function snapshot(nodes: CanvasNode[], connections: CanvasConnection[]): CanvasSnapshot {
    return { projectId: "project-1", title: "测试画布", nodes, connections, selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } };
}

test("generation flow reuses referenced nodes when the prompt only mentions them", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "@[node:text-1]", referenceNodeIds: ["text-1"], title: "Flow", autoRun: true });
    const addedTextNodes = ops.filter((op) => op.type === "add_node" && op.nodeType === "text");
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    const runs = ops.filter((op) => op.type === "run_generation");
    assert.equal(addedTextNodes.length, 0);
    assert.equal(ops.filter((op) => op.type === "connect_nodes" && op.fromNodeId === "text-1" && String(op.toNodeId).startsWith("config-")).length, 1);
    assert.match(String(config?.metadata?.prompt), /^@\[node:text-1\]$/);
    assert.equal(runs.length, 0);
});

test("generation flow still creates a prompt node for prose prompts", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "a cat on a roof", referenceNodeIds: ["text-1"], autoRun: true });
    assert.equal(ops.filter((op) => op.type === "add_node" && op.nodeType === "text").length, 1);
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    assert.match(String(config?.metadata?.prompt), /@\[node:text-/);
});

test("canvas node schema accepts target-only panorama and director nodes", () => {
    assert.equal(toolInputSchemas.canvas_create_node.parse({ nodeType: "panorama" }).nodeType, "panorama");
    assert.equal(toolInputSchemas.canvas_create_node.parse({ nodeType: "director" }).nodeType, "director");
    assert.equal(toolInputSchemas.canvas_create_node.parse({ nodeType: "plugin" }).nodeType, "plugin");
});

test("director screenshot creates a video storyboard without starting generation", () => {
    const state = snapshot([
        { id: "director-1", type: "director", title: "导演台", position: { x: 0, y: 0 }, width: 320, height: 240 },
        { id: "capture-1", type: "image", title: "镜头 1", position: { x: 420, y: 0 }, width: 320, height: 180, metadata: { content: "data:image/png;base64,aW1hZ2U=" } },
    ], [{ id: "edge-1", fromNodeId: "director-1", toNodeId: "capture-1" }]);
    const request = buildCanvasToolRequest("canvas_create_director_video_storyboard", { imageNodeId: "capture-1", prompt: "缓慢推进" }, state);
    const ops = request.input.ops as Array<Record<string, unknown>>;
    assert.equal(ops.some((op) => op.type === "run_generation"), false);
    assert.equal(ops[0].nodeType, "video");
    assert.equal((ops[0].metadata as Record<string, unknown>).firstFrameNodeId, "capture-1");
    assert.deepEqual(ops[1], { type: "connect_nodes", fromNodeId: "capture-1", toNodeId: ops[0].id });
});

test("generate tools only prepare workflows and never auto-run paid generation", () => {
    const request = buildCanvasToolRequest("canvas_generate_video", { prompt: "镜头向前推进" }, null);
    const ops = request.input.ops as Array<Record<string, unknown>>;
    assert.equal(ops.some((op) => op.type === "run_generation"), false);
});

test("video source creates a white-model video workflow without starting generation", () => {
    const state = snapshot([
        { id: "video-1", type: "video", title: "动作参考", position: { x: 10, y: 20 }, width: 480, height: 270, metadata: { content: "https://example.test/source.mp4", seconds: "8", size: "16:9" } },
    ], []);
    const request = buildCanvasToolRequest("canvas_create_white_model_video", { videoNodeId: "video-1" }, state);
    const ops = request.input.ops as Array<Record<string, unknown>>;
    assert.equal(ops.some((op) => op.type === "run_generation"), false);
    assert.equal(ops[0].nodeType, "video");
    assert.equal((ops[0].metadata as Record<string, unknown>).whiteModelSourceNodeId, "video-1");
    assert.match(String((ops[0].metadata as Record<string, unknown>).prompt), /白色无纹理/);
    assert.deepEqual(ops[1], { type: "connect_nodes", fromNodeId: "video-1", toNodeId: ops[0].id });
});

test("plugin tools preserve frontend dispatch and validate plugin identifiers", () => {
    assert.equal(toolInputSchemas.canvas_create_plugin_node.parse({ pluginType: "markdown:doc" }).pluginType, "markdown:doc");
    assert.equal(toolInputSchemas.canvas_invoke_plugin_action.parse({ nodeId: "plugin-1", actionId: "set-content", input: { content: "hello" } }).actionId, "set-content");
    assert.deepEqual(buildCanvasToolRequest("canvas_create_plugin_node", { pluginType: "markdown:doc" }, null), { name: "canvas_create_plugin_node", input: { pluginType: "markdown:doc" } });
    assert.deepEqual(buildCanvasToolRequest("canvas_invoke_plugin_action", { nodeId: "plugin-1", actionId: "set-content", input: { content: "hello" } }, null), { name: "canvas_invoke_plugin_action", input: { nodeId: "plugin-1", actionId: "set-content", input: { content: "hello" } } });
});
