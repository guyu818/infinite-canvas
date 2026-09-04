import assert from "node:assert/strict";
import test from "node:test";

import { buildWhiteModelVideoOps, WHITE_MODEL_VIDEO_PROMPT } from "../src/app/(user)/canvas/utils/canvas-white-model-video.ts";
import { CanvasNodeType } from "../src/app/(user)/canvas/types.ts";
import { buildNodeGenerationContext } from "../src/app/(user)/canvas/components/canvas-node-generation.ts";

test("white-model workflow keeps the source video as a reference and never runs generation", () => {
    const source = { id: "video-1", type: CanvasNodeType.Video, title: "动作", position: { x: 20, y: 30 }, width: 480, height: 270, metadata: { content: "source.mp4", seconds: "6", size: "16:9" } };
    const ops = buildWhiteModelVideoOps(source, "video-white");
    assert.equal(ops.some((op) => op.type === "run_generation"), false);
    assert.deepEqual(ops[0], { type: "add_node", id: "video-white", nodeType: "video", title: "动作 白模", position: { x: 596, y: 30 }, width: 480, height: 270, metadata: { status: "idle", prompt: WHITE_MODEL_VIDEO_PROMPT, composerContent: WHITE_MODEL_VIDEO_PROMPT, seconds: "6", size: "16:9", whiteModelSourceNodeId: "video-1" } });
    assert.deepEqual(ops[1], { type: "connect_nodes", fromNodeId: "video-1", toNodeId: "video-white" });
    assert.deepEqual(ops[2], { type: "select_nodes", ids: ["video-white"] });
    const output = { id: "video-white", type: CanvasNodeType.Video, title: "动作 白模", position: { x: 596, y: 30 }, width: 480, height: 270, metadata: ops[0].type === "add_node" ? ops[0].metadata : undefined };
    const context = buildNodeGenerationContext(output.id, [source, output], [{ id: "edge-1", fromNodeId: source.id, toNodeId: output.id }], WHITE_MODEL_VIDEO_PROMPT);
    assert.equal(context.referenceVideos.length, 1);
    assert.equal(context.referenceVideos[0].url, "source.mp4");
});
