import type { CosConfig } from './config'
import COS from 'cos-nodejs-sdk-v5'
import { Cache } from './cache'

export interface FileItem {
  key: string
  name: string
  isFolder: boolean
  size?: number
  lastModified?: string
}

export interface ListResult {
  files: FileItem[]
  folders: FileItem[]
}

let cosInstance: COS | null = null
let currentConfig: CosConfig | null = null
const listCache = new Cache<ListResult>()

function getCosClient(config: CosConfig): COS {
  // 配置变化时重新创建实例
  if (
    !cosInstance
    || !currentConfig
    || currentConfig.secretId !== config.secretId
    || currentConfig.secretKey !== config.secretKey
  ) {
    cosInstance = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    })
    currentConfig = config
    listCache.clear()
  }
  listCache.setTimeout(config.cacheTimeout)
  return cosInstance
}

export async function listFolder(config: CosConfig, prefix: string = ''): Promise<ListResult> {
  const cacheKey = `${config.bucket}:${prefix}`
  const cached = listCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const cos = getCosClient(config)

  return new Promise((resolve, reject) => {
    const files: FileItem[] = []
    const folders: FileItem[] = []

    const listAll = async (marker?: string) => {
      try {
        const data = await cos.getBucket({
          Bucket: config.bucket,
          Region: config.region,
          Delimiter: '/',
          Prefix: prefix,
          Marker: marker,
          MaxKeys: 1000,
        })

        // 处理子目录
        if (data.CommonPrefixes) {
          for (const item of data.CommonPrefixes) {
            const name = getNameFromPrefix(item.Prefix, prefix)
            if (name) {
              folders.push({
                key: item.Prefix,
                name,
                isFolder: true,
              })
            }
          }
        }

        // 处理文件
        if (data.Contents) {
          for (const item of data.Contents) {
            // 排除目录本身
            if (item.Key !== prefix && Number(item.Size) > 0) {
              const name = getNameFromKey(item.Key)
              files.push({
                key: item.Key,
                name,
                isFolder: false,
                size: Number(item.Size),
                lastModified: item.LastModified,
              })
            }
          }
        }

        // 继续分页
        if (data.IsTruncated === 'true' && data.NextMarker) {
          await listAll(data.NextMarker)
        }
      }
      catch (err) {
        reject(err)
      }
    }

    listAll()
      .then(() => {
        const result = { files, folders }
        listCache.set(cacheKey, result)
        resolve(result)
      })
      .catch(reject)
  })
}

function getNameFromPrefix(prefixPath: string, parentPrefix: string): string {
  // 从 "parent/child/" 提取 "child"
  const relative = prefixPath.slice(parentPrefix.length)
  return relative.replace(/\/$/, '')
}

function getNameFromKey(key: string): string {
  const parts = key.split('/')
  return parts[parts.length - 1]
}

export function buildCdnUrl(config: CosConfig, key: string): string {
  if (config.cdnDomain) {
    const domain = config.cdnDomain.replace(/\/$/, '')
    return `${domain}/${key}`
  }
  // 默认 COS 域名
  return `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`
}

export function clearCache(): void {
  listCache.clear()
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return imageExtensions.includes(ext)
}
