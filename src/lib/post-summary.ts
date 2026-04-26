import { getAiModelChatRequestExtras, type AiModelOption } from "@/lib/ai-models";

type OpenAICompatibleChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  error?: string | {
    message?: string;
  };
};

const DEFAULT_POST_SUMMARY_TIMEOUT_MS = 120_000;
const DEFAULT_POST_SUMMARY_MAX_INPUT_CHARS = 12_000;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getPostSummaryTimeoutMs() {
  return readPositiveIntegerEnv("AI_POST_SUMMARY_TIMEOUT_MS", DEFAULT_POST_SUMMARY_TIMEOUT_MS);
}

export function getPostSummaryMaxInputChars() {
  return readPositiveIntegerEnv("AI_POST_SUMMARY_MAX_INPUT_CHARS", DEFAULT_POST_SUMMARY_MAX_INPUT_CHARS);
}

function isTimeoutError(error: unknown) {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as { name?: unknown; message?: unknown })
      : null;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    message.toLowerCase().includes("aborted due to timeout")
  );
}

function excerptContentForSummary(content: string) {
  const normalized = content.trim();
  const maxChars = getPostSummaryMaxInputChars();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}\n\n[文章过长，已截取前 ${maxChars} 字用于生成摘要。]`;
}

export function extractSummary(payload: OpenAICompatibleChatPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

export function normalizeSummary(summary: string) {
  return summary.replace(/^['"“”‘’\s]+|['"“”‘’\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function getUpstreamErrorMessage(response: Response, payload: OpenAICompatibleChatPayload) {
  const upstreamMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;
  const detail = upstreamMessage?.trim();

  if (detail) {
    return detail;
  }

  const statusText = response.statusText ? ` ${response.statusText}` : "";
  return `Summary generation failed (HTTP ${response.status}${statusText})`;
}

export async function generatePostSummary({
  aiModel,
  title,
  content,
}: {
  aiModel: AiModelOption;
  title?: string | null;
  content: string;
}) {
  const excerptedContent = excerptContentForSummary(content);
  const prompt = [
    "请根据下面的文章内容生成一段中文摘要。",
    "要求：",
    "1. 仅输出摘要正文，不要标题、引号、项目符号或 Markdown。",
    "2. 控制在 70 到 120 个中文字符内。",
    "3. 准确概括主题、核心观点与读者价值。",
    title?.trim() ? `文章标题：${title.trim()}` : undefined,
    `文章内容：\n${excerptedContent}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let response: Response;
  try {
    response = await fetch(`${aiModel.baseUrl}${aiModel.requestPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiModel.apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel.model,
        messages: [
          { role: "system", content: "你是一个擅长提炼博客文章摘要的编辑助手。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 220,
        ...getAiModelChatRequestExtras(aiModel),
      }),
      signal: AbortSignal.timeout(getPostSummaryTimeoutMs()),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(`摘要生成超时，请稍后重试，或在 AI 模型管理中切换更快的模型。当前超时 ${Math.round(getPostSummaryTimeoutMs() / 1000)} 秒。`);
    }

    throw error;
  }

  const payload = (await response.json().catch(() => ({}))) as OpenAICompatibleChatPayload;

  if (!response.ok) {
    throw new Error(getUpstreamErrorMessage(response, payload));
  }

  const summary = normalizeSummary(extractSummary(payload));
  if (!summary) {
    throw new Error("AI returned empty summary");
  }

  return summary;
}
