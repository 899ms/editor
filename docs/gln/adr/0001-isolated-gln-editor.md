# ADR 0001: Isolated GLN Editor With a Mandatory Plugin

- Status: Accepted
- Date: 2026-07-25

## Context

Pascal already owns building nodes, Three.js rendering, 2D/3D editing,
selection, tools, persistence, MCP operations, and a plugin contract. GLN needs
domain-specific hydronic assets, residential reconstruction, constrained AI
configuration, and real-time operation visuals.

The original localized Editor must remain available and continue following its
upstream. GLN must not turn shared Pascal packages into a product-specific
fork, and it must not share the original Editor's scene database.

## Decision

Create:

- `apps/gln-editor` as a separate application.
- `packages/plugin-gln` as a statically loaded, mandatory GLN plugin.
- A separate SQLite database selected through `PASCAL_DB_PATH`.

Keep:

- `apps/editor` free of GLN registration and UI.
- GLN domain schemas, rules, renderers, systems, tools, and panels inside the
  plugin or GLN app.

Allow shared package changes only when they are generic plugin infrastructure,
including registry-based validation, persistence of registered node kinds,
atomic scene transactions, and generic MCP mutation support.

Use the local Codex CLI through a restricted server-side bridge. The browser
submits only whitelisted task payloads. Codex returns a schema-valid
`ScenePlan`; the host validates, previews, and atomically commits it.

## Consequences

Positive:

- The original Editor remains independently runnable and updateable.
- GLN reuses mature editing and Three.js infrastructure.
- Product rules remain isolated from upstream-friendly generic code.
- Scene data, migrations, and experiments cannot accidentally affect original
  Editor projects.
- AI changes use the same validation and commit path as MCP and UI operations.

Costs:

- Generic plugin persistence gaps must be fixed before GLN nodes can be trusted.
- The app must explicitly load matching plugin schemas in browser and server.
- Shared improvements require careful architecture tests in both applications.
- Two app/database configurations must be maintained.

## Rejected Alternatives

### Replace the original Editor

Rejected because it would mix GLN product behavior with the user's retained
localized Editor and make upstream maintenance riskier.

### Build a standalone raw Three.js editor

Rejected because it would duplicate building, selection, tools, 2D/3D
interaction, persistence, undo, and MCP behavior.

### Represent GLN assets as generic items

Rejected because generic items do not own hydronic ports, system membership,
zone assignment, installation constraints, or topology validation.

### Add GLN fields to built-in Pascal node unions

Rejected because GLN is a product plugin. Shared packages should learn how to
validate registered plugin nodes, not learn GLN business concepts.

### Share the original SQLite database

Rejected because application isolation must include user data, migrations, and
recovery behavior.
