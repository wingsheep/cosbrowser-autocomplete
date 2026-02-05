// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      'dist',
      'node_modules',
      'src/generated',
    ],
  },
  {
    rules: {
      // 可根据需要添加自定义规则
    },
  },
)
