# Domain Docs

## Before exploring, read these

- `CONTEXT-MAP.md` at the repository root, when present.
- Relevant context docs referenced by the map:
  - `apps/<app>/CONTEXT.md`
  - `packages/<package>/CONTEXT.md`
  - `tooling/<tool>/CONTEXT.md`
- System-wide ADRs under `docs/adr/`.
- Context ADRs under `<context>/docs/adr/`.
- Relevant canonical rules under `wiki/architecture/`.

If these files do not exist, proceed silently. Domain-modeling skills create
them lazily when terminology or architectural decisions are resolved.

## Layout

This repository uses a multi-context layout. `CONTEXT-MAP.md` is the index;
individual workspace contexts own their glossary, responsibilities,
boundaries, and local ADRs.

Existing `wiki/architecture/` pages remain canonical for implementation and
layer rules. Context docs should link to them instead of duplicating them.

## Consumer rules

- Use terminology defined by the relevant `CONTEXT.md`.
- Do not invent synonyms for established domain concepts.
- Read only contexts relevant to the task.
- Surface conflicts with existing ADRs explicitly instead of overriding them.
