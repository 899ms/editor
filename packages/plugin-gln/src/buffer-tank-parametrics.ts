import type { ParametricDescriptor } from '@pascal-app/core'
import type { GlnBufferTankNode } from './buffer-tank-schema'
import { GLN_BUFFER_TANK_PRESETS } from './equipment-presets'

export const glnBufferTankParametrics: ParametricDescriptor<GlnBufferTankNode> = {
  derive: (next, patch) => {
    const presetPatch = 'presetId' in patch ? GLN_BUFFER_TANK_PRESETS[next.presetId] : {}
    const finishPatch =
      'finish' in patch
        ? next.finish === 'graphite'
          ? { jacketColor: '#4f575d' }
          : { jacketColor: '#dfe5e8' }
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
          options: Object.keys(GLN_BUFFER_TANK_PRESETS),
          optionLabels: {
            'generic-compact': '通用紧凑',
            'generic-standard': '通用标准',
            'generic-tall': '通用加高',
          },
        },
      ],
    },
    {
      label: '尺寸',
      fields: [
        {
          key: 'diameter',
          kind: 'number',
          label: '水箱直径',
          unit: 'm',
          min: 0.35,
          max: 2,
          step: 0.05,
        },
        {
          key: 'height',
          kind: 'number',
          label: '水箱高度',
          unit: 'm',
          min: 0.6,
          max: 3,
          step: 0.05,
        },
        {
          key: 'insulationThickness',
          kind: 'number',
          label: '保温厚度',
          unit: 'm',
          min: 0.01,
          max: 0.2,
          step: 0.01,
        },
      ],
    },
    {
      label: '外观',
      fields: [
        {
          key: 'finish',
          kind: 'enum',
          label: '外壳款式',
          options: ['light', 'graphite'],
          optionLabels: { light: '浅色', graphite: '石墨灰' },
          display: 'segmented',
        },
        { key: 'jacketColor', kind: 'color', label: '外壳颜色' },
        { key: 'stratificationView', kind: 'boolean', label: '显示冷热分层' },
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
          options: ['unassigned', 'equipment-room', 'mechanical-room', 'equipment-area'],
          optionLabels: {
            unassigned: '未确认',
            'equipment-room': '设备间',
            'mechanical-room': '机房',
            'equipment-area': '设备区',
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
