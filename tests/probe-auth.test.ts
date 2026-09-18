import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isLegacyAuthFailure, probeQuota } from "#lib/codex-usage-probe.js";
import { test } from "./test.ts";

test("missing legacy credentials are classified as unsupported", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-usage-auth-"));
  const authPath = path.join(directory, "auth.json");
  await writeFile(authPath, JSON.stringify({ openai: { accountId: "account" } }));
  const previous = process.env.OPENCODE_AUTH_PATH;
  process.env.OPENCODE_AUTH_PATH = authPath;
  try {
    const result = await probeQuota();
    assert.equal(result.statusCode, "legacy-auth");
    assert.equal(isLegacyAuthFailure(result), true);
    assert.match(result.error ?? "", /OpenCode2 multi-account credentials/i);
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_AUTH_PATH;
    else process.env.OPENCODE_AUTH_PATH = previous;
  }
});

test("expired legacy credentials are classified as unsupported", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ detail: "Provided authentication token is expired" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  const result = await probeQuota({
    credentials: { accessToken: "expired-token", accountId: "account" },
    fetchImpl,
    model: "gpt-5-codex",
  });
  assert.equal(result.statusCode, "legacy-auth");
  assert.match(result.error ?? "", /sign in again|re-authenticate/i);
});

test("model discovery 401 is classified as unsupported legacy credentials", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ detail: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  const result = await probeQuota({
    credentials: { accessToken: "expired-token", accountId: "account" },
    fetchImpl,
  });
  assert.equal(result.statusCode, "legacy-auth");
  assert.equal(isLegacyAuthFailure(result), true);
  assert.match(result.error ?? "", /sign in again|re-authenticate/i);
});
