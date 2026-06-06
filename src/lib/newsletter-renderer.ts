type NewsletterPost = {
  title: string;
  slug: string;
  excerpt?: string | null;
};

type RenderNewsletterEmailInput = {
  subject: string;
  intro?: string | null;
  posts: NewsletterPost[];
  siteUrl: string;
  unsubscribeToken: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, "");
}

export function renderNewsletterEmail({
  subject,
  intro,
  posts,
  siteUrl,
  unsubscribeToken,
}: RenderNewsletterEmailInput) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const unsubscribeUrl = `${normalizedSiteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const items = posts
    .map((post) => {
      const url = `${normalizedSiteUrl}/posts/${encodeURIComponent(post.slug)}`;
      const excerpt = post.excerpt?.trim();

      return [
        '<li style="margin:0 0 18px">',
        `<a href="${url}" style="color:#0f766e;font-weight:700;text-decoration:none">${escapeHtml(post.title)}</a>`,
        excerpt ? `<p style="margin:6px 0 0;color:#475569;line-height:1.6">${escapeHtml(excerpt)}</p>` : "",
        "</li>",
      ].join("");
    })
    .join("");

  const html = [
    '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;line-height:1.6">',
    `<h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(subject)}</h1>`,
    intro?.trim() ? `<p style="margin:0 0 20px;color:#334155">${escapeHtml(intro.trim())}</p>` : "",
    `<ul style="margin:0 0 24px;padding-left:20px">${items}</ul>`,
    `<p style="margin:24px 0 0;color:#64748b;font-size:13px"><a href="${unsubscribeUrl}" style="color:#64748b">取消订阅</a></p>`,
    "</div>",
  ].join("");

  const text = [
    subject,
    intro?.trim() || "",
    ...posts.map((post) => `${post.title} - ${normalizedSiteUrl}/posts/${post.slug}`),
    `取消订阅：${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text, unsubscribeUrl };
}
