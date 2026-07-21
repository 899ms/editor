import commonEn from './locales/en/common.json' with { type: 'json' }
import editorEn from './locales/en/editor.json' with { type: 'json' }
import nodesEn from './locales/en/nodes.json' with { type: 'json' }
import viewerEn from './locales/en/viewer.json' with { type: 'json' }
import commonZhCn from './locales/zh-CN/common.json' with { type: 'json' }
import editorZhCn from './locales/zh-CN/editor.json' with { type: 'json' }
import nodesZhCn from './locales/zh-CN/nodes.json' with { type: 'json' }
import viewerZhCn from './locales/zh-CN/viewer.json' with { type: 'json' }

export const BUILTIN_RESOURCES = {
  en: {
    common: commonEn,
    editor: editorEn,
    nodes: nodesEn,
    viewer: viewerEn,
  },
  'zh-CN': {
    common: commonZhCn,
    editor: editorZhCn,
    nodes: nodesZhCn,
    viewer: viewerZhCn,
  },
} as const
