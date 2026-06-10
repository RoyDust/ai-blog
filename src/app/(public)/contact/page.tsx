import type { Metadata } from "next";
import { Mail, MessageSquareText, Send } from "lucide-react";
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
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="reader-panel space-y-8 p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-[var(--foreground)] sm:text-4xl">联系我</h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)]">
            有问题、合作意向或只是想聊聊，填写表单后会打开你的邮件客户端。
          </p>
        </div>

        <ContactForm />
      </section>

      <aside className="reader-panel h-fit space-y-5 p-5" aria-label="联系说明">
        <div className="flex items-center gap-2">
          <MessageSquareText aria-hidden="true" className="h-5 w-5 text-[var(--accent-cyan)]" />
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">适合发来的内容</h2>
        </div>
        <ul className="space-y-3 text-sm leading-6 text-[var(--text-body)]">
          <li className="flex gap-2">
            <Send aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-warm)]" />
            内容合作、项目交流、技术问题或文章反馈。
          </li>
          <li className="flex gap-2">
            <Mail aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-warm)]" />
            表单只会唤起本地邮件客户端，不会把内容保存到服务器。
          </li>
        </ul>
      </aside>
    </div>
  );
}
