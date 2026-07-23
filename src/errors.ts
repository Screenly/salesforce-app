export class BackendServerError extends Error {}

export function shouldSkipBackendError(
  error: unknown,
  displayErrors: boolean
): boolean {
  return error instanceof BackendServerError && !displayErrors
}
