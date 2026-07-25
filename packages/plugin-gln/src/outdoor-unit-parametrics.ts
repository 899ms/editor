import type { ParametricDescriptor } from '@pascal-app/core'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

export const glnOutdoorUnitParametrics: ParametricDescriptor<GlnOutdoorUnitNode> = {
  derive: (next, patch) => {
    if (!('finish' in patch)) return {}
    return next.finish === 'graphite'
      ? { bodyColor: '#50575d', grilleColor: '#23282c' }
      : { bodyColor: '#e8ecef', grilleColor: '#333a40' }
  },
  groups: [
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
  ],
}
