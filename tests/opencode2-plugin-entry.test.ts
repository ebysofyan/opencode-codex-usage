import assert from "node:assert/strict";
import { createOpenCode2Plugin } from "#root/opencode2.js";
import { test } from "./test.ts";

type RegisteredTool = {
  name: string;
  description: string;
  input: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    context: unknown,
  ) => Promise<{
    title: string;
    output: string;
    metadata: Record<string, unknown>;
  }>;
};

test("OpenCode 2 adapter bridges the legacy codex_usage tool", async () => {
  let registeredTool: RegisteredTool | undefined;
  let disposed = false;

  const plugin = createOpenCode2Plugin(() => ({
    tool: {
      codex_usage: {
        description: "legacy codex usage tool",
        execute: async () => '{"status":"ok"}',
      },
    },
    event: () => undefined,
    dispose: () => {
      disposed = true;
    },
  }));

  const context = {
    tool: {
      transform: async (transform: (draft: { add: (tool: RegisteredTool) => void }) => void) => {
        transform({
          add: (tool) => {
            registeredTool = tool;
          },
        });
        return { dispose: async () => undefined };
      },
    },
    event: {
      subscribe: () => ({
        [Symbol.asyncIterator]() {
          return this;
        },
        next: () => new Promise<{ done: true; value: undefined }>(() => undefined),
      }),
    },
  };

  const cleanup = await plugin.setup(context);

  assert.equal(registeredTool?.name, "codex_usage");
  assert.equal(registeredTool?.description, "legacy codex usage tool");
  assert.deepEqual(await registeredTool?.execute({}, {}), {
    title: "Codex quota",
    output: '{"status":"ok"}',
    metadata: {},
  });

  await cleanup();
  assert.equal(disposed, true);
});

test("OpenCode 2 adapter forwards events and disposes registrations", async () => {
  const forwardedEvents: Array<{ type: string }> = [];
  let resolveEvent: ((event: { type: string }) => void) | undefined;
  let registrationDisposed = false;
  let legacyDisposed = false;

  const plugin = createOpenCode2Plugin(() => ({
    tool: {
      codex_usage: {
        description: "legacy codex usage tool",
        execute: async () => "{}",
      },
    },
    event: ({ event }) => {
      forwardedEvents.push(event);
    },
    dispose: () => {
      legacyDisposed = true;
    },
  }));

  const context = {
    tool: {
      transform: async () => ({
        dispose: async () => {
          registrationDisposed = true;
        },
      }),
    },
    event: {
      subscribe: () => ({
        [Symbol.asyncIterator]() {
          return this;
        },
        next: () =>
          new Promise<{ value: { type: string }; done: false }>((resolve) => {
            resolveEvent = (event) => resolve({ value: event, done: false });
          }),
      }),
    },
  };

  const cleanup = await plugin.setup(context);
  resolveEvent?.({ type: "session.created" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(forwardedEvents, [{ type: "session.created" }]);

  await cleanup();
  assert.equal(registrationDisposed, true);
  assert.equal(legacyDisposed, true);
});
