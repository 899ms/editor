import {
  getNodePluginId,
  nodeRegistry,
  registerPlugin,
  requirePlugin,
} from '@pascal-app/core/registry'
import { GLN_PLUGIN_ID, glnPlugin } from '@pascal-app/plugin-gln'

/** Register GLN schemas synchronously in both browser and server runtimes. */
export function ensureGlnPluginRegistered(): void {
  const kinds = glnPlugin.nodes?.map((definition) => definition.kind) ?? []
  const registeredKinds = kinds.filter((kind) => nodeRegistry.has(kind))
  if (registeredKinds.length > 0) {
    const conflicts = registeredKinds.filter((kind) => getNodePluginId(kind) !== GLN_PLUGIN_ID)
    if (conflicts.length > 0) {
      const owners = conflicts
        .map((kind) => `${kind} (${getNodePluginId(kind) ?? 'unowned'})`)
        .join(', ')
      throw new Error(`[gln] node kinds are already registered by another plugin: ${owners}`)
    }
    if (registeredKinds.length === kinds.length) {
      requirePlugin(GLN_PLUGIN_ID)
      return
    }
  }
  registerPlugin(glnPlugin, { mandatory: true })
}
