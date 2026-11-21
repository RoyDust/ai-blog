import type { Metadata } from "next";
import { Masthead, Reveal, SectionHeading } from "@/components/editorial";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildPageMetadata } from "@/lib/seo";
import { ContactForm } from "./ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "联系我",
    description: "有问题、合作意向或想聊聊，欢迎发邮件联系。",
    path: "/contact",
    siteUrl: settings.siteUrl,
  });
}

const contactNotes = ["内容合作、项目交流、技术问题或文章反馈。", "表单只会唤起本地邮件客户端，不会把内容保存到服务器。"];

/**
 * 联系页（原型 12 第 2 张）：报头 eyebrow「联系」+ h1「联系我」+ 一句说明；
 * 表单两列「姓名（可选）/ 邮箱 *」，下面主题、内容和本页唯一主按钮「发送邮件」；
 * 「适合发来的内容」挪到表单下方，改成细线列表（主列放不下右侧 18rem 面板）。
 */
export default function ContactPage() {
  return (
    <div className="space-y-6">
      <Reveal>
        <Masthead eyebrow="联系" title="联系我" description="有问题、合作意向或只是想聊聊，填写表单后会打开你的邮件客户端。" />
      </Reveal>

      <Reveal delay={0.06}>
        <ContactForm />
      </Reveal>

      <Reveal as="aside" aria-label="联系说明" className="pt-3" delay={0.1}>
        <SectionHeading title="适合发来的内容" />
        <ul>
          {contactNotes.map((note) => (
            <li key={note} className="border-b border-[var(--border)] py-3 text-[0.875rem] leading-[1.7] text-[var(--text-body)]">
              {note}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
