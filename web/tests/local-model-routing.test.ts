import assert from "node:assert/strict";
import test from "node:test";

import { aiApiUrl, aiHeaders } from "../src/services/api/image.ts";
import { defaultConfig, useConfigStore } from "../src/stores/use-config-store.ts";
import { useUserStore } from "../src/stores/use-user-store.ts";

test("a logged-in user still sends local OpenAI-compatible requests through the same-origin local proxy", () => {
    useUserStore.setState({ token: "logged-in-token" });
    const config = { ...defaultConfig, channelMode: "local" as const, model: "gpt-test", localChannels: [{ id: "local", name: "Local", protocol: "openai" as const, baseUrl: "https://api.example.com", apiKey: "sk-local", models: ["gpt-test"] }], activeChannelId: "local" };
    useConfigStore.setState({ config });
    assert.equal(aiApiUrl(config, "/models"), "/api/local-ai/models");
});

test("remote account channels keep using the account API", () => {
    assert.equal(aiApiUrl({ ...defaultConfig, channelMode: "remote" }, "/models"), "/api/v1/models");
});

test("a logged-in user keeps the local Gemini API key and does not send the account token", () => {
    useUserStore.setState({ token: "logged-in-token" });
    const config = { ...defaultConfig, channelMode: "local" as const, model: "gemini-test", localChannels: [{ id: "gemini", name: "Gemini", protocol: "gemini" as const, baseUrl: "https://generativelanguage.googleapis.com", apiKey: "gemini-local-key", models: ["gemini-test"] }], activeChannelId: "gemini" };
    const headers = aiHeaders(config, "application/json");
    assert.equal(headers["x-goog-api-key"], "gemini-local-key");
    assert.equal("Authorization" in headers, false);
});
