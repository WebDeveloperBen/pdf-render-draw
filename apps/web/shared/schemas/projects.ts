import { z } from "zod"

export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable()
})

export const guestUserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable()
})

export const shareCreatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
})

export const organizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable()
})

export const projectFileWithUploaderSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  pdfUrl: z.string(),
  pdfFileName: z.string(),
  pdfFileSize: z.number(),
  pageCount: z.number(),
  annotationCount: z.number(),
  uploadedBy: z.string(),
  lastViewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  uploader: userSummarySchema
})

export const projectShareRecipientSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.string(),
  invitedAt: z.string().datetime(),
  firstViewedAt: z.string().datetime().nullable(),
  lastViewedAt: z.string().datetime().nullable(),
  viewCount: z.number(),
  user: guestUserSummarySchema.nullable().optional()
})

export const projectShareSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  createdBy: z.string(),
  name: z.string().nullable(),
  shareType: z.enum(["public", "private"]),
  message: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  allowDownload: z.boolean(),
  allowNotes: z.boolean(),
  viewCount: z.number(),
  lastViewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const projectShareManagementSchema = projectShareSchema.extend({
  token: z.string(),
  password: z.string().nullable()
})

export const projectShareWithRelationsSchema = projectShareManagementSchema.extend({
  creator: shareCreatorSchema.nullable().optional(),
  recipients: z.array(projectShareRecipientSchema)
})

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  reference: z.string().nullable(),
  category: z.string().nullable(),
  siteAddress: z.string().nullable(),
  suburb: z.string().nullable(),
  postcode: z.string().nullable(),
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  clientPhone: z.string().nullable(),
  priority: z.string(),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  annotationCount: z.number(),
  lastViewedAt: z.string().datetime().nullable(),
  createdBy: z.string(),
  organizationId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const projectListItemSchema = projectSummarySchema.extend({
  creator: userSummarySchema,
  organization: organizationSummarySchema.nullable(),
  shares: z.array(z.object({})),
  _count: z.object({
    shares: z.number(),
    files: z.number()
  })
})

export const projectWithRelationsSchema = projectSummarySchema.extend({
  creator: userSummarySchema,
  organization: organizationSummarySchema.nullable(),
  files: z.array(projectFileWithUploaderSchema),
  shares: z.array(projectShareSchema),
  _count: z.object({
    shares: z.number(),
    files: z.number()
  })
})
