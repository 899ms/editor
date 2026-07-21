import type { Namespace, TFunction } from 'i18next'
import type { LocalizedDescriptor } from './types.js'

function resolveKey<Ns extends Namespace>(
  key: string | undefined,
  fallback: string,
  t: TFunction<Ns>,
) {
  if (!key) return fallback
  return t(key as never, { defaultValue: fallback })
}

export function resolveLocalizedLabel<Ns extends Namespace>(
  descriptor: LocalizedDescriptor,
  t: TFunction<Ns>,
): string {
  const fallback = descriptor.label ?? descriptor.kind ?? ''
  return resolveKey(descriptor.labelKey, fallback, t)
}

export function resolveLocalizedDescription<Ns extends Namespace>(
  descriptor: LocalizedDescriptor,
  t: TFunction<Ns>,
): string | undefined {
  const fallback = descriptor.description
  if (!descriptor.descriptionKey) return fallback
  return resolveKey(descriptor.descriptionKey, fallback ?? '', t) || undefined
}
