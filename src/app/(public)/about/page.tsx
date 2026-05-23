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
    <div className="space-y-6">
      <JsonLd data={personJsonLd} />
      {sameAsLinks.map((url) => (
        <link key={url} rel="me" href={url} />
      ))}
      <section className="card-base onload-animation relative overflow-hidden px-6 py-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-24 w-24 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_8%,transparent)] blur-2xl" />

        <div className="grid gap-8 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
          <div
            className="onload-animation relative h-32 w-32 overflow-hidden rounded-3xl ring-1 ring-black/8 ring-offset-4 ring-offset-[var(--card-bg)] dark:ring-white/10 md:h-40 md:w-40"
            style={{ animationDelay: "80ms" }}
          >
            {profile.avatar ? (
              <FallbackImage alt={profile.name} className="object-cover" fill priority sizes="160px" src={profile.avatar} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-4xl font-bold text-[var(--foreground)]">
                {profile.initials}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="onload-animation space-y-3" style={{ animationDelay: "140ms" }}>
              <p className="text-50 text-xs font-medium uppercase tracking-[0.32em]">About</p>
              <div className="space-y-2">
                <h1 className="text-90 text-4xl font-bold tracking-tight md:text-5xl">{profile.name}</h1>
                <p className="text-[var(--primary)] text-sm font-medium md:text-base">{profile.tagline}</p>
              </div>
              <p className="text-75 max-w-3xl text-base leading-8 md:text-lg">{profile.bio}</p>
              <p className="text-75 max-w-3xl text-sm leading-7 md:text-[15px]">{profile.intro}</p>
            </div>

            <div className="onload-animation flex flex-wrap gap-3" style={{ animationDelay: "200ms" }}>
              {profile.links.map((link) => {
                const Icon = linkIcons[link.kind];
                return (
                  <Link
                    key={link.name}
                    href={link.url}
                    rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    target={link.url.startsWith("http") ? "_blank" : undefined}
                    className="btn-regular scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5"
                  >
                    <Icon className="h-4 w-4" />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="onload-animation grid gap-6 lg:grid-cols-[1.15fr_0.85fr]" style={{ animationDelay: "90ms" }}>
        <div className="card-base p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-90 text-2xl font-bold">{about.aboutTitle}</h2>
          </div>
          <div className="space-y-4 text-[15px] leading-8 text-[var(--muted)]">
            {about.aboutParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="card-base p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2">
            <Radio className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-90 text-2xl font-bold">{about.nowTitle}</h2>
          </div>
          <div className="space-y-3">
            {about.nowItems.map((item) => (
              <div key={item} className="rounded-2xl bg-black/[0.03] px-4 py-4 text-sm leading-7 text-[var(--muted)] dark:bg-white/[0.04]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stagger-children grid gap-4 md:grid-cols-3">
        {about.highlights.map((item, index) => {
          const Icon = highlightIcons[index % highlightIcons.length];
          return (
            <article
              key={item.title}
              className="group card-base p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--btn-card-bg-hover)] hover:shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-90 mb-2 text-lg font-bold transition-colors duration-300 group-hover:text-[var(--primary)]">
                {item.title}
              </h3>
              <p className="text-75 text-sm leading-7">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: "140ms" }}>
        <div className="mb-6 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-90 text-2xl font-bold">{about.stackTitle}</h2>
        </div>
        <div className="stagger-children grid gap-4 md:grid-cols-2">
          {about.stack.map((item, index) => {
            const Icon = stackIcons[index % stackIcons.length];
            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-black/5 bg-black/[0.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--primary)_22%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--primary)_6%,transparent)] dark:border-white/8 dark:bg-white/[0.03]"
              >
                <h3 className="text-90 mb-2 flex items-center gap-2 font-bold transition-colors duration-300 group-hover:text-[var(--primary)]">
                  <Icon className="h-5 w-5 text-[var(--primary)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  {item.title}
                </h3>
                <p className="text-75 text-sm leading-7">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="card-base onload-animation flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8"
        style={{ animationDelay: "180ms" }}
      >
        <div className="space-y-2">
          <h2 className="text-90 text-2xl font-bold">{about.contactTitle}</h2>
          <p className="text-75 max-w-2xl text-sm leading-7">
            {about.contactDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-plain scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5" href="/contact">
            <Mail className="h-4 w-4" />联系我
          </Link>
          {githubLink ? (
            <Link
              className="btn-plain scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5"
              href={githubLink.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github className="h-4 w-4" />访问 GitHub
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
