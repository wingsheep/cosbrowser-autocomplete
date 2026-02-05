import type { ConfigurationScope } from 'vscode'
import { computed } from 'reactive-vscode'
import { workspace } from 'vscode'

export interface CosConfig {
  enabled: boolean
  secretId: string
  secretKey: string
  bucket: string
  region: string
  cdnDomain: string
  defaultPrefix: string
  variableName: string
  cacheTimeout: number
}

/**
 * 获取 COS 配置
 * @param scope 配置作用域
 */
export function getConfig(scope?: ConfigurationScope): CosConfig {
  const config = workspace.getConfiguration('cosbrowser', scope)
  return {
    enabled: config.get<boolean>('enabled', false),
    secretId: config.get<string>('secretId', ''),
    secretKey: config.get<string>('secretKey', ''),
    bucket: config.get<string>('bucket', ''),
    region: config.get<string>('region', 'ap-shanghai'),
    cdnDomain: config.get<string>('cdnDomain', ''),
    defaultPrefix: config.get<string>('defaultPrefix', ''),
    variableName: config.get<string>('variableName', ''),
    cacheTimeout: config.get<number>('cacheTimeout', 300000),
  }
}

/**
 * 检查配置是否有效
 */
export function isConfigValid(config: CosConfig): boolean {
  return !!(config.enabled && config.secretId && config.secretKey && config.bucket && config.region)
}

/**
 * 响应式配置（可选，用于需要响应配置变化的场景）
 */
export function useConfig(scope?: ConfigurationScope) {
  return computed(() => getConfig(scope))
}
