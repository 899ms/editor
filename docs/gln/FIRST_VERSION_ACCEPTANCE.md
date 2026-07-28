# GLN 第一版验收证据

本文件把父 Spec #1 的第一版边界映射到可重复执行的证据。T18 不新增工程
计算能力；它只证明已经批准的可编辑场景、持久化、AI 安全边界和运行预览在
真实应用接缝中成立。

## 合并门禁

```bash
bun run check
bun run check:i18n
bun run check-types
bun run --cwd apps/gln-editor test
bun run --cwd packages/plugin-gln test
bun run test:e2e:gln
```

CI 必须分别运行应用单测和插件单测，避免共享进程中的全局节点注册相互污染。
Playwright 使用两个真实 Next.js 应用、两个临时 SQLite 数据库和固定的
`1440 x 900` 中文桌面视口。

## T18 验收矩阵

| Issue #19 验收项 | 应用级证据 | 领域或契约证据 |
| --- | --- | --- |
| 住宅生成、系统配置、手工编辑、自动保存、刷新恢复、运行预览 | `codex-task.spec.ts` 的住宅生成与完整单系统流程；`gln-app.spec.ts` 的设备编辑；`gln-acceptance.spec.ts` 的双层双系统保存和预览 | `codex-task-manager.test.ts`、`gln-configuration-scene-plan.test.ts` |
| 单系统、多系统、单层、多楼层 | `codex-task.spec.ts` 单系统；`gln-acceptance.spec.ts` 双楼层双系统 | `hydronic-pipe.test.ts` 的跨层立管选择与缺失立管复核 |
| 失败计划、冲突、断连、非法安装不污染场景 | `gln-acceptance.spec.ts` 对四类失败逐次比较完整 graph 与 version | `prepare-scene-plan.test.ts`、`scene-plan-validator.test.ts` |
| IFC、GLB、AI 产出可编辑节点 | `ifc-import.spec.ts`、`glb-import.spec.ts` 导入后通过 ScenePlan 修改普通墙体并重载；`codex-task.spec.ts` 生成普通住宅节点 | IFC/GLB reconstruction 与 application 单测 |
| 中文界面与目标桌面布局 | `gln-acceptance.spec.ts` 遍历关键 GLN 面板，检查横向溢出、控件边界、关键英文漏译并保存截图 | `scripts/audit-i18n-full.ts` 扫描 GLN 应用与插件 |
| 水流和能量方向科学 | `gln-acceptance.spec.ts` 同屏验证夏季空间到面板、冬季面板到空间，且无送风或虚假实时指标 | `run-preview.test.ts` 按类型化端口验证供回水 pathDirection |
| 大型住宅性能 | `gln-acceptance.spec.ts` 在 512 面墙、总节点数大于 540 的双层双系统场景中测选择、移动提交和预览切换 | 目标基线见下节 |
| 原版 Editor 隔离与主要编辑回归 | `gln-acceptance.spec.ts` 在原版应用创建墙、撤销、重做、自动保存、刷新恢复，并验证 GLN UI/节点注册/场景数据库均不可见 | `gln-database.test.ts`、`register-gln-plugin.test.ts` |
| 类型、Biome、i18n、测试 | `.github/workflows/ci.yml` 的 `quality` 与 `gln-e2e` 作业 | 本文件“合并门禁” |
| 父 Spec 可追溯 | 本文件后续三张矩阵 | `docs/gln/CONTEXT.md` |

## 性能基线

第一版约定的是编辑交互烟雾基线，不是工程仿真或 GPU 跑分：

- 场景：双楼层、双独立系统、512 面附加墙体、总节点数大于 540。
- 环境：CI Chromium，中文界面，`1440 x 900` 视口，单 worker。
- 选择一个可移动设备到操作菜单可见：小于 3 秒。
- 从开始移动到持久化位置变化：小于 5 秒。
- 从点击运行预览到预览面板和科学方向可见：小于 3 秒。
- 每次 CI 保存实际节点数与耗时 JSON；这些上限用于发现数量级回退，不宣称
  终端设备统一帧率。

## 父 Spec 用户故事

| 用户故事 | 第一版边界 | 主要证据 |
| --- | --- | --- |
| 1-3 | 独立应用、独立数据、中文界面 | GLN/原版双应用 E2E、数据库单测、中文与布局 E2E |
| 4-10 | 手工住宅、GLB/IFC 重建、复核、临时参考、源文件独立 | `gln-app.spec.ts`、IFC/GLB E2E 与 reconstruction 单测 |
| 11-12 | AI 生成正常可编辑住宅节点 | `codex-task.spec.ts`、`residential-scene-plan.test.ts` |
| 13-22 | AI 只配置 GLN、稳定 ID、锁定、预览、原子提交与失败回滚 | Codex 配置 E2E、失败原子性 E2E、ScenePlan 单测 |
| 23-26 | 本机 Codex 白名单桥接、无浏览器 API Key、导入默认本地 | Codex adapter/task route 单测、IFC/GLB E2E |
| 27-35 | 外机/水箱安装区、净空、面板贴墙、尺寸、局部接口和 Zone 重算 | 设备与面板领域单测、放置和生命周期 E2E |
| 36-43 | 吊顶水路、墙内下降、跨层复核、避障、删除影响和断连 | hydronic routing/topology 单测、失败原子性 E2E |
| 44-48 | 有面板空间的独立目标温湿度、同 Zone 共享、未设置与来源 | Zone 单测、面板生命周期 E2E、双层双系统 E2E |
| 49-55 | 编辑辅助、同场景运行预览、夏冬能量、无送风、拓扑方向、无虚假指标 | run-preview 单测、双层双系统预览 E2E |
| 56-61 | 自动保存、刷新、冲突、防误清空、JSON 备份边界、即时效果 | 应用 E2E、SceneStore/生命周期测试、ScenePlan 冲突 E2E |
| 62-65 | 独立插件边界、共享通用能力、统一 Schema、真实应用级验收 | 原版回归 E2E、注册/持久化测试、CI 全套门禁 |

## 实施决策边界

| 决策组 | 证明 |
| --- | --- |
| 独立 GLN 应用与静态必需插件 | ADR 0001、原版隔离 E2E、插件注册测试 |
| 四类可见资产与不可见系统节点 | 注册测试、完整配置 E2E |
| `systemId`、系统模式单一真源、类型化端口 | schema/topology/run-preview 测试 |
| 面板顶部左进右出、墙面宿主、Zone 重算 | wall-panel domain 与 lifecycle 测试 |
| 管路走吊顶、墙内下降、跨层需已确认通道 | hydronic routing 测试 |
| 目标值不是测量或计算值 | Zone 与运行预览测试、应用免责声明 E2E |
| 导入转为普通可编辑节点且不保存原文件 | IFC/GLB E2E 和 schema/application 测试 |
| AI 预览确认、版本绑定、原子提交、锁定保护、幂等更新 | Codex/ScenePlan E2E 与单测 |
| 同一实时场景运行预览，不依赖导出 | GLN 应用 E2E 与 run-preview 测试 |

## 明确不验收

第一版不包含负荷计算、水力平衡、管径/流量/泵扬程/压损、真实温湿度动态
演算、露点与结露联动、设备选型与能耗预测、独立新风除湿资产、CFD、BIM
属性维护与导出、施工图/BOM/工程报告、正式厂家库、GLB 导出或独立 Viewer、
插件商店，以及浏览器直接调用 OpenAI API。运行预览不得以动画或文字暗示这些
能力已经存在。
