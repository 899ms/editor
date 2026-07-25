# GLN Plugin Package Context

This package implements the registered GLN domain extension described in
[`docs/gln/CONTEXT.md`](../../docs/gln/CONTEXT.md) and follows
[`ADR 0001`](../../docs/gln/adr/0001-isolated-gln-editor.md).

## Responsibilities

- Own GLN node schemas, definitions, systems, tools, and host panels.
- Keep logical system state in `gln:system` nodes.
- Export a normal Pascal plugin manifest plus host-specific UI separately.
- Remain installable only through the isolated GLN application.

## Boundaries

- Do not modify or register GLN behavior in the original Editor application.
- Do not extend Pascal host stores with GLN-specific fields.
- Use the shared node registry and scene schema boundaries for browser, server,
  JSON, and MCP validation.
- Keep physical equipment and connections out of the logical system node.
