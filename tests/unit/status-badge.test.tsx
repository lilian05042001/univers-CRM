import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "@/components/shared/status-badge"

describe("StatusBadge", () => {
  it("applies the tone color classes", () => {
    render(<StatusBadge tone="danger">Întârziată</StatusBadge>)
    const badge = screen.getByText("Întârziată")
    expect(badge.className).toContain("text-destructive")
  })
})
