import fs from 'node:fs'
import path from 'node:path'

const ENV_FILES = ['.env.local', '.env'] as const

/**
 * 从单行 env 文本中提取指定键的值，并去掉包裹引号。
 */
export function parseEnvValue(content: string, key: string) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!match) return undefined

  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

/**
 * 按“运行时环境变量 -> 当前目录 -> 向上级目录回溯 env 文件”的顺序解析数据库连接串。
 * 这样工作树目录下即使没有 `.env`，也能复用仓库根目录的配置。
 */
export function findDatabaseUrl(startDir = process.cwd()) {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  let currentDir = path.resolve(startDir)

  while (true) {
    for (const filename of ENV_FILES) {
      const filePath = path.join(currentDir, filename)
      if (!fs.existsSync(filePath)) continue

      const value = parseEnvValue(fs.readFileSync(filePath, 'utf8'), 'DATABASE_URL')
      if (value) return value
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return undefined
    }

    currentDir = parentDir
  }
}
