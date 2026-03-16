import { describe, expect, test } from "vitest"

import type { RouteSession } from "@/lib/api-auth"

type Assert<T extends true> = T
type SessionHasExpectedUserShape = RouteSession extends {
  user: {
    id: string
    role: string
  }
}
  ? true
  : false

const routeSessionTypeContract: Assert<SessionHasExpectedUserShape> = true

describe("api auth type contract", () => {
  test("RouteSession exposes user id and role", () => {
    expect(routeSessionTypeContract).toBe(true)
  })
})
