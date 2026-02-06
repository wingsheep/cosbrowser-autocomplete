import { defineExtension, useCommand, useDisposable } from 'reactive-vscode'
import { languages, window, workspace } from 'vscode'
import { CosCompletionProvider } from './completion-provider'
import { getConfig, isConfigValid } from './config'
import { clearCache } from './cos-client'

const { activate, deactivate } = defineExtension(() => {
  console.log('Cosbrowser 扩展已激活')
  
  // 打印配置信息（仅用于调试）
  const config = getConfig()
  console.log('读取到的配置:', {
    secretId: config.secretId ? '***' : '空',
    secretKey: config.secretKey ? '***' : '空',
    bucket: config.bucket,
    region: config.region,
    valid: isConfigValid(config)
  })

  // 创建补全提供者
  const provider = new CosCompletionProvider()

  // 在多种语言中注册补全提供者
  const supportedLanguages = [
    'html',
    'vue',
    'javascriptreact',
    'typescriptreact',
    'css',
    'scss',
    'less',
  ]

  for (const lang of supportedLanguages) {
    useDisposable(
      languages.registerCompletionItemProvider(
        { language: lang, scheme: 'file' },
        provider,
        '"', // 在输入 " 时触发
        '\'', // 在输入 ' 时触发
        '/', // 在输入 / 时触发（目录导航）
        '(', // 在输入 ( 时触发（url()）
      ),
    )
  }

  // 注册刷新缓存命令
  useCommand('cosbrowser.refreshCache', () => {
    clearCache()
    window.showInformationMessage('Cosbrowser 缓存已刷新')
  })

  // 监听配置变化
  useDisposable(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cosbrowser')) {
        clearCache()
        console.warn('Cosbrowser 配置已更新，缓存已清除')
      }
    }),
  )
})

export { activate, deactivate }
