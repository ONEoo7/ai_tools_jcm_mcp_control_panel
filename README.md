# jCodeMunch-MCP Control Panel

A local, single-user web control panel for [`jcodemunch-mcp`](https://pypi.org/project/jcodemunch-mcp/) —
the code-intelligence MCP server + CLI. It runs on your machine (localhost only)
and makes the tool operable from a browser instead of hand-editing JSONC and
remembering CLI subcommands.

## Features

- **Dashboard** — environment health + a 30-day savings summary at a glance.
- **Statistics** — token savings & usage per tool, with 7/30/90-day/all-time
  windows and per-model cost estimates, sourced from the `receipt` ledger.
- **Projects** — add a project by absolute path, index it (live streamed log),
  and scaffold a starter `.jcodemunch.jsonc`.
- **Config** — view & edit the global (`~/.code-index/config.jsonc`) and
  per-project config. Comment-preserving, JSONC-validated, backup-on-write.
- **Hooks** — see registered clients, policies, skills, and auto-reindex hooks;
  install/refresh or uninstall (with a dry-run default).
- **Deploy** — guided setup for a new machine: register MCP clients, install the
  CLAUDE.md policy, add reindex hooks. Streamed output, **dry-run by default**.
- **XLSX report** — export a usage & savings workbook (Summary, Per-Tool,
  Indexed Repos).
- **Help** — the jcodemunch tool guide, recent releases, and a config-key reference.

## How it works

The panel is a Next.js (App Router) app. Server-side code in `lib/jcm/*` talks to
jcodemunch by **shelling out to the `jcodemunch-mcp` CLI** and **reading/writing
local config files** — there is no MCP-client dependency. Mutating actions
(config writes, deploy, hook install/uninstall) are explicit and default to a
safe preview; config/hook writes create a timestamped `.bak` first.

Key data sources:

| Feature       | Command / file                                   |
| ------------- | ------------------------------------------------ |
| Savings/usage | `jcodemunch-mcp receipt --export`                |
| Repos/index   | `jcodemunch-mcp list-repos --json`, `index`      |
| Config        | `~/.code-index/config.jsonc`, `jcodemunch-mcp config` |
| Hooks/clients | `jcodemunch-mcp install-status --json`           |
| Deploy        | `jcodemunch-mcp init` (with `--dry-run`)         |
| Help          | `jcodemunch-mcp claude-md --generate`, `whatsnew`|

## Prerequisites

- Node.js 20+ (developed on Node 24).
- The `jcodemunch-mcp` CLI on your `PATH`. If it isn't, set `JCM_BIN` to its full
  path (e.g. an absolute path to `jcodemunch-mcp.exe`).

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app binds to localhost — it manages the local machine and is not intended to
be exposed on a network.

## Configuration

- `JCM_BIN` — override the path to the `jcodemunch-mcp` executable.

Local runtime state (the list of added projects) lives in `data/registry.json`
and is gitignored, as are `*.bak` config backups.
