import { registerEditorHostPanel } from '@pascal-app/editor'
import { glnHostPanel } from '@pascal-app/plugin-gln'
import '../../editor/lib/bootstrap'
import { ensureGlnPluginRegistered } from './register-gln-plugin'

ensureGlnPluginRegistered()
registerEditorHostPanel(glnHostPanel)
