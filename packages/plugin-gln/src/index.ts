import type { Plugin } from '@pascal-app/core/registry'
import type { ComponentType } from 'react'
import { GLN_PLUGIN_ID } from './constants'
import { glnSystemNodeDefinition } from './system-definition'

type GlnHostPanel = {
  id: string
  label: string
  icon: { kind: 'iconify'; name: string }
  component: () => Promise<{ default: ComponentType }>
  kinds: readonly string[]
  pluginId: string
  description: string
  creator: { name: string }
  defaultInstalled: boolean
  mandatory: boolean
}

export const glnPlugin: Plugin = {
  id: GLN_PLUGIN_ID,
  apiVersion: 1,
  nodes: [glnSystemNodeDefinition],
}

export const glnHostPanel: GlnHostPanel = {
  id: 'gln:systems',
  label: '光冷暖系统',
  icon: { kind: 'iconify', name: 'lucide:thermometer-sun' },
  component: () => import('./systems-panel'),
  kinds: ['gln:system'],
  pluginId: GLN_PLUGIN_ID,
  description: '创建、命名并切换光冷暖系统运行模式。',
  creator: { name: 'GLN' },
  defaultInstalled: true,
  mandatory: true,
}

export { GLN_PLUGIN_ID } from './constants'
export { glnSystemDefinition, glnSystemNodeDefinition } from './system-definition'
export { GlnSystemMode, GlnSystemNode } from './system-schema'
