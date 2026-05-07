import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AuthRedirectPage from "../page";

const { replace, useSession } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("next-auth/react", () => ({
  useSession,
}));

describe("auth redirect page", () => {
  beforeEach(() => {
    replace.mockReset();
    useSession.mockReset();
  });

  test("sends admins to the admin home", async () => {
    useSession.mockReturnValue({ data: { user: { role: "ADMIN" } }, status: "authenticated" });

    render(<AuthRedirectPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });

  test("sends non-admin users to the public home", async () => {
    useSession.mockReturnValue({ data: { user: { role: "USER" } }, status: "authenticated" });

    render(<AuthRedirectPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
