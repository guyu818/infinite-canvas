import assert from "node:assert/strict";
import test from "node:test";

import { applyLocalCanvasAgentOps } from "../src/app/(user)/canvas/agent/local-canvas-agent-ops.ts";
import { LocalCanvasAgentClient } from "../src/services/local-canvas-agent.ts";

test("local Canvas Agent applies canvas edits but never starts paid generation", () => {
    const snapshot = { projectId: "p1", title: "画布", nodes: [], connections: [], selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } };
    const result = applyLocalCanvasAgentOps(snapshot, [
        { type: "add_node", id: "text-1", nodeType: "text", metadata: { content: "镜头提示" } },
        { type: "run_generation", nodeId: "text-1", mode: "image", prompt: "收费请求" },
    ]);
    assert.equal(result.nodes.length, 1);
    assert.equal(result.skippedGenerationCount, 1);
    assert.equal(result.nodes[0].metadata?.status, "idle");
});

test("local Canvas Agent rejects non-loopback endpoints", () => {
    assert.throws(() => new LocalCanvasAgentClient({ endpoint: "https://agent.example.com", token: "token", clientId: "client", onToolCall: () => undefined }), /只能连接/);
    assert.doesNotThrow(() => new LocalCanvasAgentClient({ endpoint: "http://127.0.0.1:17371", token: "token", clientId: "client", onToolCall: () => undefined }));
});
