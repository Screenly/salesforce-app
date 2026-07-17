import { getCredentials, getSettingWithDefault } from '@screenly/edge-apps'
import { reportError } from '@screenly/edge-apps/utils'
import type { SalesforceContentType } from './types'

export type RefreshToken = () => Promise<void>
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

export function createCredentialManager(
  contentId: string,
  contentType: SalesforceContentType
): { refreshToken: RefreshToken; getRuntimeState: () => RuntimeState } {
  let accessToken: string | null =
    getSettingWithDefault('access_token', '') || null
  let instanceUrl: string | null = null
  let credentialError: Error | null = null
  let hasReportedCredentialError = false

  const refreshToken = async () => {
    try {
      const { token, metadata } = await getCredentials()
      const nextInstanceUrl = (metadata?.instance_url as string) ?? instanceUrl

      if (!token || !nextInstanceUrl) {
        throw new Error('No access token or instance URL available.')
      }

      accessToken = token
      instanceUrl = nextInstanceUrl
      credentialError = null
      hasReportedCredentialError = false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (!hasReportedCredentialError) {
        reportError(error, {
          source: 'salesforce-credentials',
          contentId,
          contentType,
        })
        hasReportedCredentialError = true
      }
      credentialError = error
      throw error
    }
  }

  return {
    refreshToken,
    getRuntimeState: () => ({ accessToken, instanceUrl, credentialError }),
  }
}
