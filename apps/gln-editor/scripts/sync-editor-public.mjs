import { cp, lstat, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.resolve(appDirectory, '..', 'editor', 'public')
const targetDirectory = path.resolve(appDirectory, 'public')
const copyMarker = path.join(targetDirectory, '.gln-editor-managed-copy')

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

if (!(await targetAlreadySharesSource())) {
  try {
    await lstat(targetDirectory)
    if (!(await targetIsManagedCopy())) {
      throw new Error(`Refusing to replace unmanaged asset directory: ${targetDirectory}`)
    }
    await rm(targetDirectory, { recursive: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  try {
    await symlink(sourceDirectory, targetDirectory, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (!['EACCES', 'EPERM', 'UNKNOWN'].includes(error?.code)) throw error
    await cp(sourceDirectory, targetDirectory, {
      errorOnExist: false,
      force: true,
      recursive: true,
    })
    await writeFile(copyMarker, `${sourceDirectory}\n`, 'utf8')
  }
}
