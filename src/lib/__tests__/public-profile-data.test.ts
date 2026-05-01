import { describe, expect, test } from "vitest";
import { mergePublicProfileUser } from "../public-profile-data";

describe("public profile data", () => {
  test("maps the admin profile fields into public author data", () => {
    expect(
      mergePublicProfileUser({
        name: "RoyDust",
        email: "roy@example.com",
        image: "https://example.com/avatar.png",
      }),
    ).toMatchObject({
      name: "RoyDust",
      initials: "RD",
      avatar: "https://example.com/avatar.png",
      email: "roy@example.com",
      links: expect.arrayContaining([{ kind: "email", name: "Email", url: "mailto:roy@example.com" }]),
    });
  });

  test("keeps static public copy as fallback when profile fields are empty", () => {
    expect(mergePublicProfileUser({ name: "", email: "", image: "" })).toMatchObject({
      name: "Zhang Wei",
      initials: "ZW",
      email: null,
    });
  });
});
