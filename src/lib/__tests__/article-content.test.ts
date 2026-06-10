import { describe, expect, test } from "vitest"
import { stripLeadingTitleHeading } from "../article-content"

describe("stripLeadingTitleHeading", () => {
  test("剥离与标题相同的开头 ATX 一级标题", () => {
    const content = "# 页面性能优化：先找到真正的瓶颈\n\n正文第一段。"
    expect(stripLeadingTitleHeading(content, "页面性能优化：先找到真正的瓶颈")).toBe("正文第一段。")
  })

  test("忽略空白与大小写差异", () => {
    const content = "\n\n#   Hello World  \n\n正文。"
    expect(stripLeadingTitleHeading(content, "hello world")).toBe("正文。")
  })

  test("剥离 Setext 风格的重复标题", () => {
    const content = "页面性能优化\n====\n\n正文。"
    expect(stripLeadingTitleHeading(content, "页面性能优化")).toBe("正文。")
  })

  test("标题不同时保持原样", () => {
    const content = "# 另一个标题\n\n正文。"
    expect(stripLeadingTitleHeading(content, "页面性能优化")).toBe(content)
  })

  test("首行不是一级标题时保持原样", () => {
    const content = "## 二级标题开头\n\n正文。"
    expect(stripLeadingTitleHeading(content, "二级标题开头")).toBe(content)
    const paragraph = "页面性能优化\n\n正文。"
    expect(stripLeadingTitleHeading(paragraph, "页面性能优化")).toBe(paragraph)
  })

  test("空内容与空标题安全返回", () => {
    expect(stripLeadingTitleHeading("", "标题")).toBe("")
    expect(stripLeadingTitleHeading("# 标题", "")).toBe("# 标题")
  })
})
