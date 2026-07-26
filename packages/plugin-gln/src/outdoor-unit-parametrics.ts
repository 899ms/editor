import type { ParametricDescriptor } from '@pascal-app/core'
import { GLN_OUTDOOR_UNIT_PRESETS } from './equipment-presets'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

export const glnOutdoorUnitParametrics: ParametricDescriptor<GlnOutdoorUnitNode> = {
  derive: (next, patch) => {
    const presetPatch = 'presetId' in patch ? GLN_OUTDOOR_UNIT_PRESETS[next.presetId] : {}
    const finishPatch =
      'finish' in patch
        ? next.finish === 'graphite'
          ? { bodyColor: '#50575d', grilleColor: '#23282c' }
          : { bodyColor: '#e8ecef', grilleColor: '#333a40' }
        : {}
    return { ...presetPatch, ...finishPatch }
  },
  groups: [
    {
      label: '参数预设',
      fields: [
        {
          key: 'presetId',
          kind: 'enum',
          label: '通用尺寸预设',
          options: Object.keys(GLN_OUTDOOR_UNIT_PRESETS),
          optionLabels: {
            'generic-compact': '通用紧凑',
            'generic-standard': '通用标准',
            'generic-wide': '通用加宽',
          },
        },
      ],
    },
    {
      label: '尺寸',
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.45, max: 2.5, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.25, max: 0.9, step: 0.01 },
        { key: 'height', kind: 'number', unit: 'm', min: 0.45, max: 2.2, step: 0.05 },
      ],
    },
    {
      label: '外观',
      fields: [
        {
          key: 'finish',
          kind: 'enum',
          label: '机身款式',
          options: ['light', 'graphite'],
          optionLabels: {
            light: '浅色',
            graphite: '石墨灰',
          },
          display: 'segmented',
        },
        { key: 'bodyColor', kind: 'color', label: '主体颜色' },
        { key: 'grilleColor', kind: 'color', label: '风扇格栅颜色' },
      ],
    },
    {
      label: '水路接口',
      fields: [
        {
          key: 'connectionDiameterIn',
          kind: 'number',
          label: '接口管径',
          unit: '英寸',
          min: 0.25,
          max: 2,
          step: 0.25,
        },
      ],
    },
    {
      label: '确认安装区域',
      fields: [
        { key: 'installationAreaZoneId', kind: 'ref', label: '安装空间', refKind: 'zone' },
        {
          key: 'installationAreaKind',
          kind: 'enum',
          label: '区域用途',
          options: ['unassigned', 'outdoor-equipment-area'],
          optionLabels: {
            unassigned: '未确认',
            'outdoor-equipment-area': '室外设备区',
          },
        },
      ],
    },
    {
      label: '检修净空（请按资料手工填写）',
      fields: [
        {
          key: 'clearanceFront',
          kind: 'number',
          label: '前方',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.05,
        },
        {
          key: 'clearanceBack',
          kind: 'number',
          label: '后方',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.05,
        },
        {
          key: 'clearanceLeft',
          kind: 'number',
          label: '左侧',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.05,
        },
        {
          key: 'clearanceRight',
          kind: 'number',
          label: '右侧',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.05,
        },
        {
          key: 'clearanceTop',
          kind: 'number',
          label: '顶部',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.05,
        },
      ],
    },
  ],
}
