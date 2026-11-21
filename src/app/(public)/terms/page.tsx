export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { Masthead, Reveal, SectionHeading, TextLink } from "@/components/editorial";
import { getBlogSettings } from "@/lib/blog-settings";
import { formatIndex } from "@/lib/editorial-format";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "服务条款",
    description: `阅读 ${settings.siteName} 的账号注册、读者互动、内容版权与站点服务约定。`,
    path: "/terms",
    siteUrl: settings.siteUrl,
  });
}

function buildTermsSections(siteName: string) {
  return [
    {
      id: "terms-account",
      title: "服务范围与账号注册",
      items: [
        `${siteName} 提供技术文章阅读、系列与专题导读浏览、文章评论、本地书签收藏及可选的邮件订阅服务。`,
        "注册本地账号时，请提供真实可用的邮箱地址并妥善保管密码；你也可以通过已验证邮箱的 GitHub 账号授权登录。账号仅限本人使用，请勿冒用他人身份或共享凭据。",
      ],
    },
    {
      id: "terms-community",
      title: "评论与互动规范",
      items: [
        "发表评论或参与站内互动时，请围绕文章主题理性交流，不得发布违反法律法规、垃圾推广、恶意刷屏、钓鱼链接，或侵犯他人知识产权与人身权益的内容。",
        "为维护阅读环境，站点管理员有权对新提交或被举报的评论进行审核、隐藏或移除；对持续滥用接口的请求，系统将自动执行速率限制。",
      ],
    },
    {
      id: "terms-copyright",
      title: "内容版权与合理引用",
      items: [
        `除另有署名或特别声明外，${siteName} 发布的原创文章、系列编排与专题导读均受著作权保护。`,
        "欢迎在保留作者署名与原文链接的前提下进行个人学习、摘要引述或非商业性分享；未经书面许可，不得对整站内容进行镜像抓取或商业化转载。",
      ],
    },
    {
      id: "terms-availability",
      title: "服务变更与免责声明",
      items: [
        "站内技术文章与代码示例旨在分享实践经验，按“现状”提供参考，不对特定生产环境下的适用性作明示或暗示担保。",
        `${siteName} 可能根据演进需要调整栏目结构、接口限额或本服务条款；条款更新后将在本页发布并即时生效。`,
      ],
    },
  ];
}

export default async function TermsPage() {
  const settings = await getBlogSettings();
  const sections = buildTermsSections(settings.siteName);

  return (
    <div className="space-y-7" data-testid="terms-page">
      <Reveal>
        <Masthead
          aside={<TextLink href="/privacy">隐私政策</TextLink>}
          description={`欢迎访问 ${settings.siteName}。注册账号或使用本站阅读、评论与订阅功能即表示你理解并同意以下约定。`}
          eyebrow="协议"
          meta={`适用站点：${settings.siteName}`}
          title="服务条款"
        />
      </Reveal>

      {sections.map((section, sectionIndex) => (
        <Reveal key={section.id} as="section" aria-labelledby={section.id} delay={0.04 * (sectionIndex + 1)}>
          <SectionHeading count={formatIndex(sectionIndex + 1)} id={section.id} title={section.title} />
          <div className="mt-2 space-y-3 border-b border-[var(--border)] pb-5">
            {section.items.map((paragraph) => (
              <p
                key={paragraph}
                className="max-w-[44rem] text-pretty text-[0.9375rem] leading-[1.85] text-[var(--text-body)]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      ))}

      <Reveal aria-label="相关页面" as="aside" className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1" delay={0.2}>
        <TextLink href="/register">返回账号注册</TextLink>
        <TextLink href="/privacy">阅读隐私政策</TextLink>
        <TextLink href="/contact">联系站点维护者</TextLink>
      </Reveal>
    </div>
  );
}
