import { cp, copyFile, lstat, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.resolve(appDirectory, '..', 'editor', 'public')
const targetDirectory = path.resolve(appDirectory, 'public')
const copyMarker = path.join(targetDirectory, '.gln-editor-managed-copy')
const webIfcDirectory = path.resolve(
  appDirectory,
  '..',
  '..',
  'packages',
  'ifc-converter',
  'node_modules',
  'web-ifc',
)
const dracoDirectory = path.resolve(
  appDirectory,
  'node_modules',
  'three',
  'examples',
  'jsm',
  'libs',
  'draco',
  'gltf',
)

async function targetAlreadySharesSource() {
  try {
    const stats = await lstat(targetDirectory)
    if (!stats.isSymbolicLink()) return false
    const linkTarget = await readlink(targetDirectory)
    return path.resolve(appDirectory, linkTarget) === sourceDirectory
  } catch {
    return false
  }
}

async function targetIsManagedCopy() {
  try {
    return (await readFile(copyMarker, 'utf8')).trim() === sourceDirectory
  } catch {
    return false
  }
}

const sharesSource = await targetAlreadySharesSource()
if (sharesSource) {
  await rm(targetDirectory, { force: true, recursive: true })
} else {
  try {
    await lstat(targetDirectory)
    if (!(await targetIsManagedCopy())) {
      throw new Error(`Refusing to replace unmanaged asset directory: ${targetDirectory}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

await cp(sourceDirectory, targetDirectory, {
  errorOnExist: false,
  force: true,
  recursive: true,
})
await writeFile(copyMarker, `${sourceDirectory}\n`, 'utf8')

for (const name of ['web-ifc.wasm', 'web-ifc-mt.wasm', 'web-ifc-node.wasm']) {
  await copyFile(path.join(webIfcDirectory, name), path.join(targetDirectory, name))
}

await cp(dracoDirectory, path.join(targetDirectory, 'draco'), {
  errorOnExist: false,
  force: true,
  recursive: true,
})
