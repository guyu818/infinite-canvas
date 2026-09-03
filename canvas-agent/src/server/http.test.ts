import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";

import { validToken } from "./http.js";

test("protected Canvas Agent routes require the exact token", () => {
    const request = { headers: {} } as Request;
    assert.equal(validToken(request, new URL("http://127.0.0.1:17371/events?token=expected"), "expected"), true);
    assert.equal(validToken(request, new URL("http://127.0.0.1:17371/events?token=wrong"), "expected"), false);
});

test("Canvas Agent accepts the dedicated token header", () => {
    const request = { headers: { "x-canvas-agent-token": "expected" } } as unknown as Request;
    assert.equal(validToken(request, new URL("http://127.0.0.1:17371/canvas/state"), "expected"), true);
});
