import { z } from "zod"
import { billingContextSchema, userSubscriptionSummarySchema } from "./billing"

export const userProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean().nullable(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: z.string().datetime().nullable(),
  isGuest: z.boolean(),
  guestOrganizationId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  activeOrganizationId: z.string().nullable(),
  subscription: userSubscriptionSummarySchema.nullable(),
  billing: billingContextSchema
})
