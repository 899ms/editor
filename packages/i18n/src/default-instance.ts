import { createPascalI18n } from './instance.js'

export const defaultPascalI18n = createPascalI18n({
  initialLocale: 'en',
  reportMissingKeys: false,
})
