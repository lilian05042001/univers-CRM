import { describe, expect, it } from "vitest"

import messages from "../../messages/ro.json"
import { isActivePath, navItems } from "@/config/navigation"

describe("navigation", () => {
  it("contains the 12 CRM modules with unique keys and routes", () => {
    expect(navItems).toHaveLength(12)
    expect(new Set(navItems.map((i) => i.key)).size).toBe(12)
    expect(new Set(navItems.map((i) => i.href)).size).toBe(12)
  })

  it("has a Romanian label and description for every module", () => {
    for (const item of navItems) {
      expect(messages.nav[item.key]).toBeTruthy()
      expect(messages.modules[item.key]).toBeTruthy()
    }
  })

  it("marks nested routes as active but not sibling prefixes", () => {
    expect(isActivePath("/leads", "/leads")).toBe(true)
    expect(isActivePath("/leads/123", "/leads")).toBe(true)
    expect(isActivePath("/leads-archive", "/leads")).toBe(false)
  })
})
