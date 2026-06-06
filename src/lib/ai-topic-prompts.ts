export type TopicPromptCandidate = {
  title: string
  url: string
  summary?: string | null
}

export function buildTopicAnglePrompt({
  topicTitle,
  candidates,
}: {
  topicTitle: string
  candidates: TopicPromptCandidate[]
}) {
  return [
    "你是技术博客选题编辑。请只基于候选来源，为该主题生成可写作角度。",
    `主题：${topicTitle}`,
    `候选来源：${JSON.stringify(candidates)}`,
    "输出 JSON：summary, angle, outline, riskFlags。",
    "不要编造候选来源之外的事实。",
  ].join("\n\n")
}
