export const DEFAULT_TEAM_SEAT_COUNT = 3
export const MIN_TEAM_SEAT_COUNT = 1
export const DEFAULT_ORGANIZATION_MEMBER_LIMIT = 1
export const ENTERPRISE_FALLBACK_MEMBER_LIMIT = 9999

export function clampSeatCount(value: number | null | undefined, fallback = DEFAULT_TEAM_SEAT_COUNT) {
  const parsed = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(MIN_TEAM_SEAT_COUNT, Math.floor(parsed))
}

export function getDefaultTeamSeatCount(teamSize?: string | null) {
  switch (teamSize) {
    case "solo":
      return 1
    case "small":
      return 3
    case "medium":
      return 10
    case "large":
      return 25
    case "enterprise":
      return 50
    default:
      return DEFAULT_TEAM_SEAT_COUNT
  }
}

export function getOrganizationMemberLimit(planName?: string | null, seatCount?: number | null) {
  const normalisedPlan = planName?.trim().toLowerCase() ?? "free"

  if (normalisedPlan === "team") {
    return clampSeatCount(seatCount, DEFAULT_ORGANIZATION_MEMBER_LIMIT)
  }

  if (normalisedPlan === "enterprise") {
    if (seatCount && seatCount > 0) {
      return clampSeatCount(seatCount, DEFAULT_ORGANIZATION_MEMBER_LIMIT)
    }

    return ENTERPRISE_FALLBACK_MEMBER_LIMIT
  }

  return DEFAULT_ORGANIZATION_MEMBER_LIMIT
}
