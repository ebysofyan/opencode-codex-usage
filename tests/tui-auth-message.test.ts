import assert from "node:assert/strict";
import {
  LEGACY_AUTH_STATUS_CODE,
  LEGACY_AUTH_UNSUPPORTED_MESSAGE,
} from "#lib/codex-usage-probe.js";
import { messageForProbeFailure } from "#root/tui.js";
import { test } from "./test.ts";

test("TUI explains unsupported modern multi-account auth", () => {
  const message = messageForProbeFailure({
    status: "error",
    statusCode: LEGACY_AUTH_STATUS_CODE,
    error: LEGACY_AUTH_UNSUPPORTED_MESSAGE,
  });
  assert.match(message, /OpenCode2 multi-account credentials/i);
  assert.match(message, /legacy OpenCode auth/i);
});
