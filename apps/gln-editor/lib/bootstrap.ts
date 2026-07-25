import { registerEditorHostPanel } from '@pascal-app/editor'
import { glnHostPanels } from '@pascal-app/plugin-gln'
import '../../editor/lib/bootstrap'
import { ensureGlnPluginRegistered } from './register-gln-plugin'

ensureGlnPluginRegistered()
for (const panel of glnHostPanels) registerEditorHostPanel(panel)
