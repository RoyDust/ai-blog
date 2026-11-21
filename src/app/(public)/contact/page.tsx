import type { Metadata } from "next";
import { Mail, Send } from "lucide-react";
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

export default function ContactPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <section className="reader-panel space-y-6 p-5 sm:p-7">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold text-[var(--foreground)] sm:text-3xl">联系我</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-body)]">
            有问题、合作意向或只是想聊聊，填写表单后会打开你的邮件客户端。
          </p>
        </div>

        <ContactForm />
      </section>

      <aside className="reader-panel h-fit space-y-3.5 p-5" aria-label="联系说明">
        <h2 className="reader-section-heading text-sm">适合发来的内容</h2>
        <ul className="space-y-2.5 text-sm leading-6 text-[var(--text-body)]">
          <li className="flex gap-2">
            <Send aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" />
            内容合作、项目交流、技术问题或文章反馈。
          </li>
          <li className="flex gap-2">
            <Mail aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" />
            表单只会唤起本地邮件客户端，不会把内容保存到服务器。
          </li>
        </ul>
      </aside>
    </div>
  );
}
