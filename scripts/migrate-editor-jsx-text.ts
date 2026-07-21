import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const EDITOR_ROOT = path.join(ROOT, 'packages/editor/src/components')
const COMPONENT = path.join(EDITOR_ROOT, 'ui/editor-ui-text')
const resource = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/i18n/src/locales/zh-CN/editor.json'), 'utf8'),
) as { legacyUiText?: Record<string, string> }
const translations = resource.legacyUiText ?? {}

type Edit = { end: number; start: number; text: string }

function collect(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return collect(absolute)
    return entry.name.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(entry.name)
      ? [absolute]
      : []
  })
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function hasTranslation(value: string) {
  const normalized = normalize(value)
  return Object.keys(translations).some((key) => key.toLowerCase() === normalized.toLowerCase())
}

for (const file of collect(EDITOR_ROOT)) {
  if (file === `${COMPONENT}.tsx`) continue
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits: Edit[] = []

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasTranslation(node.getText(sourceFile))) {
      const owner = ts.isJsxElement(node.parent) ? node.parent.openingElement.tagName.getText() : ''
      if (!['EditorUiText', 'code', 'kbd', 'style'].includes(owner)) {
        const raw = node.getText(sourceFile)
        const value = normalize(raw)
        const leading = raw.match(/^\s*/)?.[0] ?? ''
        const trailing = raw.match(/\s*$/)?.[0] ?? ''
        edits.push({
          end: node.end,
          start: node.getStart(sourceFile),
          text: `${leading}<EditorUiText>${value}</EditorUiText>${trailing}`,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (!edits.length) continue
  const importPath = path.relative(path.dirname(file), COMPONENT).replaceAll('\\', '/')
  const modulePath = importPath.startsWith('.') ? importPath : `./${importPath}`
  const existingImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause?.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === modulePath,
  )
  const named = existingImport?.importClause?.namedBindings
  if (named && ts.isNamedImports(named)) {
    if (!named.elements.some((element) => element.name.text === 'EditorUiText')) {
      const insertAt = named.getStart(sourceFile) + 1
      edits.push({ end: insertAt, start: insertAt, text: ' EditorUiText,' })
    }
  } else {
    const firstImport = sourceFile.statements.find(ts.isImportDeclaration)
    const insertAt = firstImport?.getStart(sourceFile) ?? 0
    edits.push({
      end: insertAt,
      start: insertAt,
      text: `import { EditorUiText } from '${modulePath}'\n`,
    })
  }

  let output = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`
  }
  fs.writeFileSync(file, output, 'utf8')
  console.log(path.relative(ROOT, file).replaceAll('\\', '/'))
}
