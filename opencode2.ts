import createLegacyPlugin from "./index.js";

type LegacyEvent = {
  type: string;
  properties?: Record<string, unknown>;
};

type LegacyPluginContext = {
  client: {
    tui: {
      showToast: (payload: unknown) => Promise<void>;
    };
    app: {
      log: (payload: unknown) => Promise<void>;
    };
  };
  worktree: string;
};

type LegacyTool = {
  description: string;
  execute: () => Promise<string> | string;
};

type LegacyPlugin = {
  tool?: {
    codex_usage?: LegacyTool;
  };
  event?: (input: { event: LegacyEvent }) => void;
  dispose?: () => void;
};

export type LegacyPluginFactory = (context: LegacyPluginContext) => LegacyPlugin;

type OpenCode2Tool = {
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

type OpenCode2Context = {
  tool: {
    transform: (
      transform: (draft: { add: (tool: OpenCode2Tool) => void }) => void,
    ) => Promise<{ dispose: () => Promise<void> }>;
  };
  event: {
    subscribe: () => AsyncIterable<LegacyEvent>;
  };
};

type OpenCode2Plugin = {
  readonly id: string;
  readonly setup: (context: OpenCode2Context) => Promise<() => Promise<void>>;
};

const toolInput = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const satisfies Record<string, unknown>;

const createLegacyContext = (): LegacyPluginContext => ({
  client: {
    tui: {
      showToast: async () => undefined,
    },
    app: {
      log: async () => undefined,
    },
  },
  worktree: process.cwd(),
});

export const createOpenCode2Plugin = (
  createLegacy: LegacyPluginFactory = createLegacyPlugin,
): OpenCode2Plugin => ({
  id: "opencode-codex-usage",

  setup: async (context): Promise<() => Promise<void>> => {
    const legacy = createLegacy(createLegacyContext());
    const registrations: Array<{ dispose: () => Promise<void> }> = [];
    let stopped = false;
    let disposed = false;

    const definition = legacy.tool?.codex_usage;
    if (definition) {
      registrations.push(
        await context.tool.transform((draft) => {
          draft.add({
            name: "codex_usage",
            description: definition.description,
            input: toolInput,
            execute: async () => ({
              title: "Codex quota",
              output: String(await definition.execute()),
              metadata: {},
            }),
          });
        }),
      );
    }

    try {
      const stream = context.event.subscribe();
      void (async () => {
        try {
          for await (const event of stream) {
            if (stopped) break;
            legacy.event?.({ event });
          }
        } catch {
          // Event delivery is best effort; the quota tool remains available.
        }
      })();
    } catch {
      // Event subscription is best effort; the quota tool remains available.
    }

    return async () => {
      if (disposed) return;
      disposed = true;
      stopped = true;
      legacy.dispose?.();

      for (const registration of registrations.reverse()) {
        try {
          await registration.dispose();
        } catch {
          // A failed registration cleanup must not prevent the remaining cleanup.
        }
      }
    };
  },
});

const OpenCode2Plugin = createOpenCode2Plugin();

export default OpenCode2Plugin;
