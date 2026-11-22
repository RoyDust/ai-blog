import { beforeEach, describe, expect, test, vi } from "vitest";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({ redirect }));

describe("/profile/edit redirect", () => {
  beforeEach(() => {
    redirect.mockReset();
  });

  test("redirects legacy /profile/edit route to /profile instead of /admin", async () => {
    const { default: EditProfilePage } = await import("../edit/page");
    await EditProfilePage();

    expect(redirect).toHaveBeenCalledWith("/profile");
    expect(redirect).not.toHaveBeenCalledWith("/admin");
  });
});
