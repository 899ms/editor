import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const SOURCE_ROOTS = [
  'apps/editor/app',
  'apps/editor/components',
  'apps/editor/lib',
  'packages/plugin-trees/src',
  'packages/editor/src',
  'packages/nodes/src',
  'packages/viewer/src',
] as const

const DISPLAY_METADATA_FILES = [
  'packages/core/src/schema/nodes/column.ts',
  'packages/core/src/schema/nodes/skylight.ts',
  'packages/core/src/solar-panel-presets.ts',
] as const

const EXCLUDED_PATH_PARTS = ['/__tests__/', '.stories.', '.test.', '.spec.'] as const

const AUTO_LOCALIZED_PROPS = new Map<string, ReadonlySet<string>>([
  ['ActionButton', new Set(['aria-label', 'label', 'title'])],
  ['MetricControl', new Set(['label'])],
  ['PanelSection', new Set(['title'])],
  ['PanelWrapper', new Set(['title'])],
  ['SegmentedControl', new Set(['label'])],
  ['SliderControl', new Set(['label'])],
  ['ToggleControl', new Set(['label'])],
  ['QuantityRow', new Set(['label'])],
  ['Stepper', new Set(['label'])],
  ['WallTrimSection', new Set(['title'])],
])

const EDITOR_AUTO_LOCALIZED_PROPS = new Map<string, ReadonlySet<string>>([
  ['ActionButton', new Set(['aria-label', 'label', 'title'])],
  ['Button', new Set(['aria-label', 'title'])],
  ['Input', new Set(['aria-label', 'placeholder', 'title'])],
])

type MetadataResolverKind = 'editor' | 'node' | 'editor-or-node' | 'semantic-editor'
type MetadataPolicy = {
  properties: ReadonlySet<string>
  resolver: MetadataResolverKind
}

// These files keep English as stable metadata, but every listed property passes
// through a known localization boundary before it reaches the UI. The audit
// still requires every value to resolve, so adding new untranslated metadata
// fails CI instead of being silently allowed.
const AUTO_LOCALIZED_METADATA = new Map<string, MetadataPolicy>([
  [
    'packages/editor/src/components/ui/action-menu/structure-tools.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/editor/src/components/ui/command-palette/editor-commands.tsx',
    { properties: new Set(['group', 'label']), resolver: 'editor' },
  ],
  [
    'packages/editor/src/components/ui/helpers/helper-manager.tsx',
    { properties: new Set(['label', 'subtitle']), resolver: 'editor-or-node' },
  ],
  [
    'packages/editor/src/components/ui/item-catalog/catalog-items.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/editor/src/components/ui/panels/node-display.ts',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/editor/src/components/ui/sidebar/icon-rail.tsx',
    { properties: new Set(['label']), resolver: 'editor' },
  ],
  [
    'packages/editor/src/components/ui/sidebar/panels/settings-panel/keyboard-shortcuts-dialog.tsx',
    { properties: new Set(['action', 'note', 'title']), resolver: 'semantic-editor' },
  ],
  [
    'packages/editor/src/components/ui/sidebar/use-plugin-panels.tsx',
    { properties: new Set(['label']), resolver: 'editor' },
  ],

  [
    'packages/core/src/schema/nodes/column.ts',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/core/src/schema/nodes/skylight.ts',
    { properties: new Set(['label']), resolver: 'node' },
  ],  [
    'packages/nodes/src/cabinet/compartment-card.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/cabinet/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/chimney/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/column/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/door/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/dormer/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/elevator/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],
  [
    'packages/nodes/src/window/panel.tsx',
    { properties: new Set(['label']), resolver: 'node' },
  ],  [
    'packages/editor/src/components/viewer-overlay.tsx',
    { properties: new Set(['detail', 'label', 'name']), resolver: 'editor' },
  ],
])

const AUTO_LOCALIZED_COLLECTIONS = new Map<string, MetadataResolverKind>([
  ['packages/core/src/solar-panel-presets.ts', 'node'],
  ['packages/editor/src/components/ui/snap-target-badge.tsx', 'node'],
])

const USER_TEXT_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-description',
  'description',
  'label',
  'placeholder',
  'title',
])

