import { describe, expect, test } from "vitest";
import { generatePostSlug } from "@/lib/slug";

describe("generatePostSlug", () => {
  test("transliterates Chinese titles into pinyin slug", () => {
    expect(generatePostSlug("如何用 Next.js 做一个现代博客", 60)).toBe("ru-he-yong-next-js-zuo-yi-ge-xian-dai-bo-ke");
  });

  test("limits slug length to 60 characters", () => {
    const slug = generatePostSlug("这是一个非常非常长的中文标题用于验证自动生成的拼音 slug 会在限制长度时保持整洁和可读性", 60);

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("zhe-shi-yi-ge-fei-chang-fei-chang-chang-de-zhong-wen-biao-ti");
  });

  test("trims separator edges and falls back for non-word titles", () => {
    expect(generatePostSlug("   React 与 AI：从入门到实践！   ", 60)).toBe("react-yu-ai-cong-ru-men-dao-shi-jian");
    expect(generatePostSlug("！！！", 60)).toBe("post");
  });
});
