import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const NODE_ROOT = path.join(ROOT, 'packages/nodes/src')
const TECHNICAL = new Set(['A', 'B', 'C', 'DWV', 'HVAC', 'K', 'M', 'R', 'T', 'V', 'X', 'Y', 'Z'])

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

function shouldMigrate(value: string) {
  const normalized = normalize(value)
  return /[A-Za-z]{2}/.test(normalized) && !TECHNICAL.has(normalized)
}

for (const file of collect(NODE_ROOT)) {
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits: Edit[] = []
  let needsImport = false

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && shouldMigrate(node.getText(sourceFile))) {
      const owner = ts.isJsxElement(node.parent) ? node.parent.openingElement.tagName.getText() : ''
      if (['NodeUiText', 'code', 'kbd', 'style'].includes(owner)) {
        return
      }
      const raw = node.getText(sourceFile)
      const value = normalize(raw)
      const leading = raw.match(/^\s*/)?.[0] ?? ''
      const trailing = raw.match(/\s*$/)?.[0] ?? ''
      edits.push({
        end: node.end,
        start: node.getStart(sourceFile),
        text: `${leading}<NodeUiText>${value}</NodeUiText>${trailing}`,
      })
      needsImport = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (!needsImport) continue

  const editorImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause?.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@pascal-app/editor',
  )
  const named = editorImport?.importClause?.namedBindings
  if (named && ts.isNamedImports(named)) {
    if (!named.elements.some((element) => element.name.text === 'NodeUiText')) {
      const insertAt = named.getStart(sourceFile) + 1
      edits.push({ end: insertAt, start: insertAt, text: ' NodeUiText,' })
    }
  } else {
    edits.push({ end: 0, start: 0, text: "import { NodeUiText } from '@pascal-app/editor'\n" })
  }

  let output = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`
  }
  fs.writeFileSync(file, output, 'utf8')
  console.log(path.relative(ROOT, file).replaceAll('\\', '/'))
}
