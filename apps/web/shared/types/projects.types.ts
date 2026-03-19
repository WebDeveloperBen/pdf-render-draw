import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import type { z } from "zod"
import type { project, projectFile, projectShare, projectShareRecipient } from "../db/schema"
import {
  projectFileWithUploaderSchema,
  projectListItemSchema,
  projectShareRecipientSchema,
  projectShareSchema,
  projectShareWithRelationsSchema,
  projectWithRelationsSchema
} from "../schemas/projects"

// Share types
export type ShareType = "public" | "private"
export type RecipientStatus = "pending" | "viewed" | "expired"

// Database row types
export type ProjectRecord = InferSelectModel<typeof project>
export type ProjectInsert = InferInsertModel<typeof project>

export type ProjectFileRecord = InferSelectModel<typeof projectFile>
export type ProjectFileInsert = InferInsertModel<typeof projectFile>

export type ProjectShareRecord = InferSelectModel<typeof projectShare>
export type ProjectShareInsert = InferInsertModel<typeof projectShare>

export type ProjectShareRecipientRecord = InferSelectModel<typeof projectShareRecipient>
export type ProjectShareRecipientInsert = InferInsertModel<typeof projectShareRecipient>

// API response types inferred from shared schemas
export type ProjectFileWithUploader = z.infer<typeof projectFileWithUploaderSchema>
export type ProjectListItem = z.infer<typeof projectListItemSchema>
export type ProjectShare = z.infer<typeof projectShareSchema>
export type ProjectShareRecipientWithUser = z.infer<typeof projectShareRecipientSchema>
export type ProjectShareWithRelations = z.infer<typeof projectShareWithRelationsSchema>
export type ProjectWithRelations = z.infer<typeof projectWithRelationsSchema>

// Dashboard statistics
export interface DashboardStats {
  totalProjects: number
  personalProjects: number
  teamProjects: number
  totalOrganizations: number
  totalShares: number
  recentActivity: RecentActivity[]
}

export interface RecentActivity {
  id: string
  type: "project_created" | "project_updated" | "share_created" | "project_deleted"
  projectId?: string
  projectName?: string
  organizationId?: string
  organizationName?: string
  createdAt: Date
  userId: string
  userName: string
}

// Filter and query types
export interface ProjectFilters {
  organizationId?: string | null
  search?: string
  sortBy?: "name" | "createdAt" | "updatedAt" | "lastViewedAt"
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
}

export interface CreateProjectInput {
  name: string
  description?: string
  organizationId?: string | null
  pdfUrl: string
  pdfFileName: string
  pdfFileSize: number
  pageCount: number
}

export interface AddProjectFileInput {
  pdfUrl: string
  pdfFileName: string
  pdfFileSize: number
  pageCount: number
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  annotationCount?: number
  lastViewedAt?: Date
}

export interface CreateProjectShareInput {
  projectId: string
  name?: string
  shareType?: ShareType
  message?: string
  recipients?: string[]
  expiresAt?: Date | null
  password?: string | null
  allowDownload?: boolean
  allowNotes?: boolean
}

export interface PDFUploadResult {
  pdfUrl: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  pageCount: number
}
