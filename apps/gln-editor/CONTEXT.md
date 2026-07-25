# GLN Editor Application Context

This application composes the isolated GLN product described in
[`docs/gln/CONTEXT.md`](../../docs/gln/CONTEXT.md) and follows
[`ADR 0001`](../../docs/gln/adr/0001-isolated-gln-editor.md).

## Responsibilities

- Own the independently runnable Chinese GLN application shell.
- Select and guard the GLN-specific SQLite database before scene storage loads.
- Compose shared Pascal editing capabilities and the mandatory GLN plugin.
- Own GLN-only routes and restricted server-side integrations.

## Boundaries

- Do not register GLN behavior in `apps/editor`.
- Do not read, migrate, or default to the original Editor database.
- Keep GLN schemas, renderers, systems, tools, and panels in `packages/plugin-gln`.
- Change shared Pascal packages only for generic infrastructure used by both apps.
