import type { CancellationToken, CompletionItem, CompletionItemProvider, Position, TextDocument } from 'vscode'
import * as vscode from 'vscode'
import type { CosConfig } from './config'
import type { FileItem } from './cos-client'
import { CompletionItemKind, MarkdownString } from 'vscode'
import { getConfig, isConfigValid } from './config'
import { buildCdnUrl, isImageFile, listFolder } from './cos-client'

export class CosCompletionProvider implements CompletionItemProvider {
  private triggerPatterns = [
    /(?:src|:src)=["'][^"']*$/, // src="" 或 :src=""
    /(?:srcset|:srcset)=["'][^"']*$/, // srcset=""
    /url\(["']?[^"')]*$/, // url( 或 url(" 或 url('
    /background(?:-image)?:\s*url\(["']?[^"')]*$/, // background: url(
  ]

  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<CompletionItem[] | undefined> {
    const config = getConfig()
    // console.log('尝试触发补全...', { valid: isConfigValid(config) })
    
    if (!isConfigValid(config)) {
      return undefined
    }

    const lineText = document.lineAt(position).text
    const beforeCursor = lineText.substring(0, position.character)

    const canTrigger = this.shouldTrigger(beforeCursor)
    // console.log(`光标前文本: "${beforeCursor}", 触发匹配: ${canTrigger}`)

    if (!canTrigger) {
      return undefined
    }

    // 解析当前输入的路径前缀
    const inputPrefix = this.extractInputPrefix(beforeCursor)
    const searchPrefix = this.buildSearchPrefix(config, inputPrefix)
    
    console.log(`准备请求 COS, 搜索前缀: "${searchPrefix}"`)

    try {
      const result = await listFolder(config, searchPrefix)
      console.log(`COS 返回: ${result.files.length} 个文件, ${result.folders.length} 个目录`)
      return this.toCompletionItems(config, result, inputPrefix, position, document, beforeCursor)
    }
    catch (error) {
      console.error('COS list folder error:', error)
      return undefined
    }
  }

  private shouldTrigger(text: string): boolean {
    return this.triggerPatterns.some(pattern => pattern.test(text))
  }

  private extractInputPrefix(text: string): string {
    // 找到最后一个引号或括号后的内容
    const match = text.match(/["'(]([^"'()]*)$/)
    return match ? match[1] : ''
  }

  private buildSearchPrefix(config: CosConfig, inputPrefix: string): string {
    // console.log('[Debug] 原始输入:', inputPrefix)
    
    // 如果有 CDN 域名，去掉它
    let prefix = inputPrefix
    if (config.cdnDomain && prefix.startsWith(config.cdnDomain)) {
      prefix = prefix.slice(config.cdnDomain.length)
      // console.log('[Debug] 剥离域名后:', prefix)
    } else {
      // 尝试处理 http/https 不匹配的情况
      // 比如配置是 https，但输入是 http，或者反过来
      const domainNoProtocol = config.cdnDomain.replace(/^https?:\/\//, '')
      const inputNoProtocol = prefix.replace(/^https?:\/\//, '')
      if (config.cdnDomain && inputNoProtocol.startsWith(domainNoProtocol)) {
        prefix = inputNoProtocol.slice(domainNoProtocol.length)
        // console.log('[Debug] 模糊剥离域名后:', prefix)
      }
    }

    // 确保以 defaultPrefix 开头
    // 只有当 prefix 看起来不像绝对路径（不包含 /）时，或者 prefix 是空的，才加 defaultPrefix
    // 或者如果用户明确想要浏览根目录怎么处理？
    if (config.defaultPrefix && !prefix.startsWith(config.defaultPrefix)) {
        // 简单策略：如果 prefix 已经被解析为根路径下的某个目录（比如 'vehicle/'），
        // 且它不在 defaultPrefix 下，那可能用户就是想跳出 defaultPrefix。
        // 但为了简单，暂时保持原逻辑，只加日志
        
        // 如果 prefix 已经是绝对路径（以 / 开头，或者剥离域名后是非空的），我们暂时假设它是相对于 Bucket 根的
        // 除非它真的就是 defaultPrefix 的一部分
        
        // Let's stick to the log first
        prefix = config.defaultPrefix + prefix
    }

    // 如果包含 /，取到最后一个 / 为止
    // 比如 vehicle/img -> vehicle/
    // 比如 vehicle/ -> vehicle/
    const lastSlash = prefix.lastIndexOf('/')
    if (lastSlash >= 0) {
      prefix = prefix.substring(0, lastSlash + 1)
    }
    else {
      prefix = config.defaultPrefix || ''
    }

    // COS 前缀不应以 / 开头
    if (prefix.startsWith('/')) {
      prefix = prefix.replace(/^\/+/, '')
    }
    
    console.log(`[Debug] 最终搜索前缀: "${prefix}", 原始输入: "${inputPrefix}"`)
    return prefix
  }

  private toCompletionItems(
    config: CosConfig,
    result: { files: FileItem[], folders: FileItem[] },
    inputPrefix: string,
    position: Position,
    document: TextDocument,
    beforeCursor: string,
  ): CompletionItem[] {
    const items: CompletionItem[] = []
    
    // 检测是否为 Vue 文件且配置了 variableName
    const isVueFile = document.languageId === 'vue'
    const useVariableMode = isVueFile && !!config.variableName
    
    // 检测是否需要修改 src= 为 :src=
    // 匹配 src="xxx 但不匹配 :src="xxx
    // 需要检查 src= 前面不是 : 或其他单词字符
    const srcMatch = beforeCursor.match(/(?<![:\w])src=["'][^"']*$/)
    const needModifySrc = useVariableMode && srcMatch
    
    // 计算用于文件夹的简单替换范围（只替换最后一个 / 之后的部分）
    // 比如 vehicle/img -> 替换 img
    const lastSlashIndex = inputPrefix.lastIndexOf('/')
    const folderRangeStart = lastSlashIndex >= 0 
      ? position.translate(0, -(inputPrefix.length - lastSlashIndex - 1))
      : position.translate(0, -inputPrefix.length)
    
    const folderRange = new vscode.Range(folderRangeStart, position)

    // 计算用于文件的完整替换范围（替换整个引号内的内容）
    // 比如 vehicle/img -> 替换 http://.../vehicle/img.png
    const fileRange = new vscode.Range(
      position.translate(0, -inputPrefix.length),
      position
    )

    // 文件夹优先
    for (const folder of result.folders) {
      const item: CompletionItem = {
        label: `${folder.name}/`,
        kind: CompletionItemKind.Folder,
        detail: '📁 目录',
        range: folderRange, // 文件夹只替换当前片段
        // 插入后重新触发补全
        command: {
          command: 'editor.action.triggerSuggest',
          title: 'Re-trigger completions',
        },
        // 文件夹只插入目录名
        insertText: `${folder.name}/`,
      }
      items.push(item)
    }

    // 文件
    for (const file of result.files) {
      const isImage = isImageFile(file.name)
      const cdnUrl = buildCdnUrl(config, file.key)
      
      // 计算相对路径（移除 defaultPrefix）
      let relativePath = file.key
      if (config.defaultPrefix && relativePath.startsWith(config.defaultPrefix)) {
        relativePath = relativePath.slice(config.defaultPrefix.length)
        // 移除开头的 /
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.slice(1)
        }
      }
      
      // 根据模式决定插入内容
      let insertText: string
      if (useVariableMode) {
        // Vue 变量模式: `${variableName}/path/to/file.png`
        insertText = `\`\${${config.variableName}}/${relativePath}\``
      }
      else {
        // 普通模式: 完整 CDN URL
        insertText = cdnUrl
      }
      
      const item: CompletionItem = {
        label: file.name,
        kind: isImage ? CompletionItemKind.Color : CompletionItemKind.File,
        detail: isImage
          ? `🖼️ 图片${file.size ? ` (${this.formatSize(file.size)})` : ''}`
          : `📄 文件${file.size ? ` (${this.formatSize(file.size)})` : ''}`,
        range: fileRange, // 文件替换整个路径
        // 设置过滤文本，确保能匹配上前缀
        // 否则 VS Code 认为 "path/to/" 不匹配 "filename" 从而隐藏
        filterText: inputPrefix + file.name,
        insertText,
      }
      
      // 如果需要修改 src= 为 :src=，添加额外编辑
      if (needModifySrc) {
        // 找到 src= 的位置并添加 : 前缀
        const srcIndex = beforeCursor.lastIndexOf('src=')
        if (srcIndex >= 0) {
          const srcPosition = position.translate(0, -(beforeCursor.length - srcIndex))
          item.additionalTextEdits = [
            vscode.TextEdit.insert(srcPosition, ':'),
          ]
        }
      }

      // 图片预览：存储 URL 供 resolveCompletionItem 使用
      if (isImage) {
        // 使用 data 字段存储需要解析的信息
        ;(item as any)._imageUrl = cdnUrl
      }

      items.push(item)
    }

    return items
  }

  /**
   * 延迟解析补全项，用于加载图片预览
   */
  async resolveCompletionItem(
    item: CompletionItem,
    _token: vscode.CancellationToken,
  ): Promise<CompletionItem> {
    const imageUrl = (item as any)._imageUrl
    if (!imageUrl) {
      return item
    }

    try {
      // 使用腾讯云 COS 图片处理 API 获取缩略图
      // thumbnail/200x - 宽度 200px，高度按比例
      // quality/50 - 质量 50%
      const thumbnailUrl = this.buildThumbnailUrl(imageUrl)
      
      // 获取缩略图并转为 base64
      const base64 = await this.fetchImageAsBase64(thumbnailUrl)
      if (base64) {
        const md = new MarkdownString()
        md.appendMarkdown(`**图片预览**\n\n`)
        md.appendMarkdown(`![preview](${base64})`)
        md.isTrusted = true
        md.supportHtml = true
        item.documentation = md
      }
      else {
        // 降级显示 URL
        item.documentation = new MarkdownString(`📷 ${imageUrl}`)
      }
    }
    catch (error) {
      console.error('加载图片预览失败:', error)
      // 降级显示 URL
      item.documentation = new MarkdownString(`📷 ${imageUrl}`)
    }

    return item
  }

  /**
   * 构建腾讯云 COS 缩略图 URL
   * 使用数据万象图片处理 API
   */
  private buildThumbnailUrl(url: string): string {
    // 添加 COS 图片处理参数
    // imageMogr2/thumbnail/200x - 宽度 200px
    // /quality/50 - 质量 50%
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}imageMogr2/thumbnail/200x/quality/50`
  }

  /**
   * 获取图片并转为 base64 data URI
   * 限制最大 100KB 以避免性能问题
   */
  private async fetchImageAsBase64(url: string): Promise<string | null> {
    const MAX_SIZE = 100 * 1024 // 100KB
    
    try {
      const https = await import('https')
      const http = await import('http')
      const client = url.startsWith('https') ? https : http

      return new Promise((resolve, reject) => {
        const req = client.get(url, { timeout: 5000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }

          // 检查 Content-Length
          const contentLength = Number.parseInt(res.headers['content-length'] || '0', 10)
          if (contentLength > MAX_SIZE) {
            console.log(`[COS CDN] 图片太大 (${contentLength} bytes)，跳过预览: ${url}`)
            resolve(null)
            req.destroy()
            return
          }

          const chunks: Buffer[] = []
          let totalSize = 0
          
          res.on('data', (chunk: Buffer) => {
            totalSize += chunk.length
            if (totalSize > MAX_SIZE) {
              console.log(`[COS CDN] 图片太大 (>${MAX_SIZE} bytes)，跳过预览: ${url}`)
              resolve(url)
              req.destroy()
              return
            }
            chunks.push(chunk)
          })
          
          res.on('end', () => {
            const buffer = Buffer.concat(chunks)
            const contentType = res.headers['content-type'] || 'image/png'
            const base64 = `data:${contentType};base64,${buffer.toString('base64')}`
            console.log(`[COS CDN] 图片预览加载成功 (${buffer.length} bytes): ${url}`)
            resolve(base64)
          })
          res.on('error', reject)
        })

        req.on('error', reject)
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Timeout'))
        })
      })
    }
    catch (error) {
      console.error('fetchImageAsBase64 error:', error)
      return null
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`
    }
    else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`
    }
    else {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }
  }
}
