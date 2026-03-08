import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import type { project, projectFile, projectShare, projectShareRecipient } from "../db/schema"

// Share types
export type ShareType = "public" | "private"
export type RecipientStatus = "pending" | "viewed" | "expired"

// Base types inferred from Drizzle schema
export type Project = InferSelectModel<typeof project>
export type ProjectInsert = InferInsertModel<typeof project>

export type ProjectFile = InferSelectModel<typeof projectFile>
export type ProjectFileInsert = InferInsertModel<typeof projectFile>

export type ProjectShare = InferSelectModel<typeof projectShare>
export type ProjectShareInsert = InferInsertModel<typeof projectShare>

export type ProjectShareRecipient = InferSelectModel<typeof projectShareRecipient>
export type ProjectShareRecipientInsert = InferInsertModel<typeof projectShareRecipient>

// Project file with uploader info
export interface ProjectFileWithUploader extends ProjectFile {
  uploader: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

// Extended types with relations
export interface ProjectWithRelations extends Project {
  creator: {
    id: string
    name: string
    email: string
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
    logo: string | null
  } | null
  shares: ProjectShare[]
  files: ProjectFile[]
  _count?: {
    shares: number
    files: number
  }
}

export interface ProjectShareRecipientWithUser extends ProjectShareRecipient {
  user?: {
    id: string
    name: string
    image: string | null
  }
}

export interface ProjectShareWithRelations extends ProjectShare {
  project: Project
  creator: {
    id: string
    name: string
    email: string
  }
  recipients?: ProjectShareRecipientWithUser[]
}

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
  // Initial file data (first file in project)
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
