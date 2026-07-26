import type { ScenePlanValidatorDefinition } from './types'

const validators = new Map<string, ScenePlanValidatorDefinition>()

export function registerScenePlanValidator(definition: ScenePlanValidatorDefinition): void {
  const existing = validators.get(definition.id)
  if (existing?.validate === definition.validate) return
  if (existing) {
    throw new Error(`[scene-plan] duplicate validator id: "${definition.id}"`)
  }
  validators.set(definition.id, definition)
}

export function getScenePlanValidators(): readonly ScenePlanValidatorDefinition[] {
  return [...validators.values()]
}

export function resetScenePlanValidatorsForTests(): void {
  validators.clear()
}
