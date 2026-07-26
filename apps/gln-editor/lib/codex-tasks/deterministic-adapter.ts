import type { CodexScenePlanAdapter, CodexScenePlanAdapterInput } from './codex-task-manager'

export function createDeterministicCodexAdapter(
  output: unknown | ((input: CodexScenePlanAdapterInput) => unknown | Promise<unknown>),
): CodexScenePlanAdapter {
  return {
    async generate(input) {
      input.reportProgress(70)
      return typeof output === 'function' ? output(input) : output
    },
  }
}
