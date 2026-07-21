import { BackendServerError } from './credentials'

export type RenderOutcome = 'shown' | 'skipped'

export function shouldSkipBackendError(
  error: unknown,
  displayErrors: boolean
): boolean {
  return error instanceof BackendServerError && !displayErrors
}

export function shouldSignalReady(
  outcome: RenderOutcome,
  hasRenderedOnce: boolean
): boolean {
  return outcome === 'shown' && !hasRenderedOnce
}
