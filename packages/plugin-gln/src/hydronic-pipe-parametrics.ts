import type { ParametricDescriptor } from '@pascal-app/core'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'

export const glnHydronicPipeParametrics: ParametricDescriptor<GlnHydronicPipeNode> = {
  groups: [
    {
      label: '水路',
      fields: [
        {
          key: 'circuit',
          kind: 'enum',
          label: '回路',
          options: ['supply', 'return'],
          optionLabels: { supply: '供水', return: '回水' },
          display: 'segmented',
        },
        {
          key: 'diameterIn',
          kind: 'number',
          label: '公称管径',
          unit: '英寸',
          min: 0.25,
          max: 2,
          step: 0.25,
        },
        {
          key: 'pipeMaterial',
          kind: 'enum',
          label: '管材',
          options: ['pex', 'pp-r', 'copper', 'stainless-steel'],
          optionLabels: {
            pex: 'PEX',
            'pp-r': 'PP-R',
            copper: '铜管',
            'stainless-steel': '不锈钢',
          },
        },
      ],
    },
    {
      label: '安装',
      fields: [
        {
          key: 'installationMode',
          kind: 'enum',
          label: '布管方式',
          options: ['ceiling', 'wall', 'through-wall'],
          optionLabels: { ceiling: '走天花板', wall: '沿墙', 'through-wall': '穿墙' },
          display: 'segmented',
        },
        {
          key: 'serviceHeightM',
          kind: 'number',
          label: '安装高度',
          unit: 'm',
          min: 0.1,
          max: 6,
          step: 0.05,
        },
        {
          key: 'insulationThicknessM',
          kind: 'number',
          label: '保温厚度',
          unit: 'm',
          min: 0,
          max: 0.08,
          step: 0.005,
        },
        { key: 'concealed', kind: 'boolean', label: '隐蔽安装' },
      ],
    },
  ],
}
