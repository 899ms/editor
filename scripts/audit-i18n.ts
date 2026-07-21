import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const SOURCE_ROOTS = [
  'apps/editor/app',
  'apps/editor/components',
  'apps/editor/node_modules/@pascal-app/plugin-trees/src',
  'packages/editor/src/components',
  'packages/nodes/src',
  'packages/viewer/src/components',
] as const

const EXCLUDED_PATH_PARTS = [
  '/__tests__/',

  '.stories.',
  '.test.',
  '.spec.',
] as const

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
const USER_TEXT_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-description',
  'description',
  'label',
  'placeholder',
  'title',
])

const TECHNICAL_TEXT_ALLOWLIST = new Set([
  'A',
  'B',
  'C',
  'H',
  'cm',
  'Ctrl',
  'DWV',
  'ESC',
  'F',
  'ft',
  'HVAC',
  'K',
  'M',
  'Q',
  'm',
  'R',
  'R / T',
  'T',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'XYZ',
])

type StringMap = Record<string, string>
type Finding = {
  file: string
  line: number
  kind: 'hard-coded' | 'unmapped-node-ui'
  text: string
}

const zhNodes = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/zh-CN/nodes.json'), 'utf8'),
) as { uiTerms?: StringMap; uiText?: StringMap }
const nodeExact = zhNodes.uiText ?? {}
const nodeTerms = zhNodes.uiTerms ?? {}
const zhEditor = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/zh-CN/editor.json'), 'utf8'),
) as { legacyUiText?: StringMap }
const editorExact = zhEditor.legacyUiText ?? {}

function collectFiles(root: string): string[] {
  const absoluteRoot = path.join(ROOT, root)
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

function addFinding(
  findings: Finding[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  text: string,
  kind: Finding['kind'],
) {
  const normalized = normalizeText(text)
  if (!looksLikeEnglishUserText(normalized)) return
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  findings.push({
    file: path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/'),
    kind,
    line: line + 1,
    text: normalized,
  })
}

function jsxTagName(attribute: ts.JsxAttribute) {
  const attributes = attribute.parent
  const owner = attributes.parent
  return ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)
    ? owner.tagName.getText()
    : ''
}

function isNodePanelMetadata(sourceFile: ts.SourceFile, node: ts.Node) {
  const relative = path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/')
  if (!relative.startsWith('packages/nodes/src/')) return false
  if (!/(panel|parametrics)\.tsx?$/.test(relative)) return false
  if (!ts.isPropertyAssignment(node)) return false
  const name = node.name.getText(sourceFile).replaceAll(/["']/g, '')
  return ['description', 'label', 'placeholder', 'title'].includes(name)
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
      if (
        USER_TEXT_ATTRIBUTES.has(name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        const component = jsxTagName(node)
        const nodeAutoLocalized = AUTO_LOCALIZED_PROPS.get(component)?.has(name) ?? false
        const editorAutoLocalized = EDITOR_AUTO_LOCALIZED_PROPS.get(component)?.has(name) ?? false
        if (nodeAutoLocalized || editorAutoLocalized) {
          const resolved =
            (nodeAutoLocalized && resolvesAsNodeUiText(node.initializer.text)) ||
            (editorAutoLocalized && resolvesAsEditorUiText(node.initializer.text))
          if (!resolved) {
            addFinding(
              findings,
              sourceFile,
              node.initializer,
              node.initializer.text,
              nodeAutoLocalized ? 'unmapped-node-ui' : 'hard-coded',
            )
          }
        } else {
          addFinding(findings, sourceFile, node.initializer, node.initializer.text, 'hard-coded')
        }
      }
    }

    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
    ) {
      const owner = ts.isJsxElement(node.parent)
        ? node.parent.openingElement.tagName.getText(sourceFile)
        : ''
      if (owner !== 'style') {
        addFinding(findings, sourceFile, node.expression, node.expression.text, 'hard-coded')
      }
    }

    if (
      isNodePanelMetadata(sourceFile, node) &&
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
      !resolvesAsNodeUiText(node.initializer.text)
    ) {
      addFinding(
        findings,
        sourceFile,
        node.initializer,
        node.initializer.text,
        'unmapped-node-ui',
      )
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile)
      if (
        (['alert', 'confirm', 'window.alert', 'window.confirm'].includes(callee) ||
          /^toast\.(error|info|success|warning)$/.test(callee)) &&
        node.arguments[0] &&
        (ts.isStringLiteral(node.arguments[0]) ||
          ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      ) {
        addFinding(findings, sourceFile, node.arguments[0], node.arguments[0].text, 'hard-coded')
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const files = SOURCE_ROOTS.flatMap(collectFiles)
const findings = files.flatMap(inspectFile)

if (findings.length > 0) {
  console.error(`i18n audit found ${findings.length} issue(s) across ${files.length} UI source files:`)
  for (const finding of findings) {
    console.error(
      `  [${finding.kind}] ${finding.file}:${finding.line}  ${JSON.stringify(finding.text)}`,
    )
  }
  process.exit(1)
}

console.log(`Full i18n audit passed for ${files.length} UI source files.`)
