import crypto from "node:crypto"

type ProjectShareLike = {
  id: string
  projectId: string
  createdBy: string
  name: string | null
  shareType: string
  message: string | null
  expiresAt: Date | null
  allowDownload: boolean
  allowNotes: boolean
  viewCount: number
  lastViewedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function hashSharePassword(password: string | null | undefined): string | null | undefined {
  if (password === undefined || password === null) return password
  return crypto.createHash("sha256").update(password).digest("hex")
}

export function sanitiseProjectSharesForProjectResponse<T extends ProjectShareLike>(shares: T[]) {
  return shares.map((share) => ({
    id: share.id,
    projectId: share.projectId,
    createdBy: share.createdBy,
    name: share.name,
    shareType: share.shareType,
    message: share.message,
    expiresAt: share.expiresAt,
    allowDownload: share.allowDownload,
    allowNotes: share.allowNotes,
    viewCount: share.viewCount,
    lastViewedAt: share.lastViewedAt,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt
  }))
}
