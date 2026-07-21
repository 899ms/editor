import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

const hints = {
  en: {
    plantTree: 'Plant tree',
    plantFlower: 'Plant flower',
    plantGrass: 'Plant grass',
    stop: 'Stop',
  },
  'zh-CN': {
    plantTree: '种植树木',
    plantFlower: '种植花卉',
    plantGrass: '种植草地',
    stop: '停止',
  },
} as const

for (const locale of ['en', 'zh-CN'] as const) {
  const file = resolve(root, `packages/i18n/src/locales/${locale}/editor.json`)
  const resource = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
  const nature = resource.nature as Record<string, unknown>
  nature.hints = hints[locale]
  await writeFile(file, `${JSON.stringify(resource, null, 2)}\n`, 'utf8')
}

console.log('Synchronized Nature plugin translations for en and zh-CN.')
