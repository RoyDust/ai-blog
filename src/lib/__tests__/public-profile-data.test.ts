import { describe, expect, test } from "vitest";
import { mergePublicProfileUser } from "../public-profile-data";

describe("public profile data", () => {
  test("maps the admin profile fields into public author data", () => {
    expect(
      mergePublicProfileUser({
        name: "Inkforge",
        email: "roy@example.com",
        image: "https://example.com/avatar.png",
      }),
    ).toMatchObject({
      name: "Inkforge",
      initials: "I",
      avatar: "https://example.com/avatar.png",
      email: "roy@example.com",
      links: expect.arrayContaining([{ kind: "email", name: "Email", url: "mailto:roy@example.com" }]),
    });
  });

  test("keeps static public copy as fallback when profile fields are empty", () => {
    expect(mergePublicProfileUser({ name: "", email: "", image: "" })).toMatchObject({
      name: "Inkforge Author",
      initials: "IA",
      email: null,
    });
  });

  test("applies configurable public profile copy and links", () => {
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
          email: "roy@example.com",
          image: "https://example.com/avatar.png",
        },
        content,
      ),
    ).toMatchObject({
      subtitle: "后台配置副标题",
      tagline: "后台配置标语",
      bio: "后台配置简介",
      intro: "后台配置介绍",
      links: [
        { kind: "github", name: "GitHub", url: "https://github.com/example" },
        { kind: "email", name: "Email", url: "mailto:roy@example.com" },
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
      subtitle: "后台配置副标题",
      tagline: "后台配置标语",
      bio: "后台配置简介",
      intro: "后台配置介绍",
      links: [],
    });
  });
});
