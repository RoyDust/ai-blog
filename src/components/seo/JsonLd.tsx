type JsonLdData = Record<string, unknown> | Array<Record<string, unknown>>;

/**
 * 统一渲染 JSON-LD 结构化数据。
 *
 * 注入前把 `<` 转义为 `<`，避免标题、摘要、作者名等字段中出现的
 * `</script>` 提前闭合脚本标签（JSON-LD XSS 纵深防御）。转义后的内容仍是
 * 合法 JSON，`JSON.parse` 可正常还原。
 */
export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
