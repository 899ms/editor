import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')

const MIGRATED_FILES = [
  'apps/editor/app/client-bootstrap.tsx',
  'apps/editor/app/page.tsx',
  'apps/editor/app/scene/[id]/page.tsx',
  'apps/editor/app/scenes/page.tsx',
  'apps/editor/components/build-tab.tsx',
  'apps/editor/components/save-button.tsx',
  'apps/editor/components/scene-loader.tsx',
  'apps/editor/app/layout.tsx',
  'apps/editor/components/viewer-toolbar.tsx',
  'packages/editor/src/components/editor/index.tsx',
  'packages/editor/src/components/editor/first-person-controls.tsx',
  'packages/editor/src/components/ui/floating-level-selector.tsx',
  'packages/editor/src/components/ui/level-duplicate-dialog.tsx',
  'packages/editor/src/components/ui/sidebar/panels/site-panel/index.tsx',
  'packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx',
  'packages/editor/src/components/ui/sidebar/panels/settings-panel/audio-settings-dialog.tsx',
  'packages/editor/src/components/ui/sidebar/panels/settings-panel/keyboard-shortcuts-dialog.tsx',
  'packages/editor/src/components/ui/sidebar/panels/settings-panel/load-build-dialog.tsx',
  'packages/editor/src/components/ui/action-menu/camera-actions.tsx',
  'packages/editor/src/components/ui/action-menu/view-toggles.tsx',
  'packages/editor/src/components/ui/helpers/contextual-helper-panel.tsx',
  'packages/editor/src/components/ui/helpers/registered-tool-helper.tsx',
  'packages/editor/src/components/ui/primitives/shortcut-token.tsx',
  'packages/editor/src/components/ui/primitives/dialog.tsx',
  'packages/editor/src/components/ui/primitives/sheet.tsx',
  'packages/editor/src/components/tools/shared/cursor-sphere.tsx',
  'packages/editor/src/components/ui/action-menu/control-modes.tsx',
  'packages/editor/src/components/ui/action-menu/measurement-control.tsx',
  'packages/editor/src/components/ui/panels/parametric-inspector.tsx',
  'packages/editor/src/components/ui/sidebar/panels/site-panel/registry-tree-node.tsx',
  'packages/viewer/src/components/viewer/index.tsx',
] as const

const TECHNICAL_TEXT_ALLOWLIST = new Set(['ESC'])

const USER_TEXT_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'description',
  'label',
  'placeholder',
  'title',
])

type Finding = {
  file: string
  line: number
  text: string
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function looksLikeEnglishUserText(value: string) {
  const text = normalizeText(value)
  return !TECHNICAL_TEXT_ALLOWLIST.has(text) && /[A-Za-z]{2}/.test(text)
}

function addFinding(findings: Finding[], sourceFile: ts.SourceFile, node: ts.Node, text: string) {
  const normalized = normalizeText(text)
  if (!looksLikeEnglishUserText(normalized)) return
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  findings.push({
    file: path.relative(ROOT, sourceFile.fileName).replaceAll('\\', '/'),
    line: line + 1,
    text: normalized,
  })
}

function inspectFile(relativePath: string): Finding[] {
  const absolutePath = path.join(ROOT, relativePath)
  const source = fs.readFileSync(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const findings: Finding[] = []

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      addFinding(findings, sourceFile, node, node.getText(sourceFile))
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile)
      if (
        USER_TEXT_ATTRIBUTES.has(name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        addFinding(findings, sourceFile, node.initializer, node.initializer.text)
      }
    }

    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
    ) {
      addFinding(findings, sourceFile, node.expression, node.expression.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const findings = MIGRATED_FILES.flatMap(inspectFile)

if (findings.length > 0) {
  console.error('Hard-coded English UI text found in the migrated i18n scope:')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  ${JSON.stringify(finding.text)}`)
  }
  process.exit(1)
}

console.log(`i18n hard-coded text check passed for ${MIGRATED_FILES.length} migrated files.`)
