import type { ParametricDescriptor } from '@pascal-app/core'
import type { GlnWallPanelNode } from './wall-panel-schema'

export const glnWallPanelParametrics: ParametricDescriptor<GlnWallPanelNode> = {
  groups: [
    {
      label: '尺寸',
      fields: [
        {
          key: 'width',
          kind: 'number',
          label: '面板宽度',
          unit: 'm',
          min: 0.3,
          max: 3,
          step: 0.05,
        },
        {
          key: 'height',
          kind: 'number',
          label: '面板高度',
          unit: 'm',
          min: 0.6,
          max: 4,
          step: 0.05,
        },
        {
          key: 'depth',
          kind: 'number',
          label: '面板厚度',
          unit: 'm',
          min: 0.05,
          max: 0.4,
          step: 0.01,
        },
      ],
    },
    {
      label: '外观',
      fields: [{ key: 'finishColor', kind: 'color', label: '面板颜色' }],
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
          max: 1.5,
          step: 0.25,
        },
      ],
    },
  ],
}
