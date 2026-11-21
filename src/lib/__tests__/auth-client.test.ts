import { afterEach, describe, expect, test, vi } from "vitest";
import { clearAdminSessionStorage, clearAllSessionData } from "../auth-client";

describe("auth-client storage resilience", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  test("clearAdminSessionStorage removes admin/draft keys while preserving reader preferences", () => {
    window.localStorage.setItem("vben_admin_collapsed", "true");
    window.localStorage.setItem("vben_admin_tabs", "[]");
    window.localStorage.setItem("author:draft:new", "{}");
    window.localStorage.setItem("author:draft:edit:123", "{}");
    window.localStorage.setItem("reader_theme", "dark");

    clearAdminSessionStorage();

    expect(window.localStorage.getItem("vben_admin_collapsed")).toBeNull();
    expect(window.localStorage.getItem("vben_admin_tabs")).toBeNull();
    expect(window.localStorage.getItem("author:draft:new")).toBeNull();
    expect(window.localStorage.getItem("author:draft:edit:123")).toBeNull();
    expect(window.localStorage.getItem("reader_theme")).toBe("dark");
  });

  test("clearAllSessionData never throws when localStorage getter or removeItem throws SecurityError", () => {
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    expect(() => clearAdminSessionStorage()).not.toThrow();
    expect(() => clearAllSessionData()).not.toThrow();

    removeSpy.mockRestore();
  });
});
