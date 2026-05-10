import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "@testing-library/react"
import { expect, test } from "vitest"

import { Select } from "@/components/shadcn/ui/select"

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

test("Select marks body while open so its Radix scroll lock can be scoped", () => {
  const { rerender, unmount } = render(<Select open />)

  expect(document.body).toHaveAttribute("data-radix-select-open", "true")

  rerender(<Select open={false} />)

  expect(document.body).not.toHaveAttribute("data-radix-select-open")

  unmount()
})

test("Select body marker is reference counted across concurrently open selects", () => {
  const first = render(<Select open />)
  const second = render(<Select open />)

  first.unmount()

  expect(document.body).toHaveAttribute("data-radix-select-open", "true")

  second.unmount()

  expect(document.body).not.toHaveAttribute("data-radix-select-open")
})

test("Select scroll-lock CSS neutralizes Radix body margin only for open Selects", () => {
  const source = readSource("src/app/globals.css")

  expect(source).toContain("body[data-radix-select-open][data-scroll-locked]")
  expect(source).toContain("--removed-body-scroll-bar-size: 0px !important")
  expect(source).toContain("margin-right: 0 !important")
  expect(source).not.toContain("body[data-scroll-locked] {\n  margin-right: 0 !important")
})
