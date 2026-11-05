import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, SectionHeading, StaggerItem, StaggerList, TextAnchor } from "@/components/editorial";
import { getBlogSettings } from "@/lib/blog-settings";
import { formatIndex } from "@/lib/editorial-format";
import { buildCanonicalUrl, buildPageMetadata, buildPersonJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicProfile } from "@/lib/public-profile";
import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const [profile, settings] = await Promise.all([getPublicProfile(), getBlogSettings()]);

  return buildPageMetadata({
    title: "关于",
    description: profile.bio,
    image: profile.avatar,
    path: "/about",
    siteUrl: settings.siteUrl,
  });
}

function isExternalUrl(url: string) {
  return url.startsWith("http");
}

/**
 * 关于页（原型 12 第 1 张，方向 A）：
 * - 页头：左列 112px 圆形头像，右列 eyebrow「关于」、衬线 h1、tagline、bio、intro 与「GitHub ↗ / Twitter ↗ / Email →」文字链接，2px 粗线收尾；
 * - 「关于我」与「我在做什么」1.15 : 0.85 并排，中间 1px 竖线；「我在做什么」是带等宽序号的细线列表；
 * - 三条亮点是三栏文字（1px 竖线分隔，不加区块标题）；技术栈是两列细线列表；
 * - 末尾「联系我」：一段话 + 描边按钮「联系我」+ 文字链接「访问 GitHub ↗」，本页不设主按钮。
 */
export default async function AboutPage() {
  const [profile, settings] = await Promise.all([getPublicProfile(), getBlogSettings()]);
  const about = settings.about;
  const githubLink = profile.links.find((link) => link.kind === "github");
  const sameAsLinks = profile.links.filter((link) => isExternalUrl(link.url)).map((link) => link.url);
  const personJsonLd = buildPersonJsonLd({
    name: profile.name,
    url: buildCanonicalUrl("/about", settings.siteUrl),
    image: profile.avatar,
    description: profile.bio,
    sameAs: sameAsLinks,
  });

  return (
    <div className="space-y-7" data-testid="about-page">
      <JsonLd data={personJsonLd} />
      {sameAsLinks.map((url) => (
        <link key={url} rel="me" href={url} />
      ))}

      <Reveal>
        <header
          className="grid gap-x-6 gap-y-4 border-b-2 border-[var(--foreground)] pb-5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-start"
          data-about-section="intro"
        >
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--surface-alt)] sm:h-28 sm:w-28">
            {profile.avatar ? (
              <FallbackImage alt={profile.name} className="object-cover" fill priority sizes="112px" src={profile.avatar} />
            ) : (
              <span
                aria-hidden="true"
                className="ed-serif flex h-full w-full items-center justify-center text-[1.75rem] text-[var(--foreground)]"
              >
                {profile.initials}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="ed-eyebrow">关于</p>
            <h1 className="ed-serif text-balance text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] text-[var(--foreground)]">{profile.name}</h1>
            <p className="text-[0.875rem] font-bold text-[var(--text-body)]">{profile.tagline}</p>
            <p className="mt-2 max-w-[42rem] text-pretty text-[1.0625rem] leading-[1.8] text-[var(--foreground)]">{profile.bio}</p>
            <p className="max-w-[42rem] text-pretty text-[0.9375rem] leading-[1.8] text-[var(--text-muted)]">{profile.intro}</p>
            {profile.links.length > 0 ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-5">
                {profile.links.map((link) => {
                  const external = isExternalUrl(link.url);
                  return (
                    <TextAnchor
                      key={link.name}
                      arrow={external ? "external" : "right"}
                      className="min-h-11 items-center"
                      href={link.url}
                      rel={external ? "noopener noreferrer" : undefined}
                      target={external ? "_blank" : undefined}
                    >
                      {link.name}
                    </TextAnchor>
                  );
                })}
              </div>
            ) : null}
          </div>
        </header>
      </Reveal>

      <Reveal
        as="section"
        aria-label="关于我与近况"
        className="grid gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_1px_minmax(0,0.85fr)] lg:gap-x-6"
        data-about-section="story"
      >
        <div className="min-w-0">
          <SectionHeading title={about.aboutTitle} />
          <div className="mt-2 space-y-3.5">
            {about.aboutParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-pretty text-[0.9375rem] leading-[1.85] text-[var(--text-body)]">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <span aria-hidden="true" className="hidden bg-[var(--border)] lg:block" />

        <div className="min-w-0">
          <SectionHeading title={about.nowTitle} />
          <StaggerList as="ol" inView className="mt-1">
            {about.nowItems.map((item, index) => (
              <StaggerItem
                as="li"
                key={item}
                className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-1.5 border-b border-[var(--border)] py-3"
              >
                <span aria-hidden="true" className="ed-mono text-[0.8125rem] leading-[1.6rem] text-[var(--text-muted)]">
                  {formatIndex(index + 1)}
                </span>
                <span className="text-[0.875rem] leading-[1.7] text-[var(--text-body)]">{item}</span>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </Reveal>

      {about.highlights.length > 0 ? (
        <section aria-label="亮点" data-about-section="highlights">
          <StaggerList inView className="grid border-t border-[var(--border)] md:grid-cols-3 md:pt-5">
            {about.highlights.map((item, index) => (
              <StaggerItem
                as="article"
                key={item.title}
                className={cn(
                  "min-w-0 py-4 md:py-0",
                  index > 0 && "border-t border-[var(--border)] md:border-l md:border-t-0",
                  index === 0 ? "md:pr-5" : "md:px-5",
                  index === about.highlights.length - 1 && index > 0 && "md:pr-0",
                )}
              >
                <h3 className="ed-serif mb-1.5 text-[1.0625rem] leading-[1.45] text-[var(--foreground)]">{item.title}</h3>
                <p className="text-[0.875rem] leading-[1.75] text-[var(--text-muted)]">{item.description}</p>
              </StaggerItem>
            ))}
          </StaggerList>
        </section>
      ) : null}

      <Reveal as="section" aria-labelledby="about-stack-title" data-about-section="stack">
        <SectionHeading id="about-stack-title" title={about.stackTitle} count={about.stack.length} />
        <StaggerList inView className="mt-1 grid gap-x-8 sm:grid-cols-2">
          {about.stack.map((item) => (
            <StaggerItem key={item.title} className="border-b border-[var(--border)] py-3.5">
              <h3 className="ed-serif mb-1 text-[1rem] leading-[1.45] text-[var(--foreground)]">{item.title}</h3>
              <p className="text-[0.875rem] leading-[1.7] text-[var(--text-muted)]">{item.description}</p>
            </StaggerItem>
          ))}
        </StaggerList>
      </Reveal>

      <Reveal as="section" aria-labelledby="about-contact-title" data-about-section="contact">
        <SectionHeading id="about-contact-title" title={about.contactTitle} />
        <p className="mt-2 max-w-[36em] text-pretty text-[0.9375rem] leading-[1.8] text-[var(--text-body)]">{about.contactDescription}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link className="ed-btn-outline" href="/contact">
            联系我
          </Link>
          {githubLink ? (
            <TextAnchor arrow="external" className="min-h-11 items-center" href={githubLink.url} rel="noopener noreferrer" target="_blank">
              访问 GitHub
            </TextAnchor>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
