import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

test("sidebar and footer use blogt3 card shell", () => {
  const { container } = render(
    <>
      <Sidebar />
      <Footer />
    </>
  );

  expect(container.querySelectorAll(".card-base").length).toBeGreaterThan(0);
});
