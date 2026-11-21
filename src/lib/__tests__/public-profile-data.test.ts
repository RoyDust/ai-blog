import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mergePublicProfileUser } from "../public-profile-data";

const originalContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

describe("public profile data", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  });

  afterEach(() => {
    if (originalContactEmail === undefined) {
      delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    } else {
      process.env.NEXT_PUBLIC_CONTACT_EMAIL = originalContactEmail;
    }
  });

  test("maps admin name and avatar without exposing User.email when NEXT_PUBLIC_CONTACT_EMAIL is empty", () => {
    const profile = mergePublicProfileUser({
      name: "Inkforge",
      email: "codex-browser-admin-private@local.test",
      image: "https://example.com/avatar.png",
    } as { name?: string | null; image?: string | null });

    expect(profile).toMatchObject({
      name: "Inkforge",
      initials: "I",
      avatar: "https://example.com/avatar.png",
      email: "",
      links: [],
    });
    expect(JSON.stringify(profile)).not.toContain("codex-browser-admin-private@local.test");
  });

  test("uses NEXT_PUBLIC_CONTACT_EMAIL when configured", () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "  hello@roydust.top  ";

    expect(
      mergePublicProfileUser({
        name: "Inkforge",
        image: "https://example.com/avatar.png",
      }),
    ).toMatchObject({
      name: "Inkforge",
      initials: "I",
      avatar: "https://example.com/avatar.png",
      email: "hello@roydust.top",
      links: [{ kind: "email", name: "Email", url: "mailto:hello@roydust.top" }],
    });
  });

  test("prefers explicit settings.profile email over NEXT_PUBLIC_CONTACT_EMAIL when provided", () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "env-contact@roydust.top";

    expect(
      mergePublicProfileUser(
        {
          name: "Inkforge",
          image: "https://example.com/avatar.png",
        },
        {
          subtitle: "后台配置副标题",
          tagline: "后台配置标语",
          bio: "后台配置简介",
          intro: "后台配置介绍",
          githubUrl: "https://github.com/example",
          twitterUrl: "",
          email: "public-settings@roydust.top",
        },
      ),
    ).toMatchObject({
      email: "public-settings@roydust.top",
      links: [
        { kind: "github", name: "GitHub", url: "https://github.com/example" },
        { kind: "email", name: "Email", url: "mailto:public-settings@roydust.top" },
      ],
    });
  });

  test("keeps static public copy as fallback when profile fields are empty", () => {
    expect(mergePublicProfileUser({ name: "", image: "" })).toMatchObject({
      name: "Inkforge Author",
      initials: "IA",
      email: "",
      links: [],
    });
  });

  test("applies configurable public profile copy and links", () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "contact@example.com";
    const content = {
      subtitle: "后台配置副标题",
      tagline: "后台配置标语",
      bio: "后台配置简介",
      intro: "后台配置介绍",
      githubUrl: "https://github.com/example",
      twitterUrl: "",
    };

    expect(
      mergePublicProfileUser(
        {
          name: "Inkforge",
          image: "https://example.com/avatar.png",
        },
        content,
      ),
    ).toMatchObject({
      subtitle: "后台配置副标题",
      tagline: "后台配置标语",
      bio: "后台配置简介",
      intro: "后台配置介绍",
      email: "contact@example.com",
      links: [
        { kind: "github", name: "GitHub", url: "https://github.com/example" },
        { kind: "email", name: "Email", url: "mailto:contact@example.com" },
      ],
    });
  });

  test("uses configurable copy even when no admin user is available", () => {
    expect(
      mergePublicProfileUser(null, {
        subtitle: "后台配置副标题",
        tagline: "后台配置标语",
        bio: "后台配置简介",
        intro: "后台配置介绍",
        githubUrl: "",
        twitterUrl: "",
      }),
    ).toMatchObject({
      name: "Inkforge Author",
      email: "",
      subtitle: "后台配置副标题",
      tagline: "后台配置标语",
      bio: "后台配置简介",
      intro: "后台配置介绍",
      links: [],
    });
  });
});
