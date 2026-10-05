import type { CloudWatchClient } from '@aws-sdk/client-cloudwatch'

import { AWS_REGION } from '../config/env.js'

let client: CloudWatchClient | null = null

/**
 * The one CloudWatch client per Lambda container. Built lazily, so a cold start
 * that never touches a metric pays no SDK init cost.
 */
export async function getCloudWatchClient(): Promise<CloudWatchClient> {
  if (client) return client
  const { CloudWatchClient } = await import('@aws-sdk/client-cloudwatch')
  client = new CloudWatchClient({ region: AWS_REGION })
  return client
}
