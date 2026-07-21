import 'i18next'
import type common from './locales/en/common.json'
import type editor from './locales/en/editor.json'
import type nodes from './locales/en/nodes.json'
import type viewer from './locales/en/viewer.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    returnNull: false
    resources: {
      common: typeof common
      editor: typeof editor
      nodes: typeof nodes
      viewer: typeof viewer
    }
  }
}
