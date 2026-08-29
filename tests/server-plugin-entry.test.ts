import assert from "node:assert/strict";
import * as ServerPluginModule from "#root/index.js";
import { test } from "./test.ts";

test("server plugin entry exports only the plugin factory", () => {
  assert.deepEqual(Object.keys(ServerPluginModule), ["default"]);
});
