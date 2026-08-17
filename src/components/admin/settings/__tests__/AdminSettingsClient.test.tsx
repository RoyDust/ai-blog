import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("@/components/admin/settings/GitHubBinding", () => ({
  GitHubBinding: () => null,
}));

vi.mock("@/components/admin/ui/image-crop-upload-dialog", () => ({
  ImageCropUploadDialog: () => null,
  calculateSquareCrop: () => ({ x: 0, y: 0, width: 1, height: 1 }),
}));

import { AdminSettingsClient } from "../AdminSettingsClient";

const user = {
  id: "user-1",
  name: "Roy",
  email: "roy@example.com",
  image: null,
  role: "ADMIN",
  githubLinked: false,
};

const blogSettings = {
  siteName: "Inkforge",
  siteDescription: "站点描述",
  siteUrl: "https://example.com",
  locale: "zh-CN",
  appearance: { backgroundImageUrl: "" },
  profile: {
    subtitle: "",
    tagline: "",
    bio: "",
    intro: "",
    githubUrl: "",
    twitterUrl: "",
  },
  about: {
    aboutTitle: "",
    aboutParagraphs: [],
    nowTitle: "",
    nowItems: [],
    highlights: [],
    stackTitle: "",
    stack: [],
    contactTitle: "",
    contactDescription: "",
  },
  reading: { monthlyGoal: 10 },
  newsletter: { enabled: false, provider: "none", fromEmail: "", replyTo: "" },
};

const operationLogSettings = {
  maxStorageBytes: 10485760,
  maxStorageMb: 10,
  currentStorageBytes: 0,
  currentStorageLabel: "0 B",
  rowCount: 0,
};

function renderSettings() {
  return render(
    <AdminSettingsClient
      blogSettings={blogSettings}
      operationLogSettings={operationLogSettings}
      user={user}
    />,
  );
}

describe("AdminSettingsClient", () => {
  test("shows the localized eyebrow text", () => {
    renderSettings();

    expect(screen.getByText("账号")).toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });

  test("uses roving tabindex: only the active tab is reachable by keyboard", () => {
    renderSettings();

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    tabs.slice(1).forEach((tab) => expect(tab).toHaveAttribute("tabindex", "-1"));
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowRight/ArrowLeft move the active tab and move focus with it", () => {
    renderSettings();

    const firstTab = screen.getAllByRole("tab")[0];
    fireEvent.keyDown(firstTab, { key: "ArrowRight" });

    let tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "0");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });

    tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[0]).toHaveFocus();
  });

  test("Home/End jump to the first/last tab and move focus with them", () => {
    renderSettings();

    const tabs = screen.getAllByRole("tab");
    const lastIndex = tabs.length - 1;

    fireEvent.keyDown(tabs[0], { key: "End" });
    let current = screen.getAllByRole("tab");
    expect(current[lastIndex]).toHaveAttribute("aria-selected", "true");
    expect(current[lastIndex]).toHaveFocus();

    fireEvent.keyDown(current[lastIndex], { key: "Home" });
    current = screen.getAllByRole("tab");
    expect(current[0]).toHaveAttribute("aria-selected", "true");
    expect(current[0]).toHaveFocus();
  });

  test("arrow keys wrap around at the edges of the tablist", () => {
    renderSettings();

    const tabs = screen.getAllByRole("tab");
    const lastIndex = tabs.length - 1;

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    let current = screen.getAllByRole("tab");
    expect(current[lastIndex]).toHaveAttribute("aria-selected", "true");
    expect(current[lastIndex]).toHaveFocus();

    fireEvent.keyDown(current[lastIndex], { key: "ArrowRight" });
    current = screen.getAllByRole("tab");
    expect(current[0]).toHaveAttribute("aria-selected", "true");
    expect(current[0]).toHaveFocus();
  });
});
