export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Code2,
  Database,
  Github,
  Mail,
  Monitor,
  NotebookPen,
  Palette,
  Radio,
  Twitter,
  Zap,
} from "lucide-react";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildCanonicalUrl, buildPageMetadata, buildPersonJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicProfile } from "@/lib/public-profile";
import type { PublicProfileLinkKind } from "@/lib/public-profile-data";
import { FallbackImage } from "@/components/ui";

const linkIcons: Record<PublicProfileLinkKind, typeof Github> = {
  email: Mail,
  github: Github,
  link: ArrowUpRight,
  twitter: Twitter,
};

const highlightIcons = [NotebookPen, Palette, Briefcase];
const stackIcons = [Zap, Code2, Database, Monitor];

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

export default async function AboutPage() {
  const [profile, settings] = await Promise.all([getPublicProfile(), getBlogSettings()]);
  const about = settings.about;
  const githubLink = profile.links.find((link) => link.kind === "github");
  const sameAsLinks = profile.links.filter((link) => link.url.startsWith("http")).map((link) => link.url);
  const personJsonLd = buildPersonJsonLd({
    name: profile.name,
    url: buildCanonicalUrl("/about", settings.siteUrl),
    image: profile.avatar,
    description: profile.bio,
    sameAs: sameAsLinks,
  });

  return (
    <div className="reader-section">
      <JsonLd data={personJsonLd} />
      {sameAsLinks.map((url) => (
        <link key={url} rel="me" href={url} />
      ))}
      <section className="reader-panel onload-animation relative overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[136px_minmax(0,1fr)] lg:items-start">
          <div
            className="onload-animation relative h-28 w-28 overflow-hidden rounded-2xl bg-[var(--surface-alt)] md:h-34 md:w-34"
            style={{ animationDelay: "80ms" }}
          >
            {profile.avatar ? (
              <FallbackImage alt={profile.name} className="object-cover" fill priority sizes="136px" src={profile.avatar} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--btn-regular-bg)] text-3xl font-bold text-[var(--btn-content)]">
                {profile.initials}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="onload-animation space-y-2.5" style={{ animationDelay: "140ms" }}>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-90 font-display text-2xl font-bold tracking-tight md:text-3xl">{profile.name}</h1>
                  <span className="h-1 w-5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-[var(--brand)]">{profile.tagline}</p>
              </div>
              <p className="text-90 max-w-3xl text-[15px] leading-7">{profile.bio}</p>
              <p className="text-75 max-w-3xl text-sm leading-7">{profile.intro}</p>
            </div>

            <div className="onload-animation flex flex-wrap gap-2.5" style={{ animationDelay: "200ms" }}>
              {profile.links.map((link) => {
                const Icon = linkIcons[link.kind];
                return (
                  <Link
                    key={link.name}
                    href={link.url}
                    rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    target={link.url.startsWith("http") ? "_blank" : undefined}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--btn-regular-bg)] px-3.5 text-xs font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="onload-animation grid gap-4 lg:grid-cols-[1.15fr_0.85fr]" style={{ animationDelay: "90ms" }}>
        <div className="reader-panel p-5 md:p-6">
          <div className="mb-3.5 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-90 text-lg font-bold">{about.aboutTitle}</h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-[var(--text-body)]">
            {about.aboutParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="reader-panel p-5 md:p-6">
          <div className="mb-3.5 flex items-center gap-2">
            <Radio className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-90 text-lg font-bold">{about.nowTitle}</h2>
          </div>
          <div className="space-y-2.5">
            {about.nowItems.map((item) => (
              <div
                key={item}
                className="rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_55%,transparent)] px-3.5 py-3 text-sm leading-6 text-[var(--text-body)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stagger-children grid gap-3.5 md:grid-cols-3">
        {about.highlights.map((item, index) => {
          const Icon = highlightIcons[index % highlightIcons.length];
          return (
            <article
              key={item.title}
              className="group reader-card p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--btn-card-bg-hover)]"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--btn-regular-bg)] text-[var(--btn-content)] transition-transform duration-300 group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-90 mb-1.5 text-base font-bold transition-colors duration-300 group-hover:text-[var(--brand)]">
                {item.title}
              </h3>
              <p className="text-75 text-sm leading-6">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="reader-panel onload-animation p-5 md:p-6" style={{ animationDelay: "140ms" }}>
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-[var(--brand)]" />
          <h2 className="text-90 text-lg font-bold">{about.stackTitle}</h2>
        </div>
        <div className="stagger-children grid gap-3 md:grid-cols-2">
          {about.stack.map((item, index) => {
            const Icon = stackIcons[index % stackIcons.length];
            return (
              <div
                key={item.title}
                className="group rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,transparent)] p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--btn-regular-bg)]"
              >
                <h3 className="text-90 mb-1.5 flex items-center gap-2 text-sm font-bold transition-colors duration-300 group-hover:text-[var(--brand)]">
                  <Icon className="h-4 w-4 text-[var(--brand)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  {item.title}
                </h3>
                <p className="text-75 text-sm leading-6">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="reader-panel onload-animation flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6"
        style={{ animationDelay: "180ms" }}
      >
        <div className="space-y-1">
          <h2 className="text-90 text-lg font-bold">{about.contactTitle}</h2>
          <p className="text-75 max-w-2xl text-sm leading-6">
            {about.contactDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link className="home-primary-cta" href="/contact">
            <Mail className="h-4 w-4" />联系我
          </Link>
          {githubLink ? (
            <Link
              className="inline-flex h-[2.125rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] bg-[var(--surface-alt)]/75 px-3.5 text-[0.8125rem] font-medium text-[var(--text-body)] transition hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)]"
              href={githubLink.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github className="h-4 w-4" />访问 GitHub
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
