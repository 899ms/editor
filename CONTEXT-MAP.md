# Context Map

| Context | Canonical document | Planned code ownership |
| --- | --- | --- |
| GLN product and hydronic visualization | `docs/gln/CONTEXT.md` | `apps/gln-editor`, `packages/plugin-gln` |
| GLN architecture decision | `docs/gln/adr/0001-isolated-gln-editor.md` | repository-wide boundary |
| Pascal core architecture | `wiki/architecture/README.md` | `packages/core` |
| Pascal viewer architecture | `wiki/architecture/viewer-isolation.md` | `packages/viewer` |
| Pascal editor tools and UI | `wiki/architecture/tools.md` | `packages/editor`, `apps/editor` |
| Plugin contract | `wiki/architecture/plugin-authoring.md` | registered plugin packages |

Until `apps/gln-editor` and `packages/plugin-gln` exist, `docs/gln/CONTEXT.md`
is the canonical GLN context. When those directories are created, add local
`CONTEXT.md` files that reference it and describe only package-specific
responsibilities.
