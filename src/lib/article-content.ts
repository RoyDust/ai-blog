/**
 * 文章正文渲染前的内容清理。
 *
 * 背景：AI 成文与部分手写文章会在 Markdown 开头重复一行与文章标题相同的
 * `# 一级标题`，导致详情页 Hero 与正文各渲染一次标题，目录也会多出一项。
 * 这里在渲染前把这类重复的首标题剥离，数据本身不做修改。
 */

function normalizeHeadingText(value: string) {
  return value
    .replace(/#+\s*$/, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * 若正文的第一个非空行是与标题相同的一级标题（ATX `# xxx` 或 Setext `xxx\n===`），
 * 返回剥离该标题后的正文；否则原样返回。
 */
export function stripLeadingTitleHeading(content: string, title: string) {
  const normalizedTitle = normalizeHeadingText(title)

  if (!normalizedTitle) {
    return content
  }

  const lines = content.split("\n")
  let index = 0

  while (index < lines.length && lines[index].trim() === "") {
    index += 1
  }

  if (index >= lines.length) {
    return content
  }

  const firstLine = lines[index].trim()

  const atxMatch = firstLine.match(/^#\s+(.+)$/)
  if (atxMatch && normalizeHeadingText(atxMatch[1]) === normalizedTitle) {
    return lines.slice(index + 1).join("\n").replace(/^\n+/, "")
  }

  const nextLine = lines[index + 1]?.trim() ?? ""
  if (/^=+$/.test(nextLine) && normalizeHeadingText(firstLine) === normalizedTitle) {
    return lines.slice(index + 2).join("\n").replace(/^\n+/, "")
  }

  return content
}
