# GLN Domain Context

## Purpose

This context defines the vocabulary and invariants for the GLN application.
Code, tests, MCP tools, prompts, and UI labels must use these meanings.

## Vocabulary

| Term | Meaning |
| --- | --- |
| GLN Editor | The isolated `apps/gln-editor` application built on Pascal Editor. |
| Original Editor | `apps/editor`, which must not load GLN or share the GLN database. |
| GLN plugin | The mandatory, statically loaded `packages/plugin-gln` package. |
| System | One logical hydronic GLN installation represented by `gln:system`. |
| Physical asset | One of outdoor unit, buffer tank, hydronic pipe, or wall panel. |
| Zone | An existing editable room/space node served by one or more wall panels. |
| Target setting | User or template temperature/humidity intent, not a measured value. |
| Supply | Water path from the source side toward the wall panels. |
| Return | Water path from the wall panels back toward the source side. |
| Concealed pipe | A complete editable pipe segment hidden by default in ceiling or wall. |
| ScenePlan | A version-bound, schema-valid, previewable atomic scene change. |
| Review queue | Low-confidence conversion or routing results requiring user action. |
| Product preset | Editable geometry and clearance parameters from verified product data. |
| Generic preset | An explicit placeholder with no invented manufacturer performance data. |
| Edit view | Real-time scene editing with ports, clearances, hidden paths, and issues. |
| Run preview | The same live scene with editing aids hidden and direction visuals enabled. |

## Hard Invariants

1. GLN has exactly four visible physical asset kinds:
   `gln:outdoor-unit`, `gln:buffer-tank`, `gln:hydronic-pipe`, and
   `gln:wall-panel`.
2. `gln:system` is logical and invisible.
3. Every physical asset has one `systemId`; the system does not duplicate a
   member list.
4. Runtime mode exists only on `gln:system`.
5. Connectivity comes from typed ports and shared pipe endpoints.
6. A wall panel is wall-mounted. In panel-local coordinates, top-left is supply
   and top-right is return.
7. Interior pipes route through the ceiling and descend concealed in the panel
   wall.
8. Zone settings exist only for zones with panels. Multiple panels in one zone
   share one setting.
9. Target temperature and humidity are not measured or simulated values.
10. AI configuration cannot alter residential structure.
11. AI cannot modify user-locked GLN nodes.
12. AI changes are previewed and committed atomically from a version-bound
    `ScenePlan`.
13. Re-running AI updates an existing system; it does not duplicate it.
14. GLB/IFC conversion ends in normal editable Pascal nodes.
15. Original Editor code paths and data remain usable without GLN.

## Ownership

| Concern | Owner |
| --- | --- |
| GLN schemas, renderers, tools, UI, validation rules | `packages/plugin-gln` |
| GLN application composition and restricted Codex endpoint | `apps/gln-editor` |
| Generic registry validation and atomic scene transactions | shared Pascal packages |
| Building nodes and room geometry | existing Pascal contexts |
| Engineering calculations | future dedicated context, not first version |

## Language Rules

- Use “目标温度” and “目标湿度”, not “实时温度” or “实际湿度” without a
  measured data source.
- Use “运行预览”, not “演示模式”.
- Use “设备平台” or “生活阳台的设备区”, not the ambiguous “服务阳台”.
- Use “供水/回水”, not refrigerant or drainage terminology.
- Use “可编辑重建”, not “BIM 导入” when BIM semantics are discarded.