const USER_TEXT_PROPERTIES = new Set([
  'ariaLabel',
  'cancelText',
  'confirmText',
  'description',
  'detail',
  'emptyMessage',
  'help',
  'label',
  'message',
  'placeholder',
  'title',
  'tooltip',
])

const TRANSLATION_CALLEES = new Set([
  't',
  'uiText',
  'resolveBuiltInEditorUiText',
  'resolveBuiltInNodeUiText',
])

const TECHNICAL_TEXT_ALLOWLIST = new Set([
  '(MIT).',
  'A',
  'API',
  'B',
  'BIM',
  'C',
  'CAD',
  'Ctrl',
  'DWV',
  'Daniel Greenheck',
  'ESC',
  'F',
  'GLB',
  'H',
  'HVAC',
  'JSON',
  'K',
  'M',
  'MIT',
  'MCP',
  'PDF',
  'Pascal',
  'Q',
  'R',
  'R / T',
  'RGB',
  'T',
  'URL',
  'V',
  'W',
  'X',
  'XYZ',
  'Y',
  'Z',
  'cm',
  'ez-tree',
  'ft',
  'm',
  'FPS',
  'GPU',
  'DRAW',
  'TRI',
  'k DIRTY',
  'MESH',
  'LINE',
  'SPRITE',
  'LIGHT',
])

type StringMap = Record<string, string>
type FindingKind = 'hard-coded' | 'syntax' | 'unmapped-node-ui'
type Finding = {
  file: string
  line: number
  kind: FindingKind
  text: string
}

const zhNodes = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/zh-CN/nodes.json'), 'utf8'),
) as { uiTerms?: StringMap; uiText?: StringMap }
const nodeExact = zhNodes.uiText ?? {}
const nodeTerms = zhNodes.uiTerms ?? {}
const enEditorResource = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/en/editor.json'), 'utf8'),
) as Record<string, unknown>
const zhEditorResource = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/zh-CN/editor.json'), 'utf8'),
) as Record<string, unknown>
const editorExact = (zhEditorResource.legacyUiText as StringMap | undefined) ?? {}
const semanticEditorSourceValues = new Set<string>()
collectTranslatedSourceValues(enEditorResource, zhEditorResource, semanticEditorSourceValues)

function collectFiles(root: string): string[] {
  const absoluteRoot = path.join(ROOT, root)
  if (!fs.existsSync(absoluteRoot)) return []
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolute)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const normalized = absolute.replaceAll('\\', '/')
        if (!EXCLUDED_PATH_PARTS.some((part) => normalized.includes(part))) files.push(absolute)
      }
    }
  }
  visit(absoluteRoot)
  return files
}

