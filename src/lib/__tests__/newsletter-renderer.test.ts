import { describe, expect, test } from "vitest";

import { buildNewsletterVerifyUrl, renderNewsletterEmail } from "../newsletter-renderer";

describe("newsletter renderer", () => {
  test("renders public confirmation unsubscribe link in body and RFC 8058 One-Click headers", () => {
    const email = renderNewsletterEmail({
      subject: "本周精选",
      intro: "三篇文章值得读。",
      siteUrl: "https://example.com/",
      unsubscribeToken: "u.token",
      posts: [
        { title: "文章一", slug: "post-one", excerpt: "摘要一" },
        { title: "文章二", slug: "post-two", excerpt: null },
      ],
    });

    expect(email.subject).toBe("本周精选");
    expect(email.html).toContain("https://example.com/posts/post-one");
    expect(email.html).toContain("https://example.com/newsletter/unsubscribe?token=u.token");
    expect(email.html).not.toContain("/api/newsletter/unsubscribe");
    expect(email.text).toContain("文章一");
    expect(email.text).toContain("取消订阅：https://example.com/newsletter/unsubscribe?token=u.token");
    expect(email.unsubscribeUrl).toBe("https://example.com/newsletter/unsubscribe?token=u.token");
    expect(email.oneClickUnsubscribeUrl).toBe("https://example.com/api/newsletter/unsubscribe?token=u.token");
    expect(email.headers).toEqual({
      "List-Unsubscribe": "<https://example.com/api/newsletter/unsubscribe?token=u.token>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  test("builds public verification confirmation URL without trailing slash duplication", () => {
    expect(buildNewsletterVerifyUrl("https://example.com///", "v.token+1")).toBe(
      "https://example.com/newsletter/verify?token=v.token%2B1",
    );
  });

  test("escapes html content while keeping deterministic post links", () => {
    const email = renderNewsletterEmail({
      subject: "<script>subject</script>",
      intro: "Intro & details",
      siteUrl: "https://example.com",
      unsubscribeToken: "u.token",
      posts: [{ title: "A < B", slug: "post-one", excerpt: "Use \"quotes\"" }],
    });

    expect(email.html).toContain("&lt;script&gt;subject&lt;/script&gt;");
    expect(email.html).toContain("A &lt; B");
    expect(email.html).toContain("&quot;quotes&quot;");
    expect(email.html).not.toContain("<script>subject</script>");
  });
});
