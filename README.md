# COSBrowser Autocomplete

在编写 `src`、`url()` 等属性时，智能补全腾讯云 COS 存储桶中的文件路径，支持 CDN 域名替换和图片预览。

## 功能特性

- 🚀 支持多种文件类型（HTML、Vue、JSX、TSX、CSS、SCSS、Less）
- 📁 目录浏览和自动补全
- 🖼️ 图片缩略图预览（利用腾讯云数据万象）
- ⚡ 智能缓存

## 快速开始

### 1. 全局配置 COS 凭证

在 VS Code 设置（`Cmd + ,`）中配置：

```json
{
  "cosbrowser.secretId": "你的SecretId",
  "cosbrowser.secretKey": "你的SecretKey",
  "cosbrowser.bucket": "你的存储桶名称",
  "cosbrowser.region": "ap-shanghai",
  "cosbrowser.cdnDomain": "https://你的CDN域名"
}
```

> ⚠️ 扩展默认禁用，需要在项目中单独启用

### 2. 在项目中启用

在项目根目录创建 `.vscode/settings.json`：

```json
{
  "cosbrowser.enabled": true,
  "cosbrowser.defaultPrefix": "vehicle/wechat/",
  "cosbrowser.variableName": "filePath"
}
```

## 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `cosbrowser.enabled` | 是否启用扩展 | `false` |
| `cosbrowser.secretId` | 腾讯云 COS SecretId | - |
| `cosbrowser.secretKey` | 腾讯云 COS SecretKey | - |
| `cosbrowser.bucket` | 存储桶名称 | - |
| `cosbrowser.region` | 地域 | `ap-shanghai` |
| `cosbrowser.cdnDomain` | CDN 域名 | - |
| `cosbrowser.defaultPrefix` | 默认目录前缀 | - |
| `cosbrowser.variableName` | Vue 文件中使用的变量名 | - |
| `cosbrowser.cacheTimeout` | 缓存过期时间（毫秒） | `300000` |

## 使用方式

在支持的文件中输入以下内容时会自动触发补全：

- `src="` 或 `:src="`
- `srcset="`
- `url(` 或 `url("`
- `background: url(` 或 `background-image: url(`

### Vue 变量模式

当配置了 `variableName` 后，在 Vue 文件中选择补全项时：

- **自动转换** `src="` 为 `:src="`
- **自动生成** 模板语法 `` `${variableName}/path/to/file.png` ``

**示例**：

```vue
<!-- 输入 src=" 并选择 job/driver.png -->
<!-- 自动插入结果: -->
<img :src="`${filePath}/job/driver.png`">
```

## 命令

按 `Cmd + Shift + P` 打开命令面板，输入命令名称执行：

| 命令 | 说明 |
|------|------|
| `COSBrowser: 刷新缓存` | 清除本地文件列表缓存，重新从 COS 获取最新文件。当存储桶中有新增/删除文件时使用。 |

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## License

MIT