function collectTranslatedSourceValues(
  source: unknown,
  translated: unknown,
  values: Set<string>,
) {
  if (typeof source === 'string' && typeof translated === 'string') {
    if (source !== translated) values.add(normalizeText(source))
    return
  }
  if (!source || !translated || typeof source !== 'object' || typeof translated !== 'object') return
  if (Array.isArray(source) || Array.isArray(translated)) return
  for (const [key, sourceValue] of Object.entries(source)) {
    collectTranslatedSourceValues(
      sourceValue,
      (translated as Record<string, unknown>)[key],
      values,
    )
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function looksLikeEnglishUserText(value: string) {
  const text = normalizeText(value)
  return !TECHNICAL_TEXT_ALLOWLIST.has(text) && /[A-Za-z]{2}/.test(text)
}

function resolvesAsNodeUiText(value: string) {
  const normalized = normalizeText(value)
  if (
    Object.entries(nodeExact).some(
      ([key, translated]) => key.toLowerCase() === normalized.toLowerCase() && translated !== key,
    )
  ) {
    return true
  }

  const words = normalized.match(/[A-Za-z][A-Za-z0-9]*/g)
  if (!words?.length) return true
  return words.every((word) => {
    const lower = word.toLowerCase()
    return Boolean(nodeTerms[lower]) || TECHNICAL_TEXT_ALLOWLIST.has(word)
  })
}

function resolvesAsEditorUiText(value: string) {
  const normalized = normalizeText(value)
  return Object.entries(editorExact).some(
    ([key, translated]) => key.toLowerCase() === normalized.toLowerCase() && translated !== key,
  )
}

function resolvesAsSemanticEditorText(value: string) {
  const normalized = normalizeText(value).toLowerCase()
  return Array.from(semanticEditorSourceValues).some(
    (sourceValue) => sourceValue.toLowerCase() === normalized,
  )
}

function relativeSourcePath(sourceFile: ts.SourceFile) {
  return path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/')
}

function metadataResolver(sourceFile: ts.SourceFile, property: string) {
  const policy = AUTO_LOCALIZED_METADATA.get(relativeSourcePath(sourceFile))
  if (!policy?.properties.has(property)) return undefined
  if (policy.resolver === 'editor') return resolvesAsEditorUiText
  if (policy.resolver === 'node') return resolvesAsNodeUiText
  if (policy.resolver === 'semantic-editor') return resolvesAsSemanticEditorText
  return (value: string) => resolvesAsEditorUiText(value) || resolvesAsNodeUiText(value)
}

function propertyName(node: ts.PropertyName, sourceFile: ts.SourceFile) {
  return node.getText(sourceFile).replaceAll(/["']/g, '')
}

const USER_TEXT_IDENTIFIER_PATTERN =
  /(?:caption|category|description|detail|emptyMessage|error|heading|help|hint|label|message|note|placeholder|status|subtitle|summary|title|tooltip)$/i
const USER_TEXT_COLLECTION_PATTERN =
  /(?:actions|categories|choices|labels|messages|options|tabs|tooltips)$/i

function looksLikeDisplayLiteral(value: string) {
  const normalized = normalizeText(value)
  return (
    looksLikeEnglishUserText(normalized) &&
    (/\s/.test(normalized) || /^[A-Z]/.test(normalized) || /[.!?:…]$/.test(normalized))
  )
}

function namedFunction(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)) &&
      current.name
    ) {
      return current.name.getText(sourceFile)
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text
    }
    current = current.parent
  }
  return undefined
}

function addFinding(
  findings: Finding[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  text: string,
  kind: FindingKind,
) {
  const normalized = normalizeText(text)
  if (kind !== 'syntax' && !looksLikeEnglishUserText(normalized)) return
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  findings.push({
    file: path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/'),
    kind,
    line: line + 1,
    text: normalized,
  })
}

function jsxTagName(attribute: ts.JsxAttribute) {
  const owner = attribute.parent.parent
  return ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)
    ? owner.tagName.getText()
    : ''
}

function callName(call: ts.CallExpression, sourceFile: ts.SourceFile) {
  return call.expression.getText(sourceFile)
}

function isInsideTranslationCall(node: ts.Node, boundary: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node.parent
  while (current && current !== boundary.parent) {
    if (ts.isCallExpression(current)) {
      const name = callName(current, sourceFile)
      if (TRANSLATION_CALLEES.has(name) || name.endsWith('.t')) return true
    }
    current = current.parent
  }
  return false
}

function staticTextNodes(expression: ts.Expression): Array<{ node: ts.Node; text: string }> {
  const values: Array<{ node: ts.Node; text: string }> = []
  const visitExpression = (node: ts.Expression) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      values.push({ node, text: node.text })
      return
    }
    if (ts.isTemplateExpression(node)) {
      values.push({ node: node.head, text: node.head.text })
      for (const span of node.templateSpans) values.push({ node: span.literal, text: span.literal.text })
      return
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
      visitExpression(node.expression)
      return
    }
    if (ts.isConditionalExpression(node)) {
      visitExpression(node.whenTrue)
      visitExpression(node.whenFalse)
      return
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        visitExpression(node.left)
        visitExpression(node.right)
      } else if (
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        visitExpression(node.right)
      }
    }
  }
  visitExpression(expression)
  return values
}

function objectHasTranslationKey(
  assignment: ts.PropertyAssignment,
  name: string,
  sourceFile: ts.SourceFile,
) {
  const object = assignment.parent
  if (!ts.isObjectLiteralExpression(object)) return false
  const expected = new Set([`${name}Key`, 'i18nKey'])
  return object.properties.some(
    (property) =>
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      expected.has(propertyName(property.name, sourceFile)),
  )
}

