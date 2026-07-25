import type { ParametricDescriptor } from '@pascal-app/core'
import type { GlnBufferTankNode } from './buffer-tank-schema'

export const glnBufferTankParametrics: ParametricDescriptor<GlnBufferTankNode> = {
  derive: (next, patch) => {
    if (!('finish' in patch)) return {}
    return next.finish === 'graphite' ? { jacketColor: '#4f575d' } : { jacketColor: '#dfe5e8' }
  },
  groups: [
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
  ],
}
