import { describe, expect, test } from "vitest";

import { renderNewsletterEmail } from "../newsletter-renderer";

describe("newsletter renderer", () => {
  test("renders subject, html, text, and unsubscribe url", () => {
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
    expect(email.html).toContain("https://example.com/api/newsletter/unsubscribe?token=u.token");
    expect(email.text).toContain("文章一");
    expect(email.unsubscribeUrl).toBe("https://example.com/api/newsletter/unsubscribe?token=u.token");
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
