import assert from "node:assert/strict";
import path from "node:path";
import { resolveAuthPath } from "#lib/auth-path.js";
import { test } from "./test.ts";

test("uses explicit OPENCODE_AUTH_PATH override", () => { const actual = resolveAuthPath({
    platform: "win32",
    env: { OPENCODE_AUTH_PATH: "C:\\custom\\auth.json" },
    homeDir: "C:\\Users\\alice",
  });

  assert.equal(actual, "C:\\custom\\auth.json");
});

test("resolves Windows default from LOCALAPPDATA", () => {
  const actual = resolveAuthPath({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\alice\\AppData\\Local" },
    homeDir: "C:\\Users\\alice",
  });

  assert.equal(actual, path.join("C:\\Users\\alice\\AppData\\Local", "opencode", "auth.json"));
});


for (const platform of ["linux", "darwin"] as const) {
  test(`resolves ${platform} with XDG_DATA_HOME`, () => {
    const actual = resolveAuthPath({
      platform,
      env: { XDG_DATA_HOME: "/tmp/xdg-data" },
      homeDir: "/home/alice",
    });

    assert.equal(actual, "/tmp/xdg-data/opencode/auth.json");
  });
}
