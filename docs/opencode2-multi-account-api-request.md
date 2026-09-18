# OpenCode2 Account-Scoped Codex Quota API Request

## Current limitation

The OpenCode2 server and TUI entrypoints can register the `codex_usage` tool
and `/codex-usage` command, but the quota probe cannot safely use the account
selected in OpenCode2's multi-account credential store.

Today the probe reads `openai.access` and `openai.accountId` from the legacy
OpenCode `auth.json` file. OpenCode2 account selection is separate:
`integration.list` exposes integrations and their connections, and
`credential.activate` selects a stored credential through OpenCode core.
Neither operation updates the legacy `auth.json` entry consumed by this plugin,
nor do these operations provide a credential-scoped way to fetch Codex quota.
Consequently, changing the active OpenCode2 account does not change the account
used by the legacy quota probe. Quota retrieval currently requires a valid
legacy OpenCode auth entry.

## Requested core operation

OpenCode core should own a constrained operation that accepts the selected
credential or connection ID and a fixed endpoint identifier:

```ts
const result = await context.client.integration.codexQuota({
  credentialID,
  endpoint: "codex-usage",
});
```

Core would resolve and refresh that credential internally, call the
allow-listed Codex quota endpoint, and return only normalized quota data and
metadata identifying the credential used. For example, the result could
contain quota windows, reset times, plan information, and a credential ID and
label. It must not contain access tokens, refresh tokens, authorization
headers, or other reusable secrets.

The operation should also detect if the active credential changes while the
request is in flight, so quota cannot be attributed to the wrong account.
Errors should distinguish unsupported or unauthenticated credentials from
network, rate-limit, and provider failures; an unsupported credential must not
be represented as zero quota.

## Security boundary

This request is intentionally narrower than a general authenticated transport.
The core API must:

- never return raw access or refresh tokens to the plugin or TUI;
- never accept or forward an arbitrary URL supplied by a plugin;
- use an allow-listed, core-owned provider operation rather than a remote
  proxy;
- keep credential resolution, refresh, and authorization inside OpenCode core;
- avoid direct reads of OpenCode2's private SQLite credential store by plugins.

Until such a credential-scoped operation exists, this plugin will retain the
legacy `auth.json` probe as a compatibility path and report OpenCode2
multi-account credentials as unsupported rather than crossing that boundary.

See the [OpenCode2 multi-account design](superpowers/specs/2026-09-18-opencode2-multi-account-design.md)
for the local compatibility behavior and error semantics.