function hasAncestorProperty(node: ts.Node, targetName: string, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isPropertyAssignment(current) && propertyName(current.name, sourceFile) === targetName) {
      return true
    }
    current = current.parent
  }
  return false
}

function isNodeUiSource(sourceFile: ts.SourceFile) {
  const relative = path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/')
  return (
    relative.startsWith('packages/nodes/src/') ||
    relative.startsWith('packages/plugin-trees/src/')
  )
}
function isNodeInspectorSource(sourceFile: ts.SourceFile) {
  const relative = relativeSourcePath(sourceFile)
  return (
    relative.startsWith('packages/nodes/src/') &&
    (relative.endsWith('/panel.tsx') || relative.endsWith('/compartment-card.tsx'))
  )
}

function directJsxLabelOwner(node: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isCallExpression(current)) {
      const name = callName(current, sourceFile)
      if (TRANSLATION_CALLEES.has(name) || name.endsWith('.t')) return 'localized'
    }
    if (ts.isJsxExpression(current)) {
      if (ts.isJsxElement(current.parent)) {
        return current.parent.openingElement.tagName.getText(sourceFile)
      }
      return undefined
    }
    current = current.parent
  }
  return undefined
}

function inspectFile(absolutePath: string): Finding[] {
  const source = fs.readFileSync(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const findings: Finding[] = []

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const node = diagnostic.start === undefined ? sourceFile : sourceFile.getChildAt(diagnostic.start)
    addFinding(findings, sourceFile, node, ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '), 'syntax')
  }

  function inspectExpression(
    expression: ts.Expression,
    boundary: ts.Node,
    kind: FindingKind,
    resolver?: (value: string) => boolean,
  ) {
    for (const value of staticTextNodes(expression)) {
      if (isInsideTranslationCall(value.node, boundary, sourceFile)) continue
      if (resolver?.(value.text)) continue
      addFinding(findings, sourceFile, value.node, value.text, kind)
    }
  }

  function inspectMappedExpression(
    expression: ts.Expression,
    kind: FindingKind,
    resolver: (value: string) => boolean,
  ) {
    for (const value of staticTextNodes(expression)) {
      if (resolver(value.text)) continue
      addFinding(findings, sourceFile, value.node, value.text, kind)
    }
  }

  function inspectTextCollection(expression: ts.Expression, property?: string) {
    if (property === 'keys') return
    const collectionResolverKind = AUTO_LOCALIZED_COLLECTIONS.get(relativeSourcePath(sourceFile))
    const defaultResolver =
      collectionResolverKind === 'node' || isNodeUiSource(sourceFile)
        ? resolvesAsNodeUiText
        : resolvesAsEditorUiText
    const resolver = property ? metadataResolver(sourceFile, property) ?? defaultResolver : defaultResolver

    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      if (looksLikeDisplayLiteral(expression.text) && !resolver(expression.text)) {
        addFinding(findings, sourceFile, expression, expression.text, 'hard-coded')
      }
      return
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        if (ts.isExpression(element)) inspectTextCollection(element, property)
      }
      return
    }
    if (ts.isObjectLiteralExpression(expression)) {
      for (const member of expression.properties) {
        if (!ts.isPropertyAssignment(member) || !ts.isExpression(member.initializer)) continue
        inspectTextCollection(member.initializer, propertyName(member.name, sourceFile))
      }
      return
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
      inspectTextCollection(expression.expression, property)
      return
    }
    if (ts.isConditionalExpression(expression)) {
      inspectTextCollection(expression.whenTrue, property)
      inspectTextCollection(expression.whenFalse, property)
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const owner = ts.isJsxElement(node.parent) ? node.parent.openingElement.tagName.getText() : ''
      if (owner === 'NodeUiText') {
        if (!resolvesAsNodeUiText(node.getText(sourceFile))) {
          addFinding(findings, sourceFile, node, node.getText(sourceFile), 'unmapped-node-ui')
        }
      } else if (owner === 'EditorUiText') {
        if (!resolvesAsEditorUiText(node.getText(sourceFile))) {
          addFinding(findings, sourceFile, node, node.getText(sourceFile), 'hard-coded')
        }
      } else if (owner !== 'style') {
        addFinding(findings, sourceFile, node, node.getText(sourceFile), 'hard-coded')
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile)
      if (USER_TEXT_ATTRIBUTES.has(name) && node.initializer) {
        const component = jsxTagName(node)
        const nodeAutoLocalized = AUTO_LOCALIZED_PROPS.get(component)?.has(name) ?? false
        const editorAutoLocalized = EDITOR_AUTO_LOCALIZED_PROPS.get(component)?.has(name) ?? false
        const kind: FindingKind = nodeAutoLocalized ? 'unmapped-node-ui' : 'hard-coded'
        const resolver = nodeAutoLocalized
          ? resolvesAsNodeUiText
          : editorAutoLocalized
            ? resolvesAsEditorUiText
            : undefined

        if (ts.isStringLiteral(node.initializer)) {
          if (!resolver?.(node.initializer.text)) {
            addFinding(findings, sourceFile, node.initializer, node.initializer.text, kind)
          }
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          inspectExpression(node.initializer.expression, node.initializer, kind, resolver)
        }
      }
    }

    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression
    ) {
      const owner = ts.isJsxElement(node.parent)
        ? node.parent.openingElement.tagName.getText(sourceFile)
        : ''
      if (owner !== 'style') inspectExpression(node.expression, node, 'hard-coded')
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name, sourceFile)
      const automaticMetadataResolver = metadataResolver(sourceFile, name)
      if (automaticMetadataResolver) {
        if (
          ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer)
        ) {
          if (!automaticMetadataResolver(node.initializer.text)) {
            addFinding(findings, sourceFile, node.initializer, node.initializer.text, 'hard-coded')
          }
        } else if (ts.isTemplateExpression(node.initializer)) {
          inspectMappedExpression(node.initializer, 'hard-coded', automaticMetadataResolver)
        }
      } else if (
        USER_TEXT_PROPERTIES.has(name) &&
        !objectHasTranslationKey(node, name, sourceFile) &&
        !(name === 'description' && hasAncestorProperty(node, 'mcp', sourceFile))
      ) {
        const kind: FindingKind = isNodeUiSource(sourceFile) ? 'unmapped-node-ui' : 'hard-coded'
        const resolver = kind === 'unmapped-node-ui' ? resolvesAsNodeUiText : undefined
        if (
          ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer)
        ) {
          if (!resolver?.(node.initializer.text)) {
            addFinding(findings, sourceFile, node.initializer, node.initializer.text, kind)
          }
        } else if (ts.isTemplateExpression(node.initializer)) {
          inspectExpression(node.initializer, node, kind, resolver)
        }
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      USER_TEXT_COLLECTION_PATTERN.test(node.name.text) &&
      node.initializer &&
      ts.isExpression(node.initializer)
    ) {
      inspectTextCollection(node.initializer)
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      USER_TEXT_IDENTIFIER_PATTERN.test(node.name.text) &&
      node.initializer &&
      ts.isExpression(node.initializer)
    ) {
      const resolver = isNodeUiSource(sourceFile)
        ? resolvesAsNodeUiText
        : resolvesAsEditorUiText
      for (const value of staticTextNodes(node.initializer)) {
        if (!looksLikeDisplayLiteral(value.text) || resolver(value.text)) continue
        addFinding(findings, sourceFile, value.node, value.text, 'hard-coded')
      }
    }

    if (ts.isReturnStatement(node) && node.expression) {
      const functionName = namedFunction(node, sourceFile)
      if (functionName && USER_TEXT_IDENTIFIER_PATTERN.test(functionName)) {
        const resolver = isNodeUiSource(sourceFile)
          ? resolvesAsNodeUiText
          : resolvesAsEditorUiText
        for (const value of staticTextNodes(node.expression)) {
          if (!looksLikeDisplayLiteral(value.text) || resolver(value.text)) continue
          addFinding(findings, sourceFile, value.node, value.text, 'hard-coded')
        }
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'label' &&
      isNodeInspectorSource(sourceFile)
    ) {
      const owner = directJsxLabelOwner(node, sourceFile)
      if (owner && owner !== 'localized' && owner !== 'NodeUiText') {
        addFinding(findings, sourceFile, node, node.getText(sourceFile), 'hard-coded')
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = callName(node, sourceFile)
      const first = node.arguments[0]
      if (
        first &&
        ts.isExpression(first) &&
        (callee === 'ui' || callee === 'resolveBuiltInEditorUiText')
      ) {
        inspectMappedExpression(first, 'hard-coded', resolvesAsEditorUiText)
      } else if (
        first &&
        ts.isExpression(first) &&
        (callee === 'uiText' || callee === 'resolveBuiltInNodeUiText')
      ) {
        inspectMappedExpression(first, 'unmapped-node-ui', resolvesAsNodeUiText)
      }

      if (
        ['alert', 'confirm', 'window.alert', 'window.confirm'].includes(callee) ||
        /^toast\.(error|info|success|warning)$/.test(callee)
      ) {
        const first = node.arguments[0]
        if (first && ts.isExpression(first)) inspectExpression(first, node, 'hard-coded')
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const REQUIRED_LOCALIZATION_BOUNDARIES = [
  {
    file: 'apps/editor/app/client-bootstrap.tsx',
    snippets: [
      'defaultPascalI18n.changeLanguage(initialLocale)',
      'defaultPascalI18n.changeLanguage(normalizePascalLocale(language))',
    ],
  },
  {
    file: 'packages/editor/src/components/ui/sidebar/panels/site-panel/inline-rename-input.tsx',
    snippets: ['resolveBuiltInNodeUiText(name, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx',
    snippets: ['function LocalizedSceneGraphTree', 'new MutationObserver(localize)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/material-picker.tsx',
    snippets: ['nodeUi(getCategoryLabel(category))', 'nodeUi(item.label)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/action-button.tsx',
    snippets: ['resolveBuiltInNodeUiText(label, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/metric-control.tsx',
    snippets: ['resolveBuiltInNodeUiText(label, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/panel-section.tsx',
    snippets: ['resolveBuiltInNodeUiText(title, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/panels/panel-wrapper.tsx',
    snippets: ['resolveBuiltInNodeUiText(title, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/segmented-control.tsx',
    snippets: ['resolveBuiltInNodeUiText(option.label, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/slider-control.tsx',
    snippets: ['resolveBuiltInNodeUiText(label, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/controls/toggle-control.tsx',
    snippets: ['resolveBuiltInNodeUiText(label, t)'],
  },
  {
    file: 'packages/editor/src/components/ui/primitives/button.tsx',
    snippets: ['resolveBuiltInEditorUiText'],
  },
  {
    file: 'packages/editor/src/components/ui/primitives/input.tsx',
    snippets: ['resolveBuiltInEditorUiText'],
  },
] as const
const files = Array.from(
  new Set([
    ...SOURCE_ROOTS.flatMap(collectFiles),
    ...DISPLAY_METADATA_FILES.map((file) => path.join(ROOT, file)).filter(fs.existsSync),
  ]),
).sort()
const findings = Array.from(
  new Map(
    files
      .flatMap(inspectFile)
      .map((finding) => [`${finding.file}:${finding.line}:${finding.kind}:${finding.text}`, finding]),
  ).values(),
)

for (const boundary of REQUIRED_LOCALIZATION_BOUNDARIES) {
  const absolute = path.join(ROOT, boundary.file)
  const source = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : ''
  for (const snippet of boundary.snippets) {
    if (source.includes(snippet)) continue
    findings.push({
      file: boundary.file,
      kind: 'hard-coded',
      line: 1,
      text: 'missing localization boundary: ' + snippet,
    })
  }
}
if (findings.length > 0) {
  console.error(
    `Full i18n audit found ${findings.length} issue(s) across ${files.length} UI source files:`,
  )
  for (const finding of findings) {
    console.error(
      `  [${finding.kind}] ${finding.file}:${finding.line}  ${JSON.stringify(finding.text)}`,
    )
  }
  process.exit(1)
}

console.log(`Full i18n audit passed for ${files.length} UI source files.`)
