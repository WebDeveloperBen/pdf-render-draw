import { describe, expect, it } from "vitest"
import {
  DEFAULT_TEAM_SEAT_COUNT,
  ENTERPRISE_FALLBACK_MEMBER_LIMIT,
  clampSeatCount,
  getDefaultTeamSeatCount,
  getOrganizationMemberLimit
} from "./billing-seats"

describe("billing seat helpers", () => {
  it("clamps invalid seat values to a safe fallback", () => {
    expect(clampSeatCount(undefined)).toBe(DEFAULT_TEAM_SEAT_COUNT)
    expect(clampSeatCount(0)).toBe(1)
    expect(clampSeatCount(4.8)).toBe(4)
  })

  it("derives sensible Team seat defaults from onboarding team size", () => {
    expect(getDefaultTeamSeatCount("solo")).toBe(1)
    expect(getDefaultTeamSeatCount("small")).toBe(3)
    expect(getDefaultTeamSeatCount("medium")).toBe(10)
    expect(getDefaultTeamSeatCount("large")).toBe(25)
    expect(getDefaultTeamSeatCount("enterprise")).toBe(50)
    expect(getDefaultTeamSeatCount("unknown")).toBe(DEFAULT_TEAM_SEAT_COUNT)
  })

  it("maps plan types to organisation member limits", () => {
    expect(getOrganizationMemberLimit("free")).toBe(1)
    expect(getOrganizationMemberLimit("professional")).toBe(1)
    expect(getOrganizationMemberLimit("team", 7)).toBe(7)
    expect(getOrganizationMemberLimit("team", null)).toBe(1)
    expect(getOrganizationMemberLimit("enterprise", null)).toBe(ENTERPRISE_FALLBACK_MEMBER_LIMIT)
    expect(getOrganizationMemberLimit("enterprise", 14)).toBe(14)
  })
})
