import { describe, expect, test } from 'bun:test'
import { resolveBuiltInEditorUiText } from './editor-ui-text.js'
import { createPascalI18n } from './instance.js'
import { resolveBuiltInNodeUiText } from './node-ui-text.js'
import { BUILTIN_RESOURCES } from './resources.js'

function flattenLeafTypes(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      for (const [childKey, childType] of flattenLeafTypes(child, path)) {
        result.set(childKey, childType)
      }
    }
    return result
  }

  result.set(prefix, Array.isArray(value) ? 'array' : typeof value)
  return result
}

describe('bundled translation resources', () => {
  for (const namespace of ['common', 'editor', 'nodes', 'viewer'] as const) {
    test(`${namespace} has matching English and Chinese keys and value types`, () => {
      const english = flattenLeafTypes(BUILTIN_RESOURCES.en[namespace])
      const chinese = flattenLeafTypes(BUILTIN_RESOURCES['zh-CN'][namespace])

      expect([...chinese.keys()].sort()).toEqual([...english.keys()].sort())
      expect([...chinese.entries()].sort()).toEqual([...english.entries()].sort())
    })
  }
})
describe('built-in UI text bridges', () => {
  const i18n = createPascalI18n({ initialLocale: 'zh-CN', reportMissingKeys: false })
  const editorT = i18n.getFixedT('zh-CN', 'editor')
  const nodeT = i18n.getFixedT('zh-CN', 'nodes')

  test('localizes the complete wall inspector vocabulary', () => {
    const expected = new Map([
      ['Wall 9', '墙体 9'],
      ['Dimensions', '尺寸'],
      ['Length', '长度'],
      ['Height', '高度'],
      ['Thickness', '厚度'],
      ['Curve', '弯曲'],
      ['Wall bands', '墙体饰带'],
      ['Bands', '饰带数量'],
      ['Skirting', '踢脚线'],
      ['Show skirting', '显示踢脚线'],
      ['Crown molding', '顶角线'],
      ['Show crown molding', '显示顶角线'],
      ['Chair rail', '护墙横条'],
      ['Show chair rail', '显示护墙横条'],
      ['Actions', '操作'],
    ])

    for (const [source, translated] of expected) {
      expect(resolveBuiltInNodeUiText(source, nodeT)).toBe(translated)
    }
  })

  test('localizes option cards and imported preset labels outside shared controls', () => {
    const expected = new Map([
      ['Hinged', '铰链式'],
      ['Double', '双扇'],
      ['French', '法式'],
      ['Folding', '折叠式'],
      ['Pocket', '暗藏式'],
      ['Barn', '谷仓式'],
      ['Sliding', '推拉式'],
      ['Sectional', '分段式'],
      ['Roll-up', '卷帘式'],
      ['Tilt-up', '翻板式'],
      ['Straight Round', '直圆柱'],
      ['Square Block', '方柱'],
      ['Tapered Round', '收分圆柱'],
      ['Soft Bulged', '柔和鼓腹柱'],
      ['A-Frame Support', 'A 字支撑'],
      ['Single Strut', '单撑杆'],
      ['Flat roof skylight', '平屋顶天窗'],
      ['Walk-on rooflight', '可步行采光顶'],
      ['Roof lantern', '屋顶采光亭'],
      ['Opening skylight', '可开启天窗'],
      ['Sliding skylight', '推拉天窗'],
      ['Residential', '住宅标准'],
      ['Residential Large', '住宅大尺寸'],
      ['Compact', '紧凑型'],
      ['Frameless', '无边框'],
    ])

    for (const [source, translated] of expected) {
      expect(resolveBuiltInNodeUiText(source, nodeT)).toBe(translated)
    }
  })

  test('localizes generated default node names', () => {
    const expected = new Map([
      ['Wall 1', '墙体 1'],
      ['Room 1 Slab', '房间 1 楼板'],
      ['Room 1 Ceiling', '房间 1 天花板'],
      ['Spawn Point', '出生点'],
    ])

    for (const [source, translated] of expected) {
      expect(resolveBuiltInNodeUiText(source, nodeT)).toBe(translated)
    }
  })
  test('localizes editor metadata and composed state labels', () => {
    expect(resolveBuiltInEditorUiText('Scene', editorT)).toBe('场景')
    expect(resolveBuiltInEditorUiText('Render: Solid', editorT)).toBe('渲染：实体')
    expect(resolveBuiltInEditorUiText('Scans: Hidden', editorT)).toBe('扫描模型：隐藏')
    expect(editorT('settings.sceneGraph.collapse')).toBe('折叠')
    expect(editorT('settings.sceneGraph.expand')).toBe('展开')
  })

  test('preserves user-authored names that are not built-in copy', () => {
    expect(resolveBuiltInNodeUiText('Customer Wall Alpha', nodeT)).toBe('Customer Wall Alpha')
    expect(resolveBuiltInEditorUiText('Client Project Alpha', editorT)).toBe('Client Project Alpha')
  })
})
