import { z } from "zod"

export const planLimitsSchema = z.object({
  projects: z.number(),
  storageMb: z.number(),
  fileSizeMb: z.number()
})

export const planFeaturesSchema = z.object({
  exportFormats: z.array(z.string()),
  measurementTools: z.enum(["basic", "all"]),
  cloudSync: z.boolean(),
  collaboration: z.boolean(),
  customBranding: z.boolean(),
  measurementPresets: z.boolean(),
  sla: z.boolean().optional(),
  dedicatedSupport: z.boolean().optional()
})

export const publicPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  interval: z.string(),
  limits: planLimitsSchema,
  features: planFeaturesSchema,
  displayOrder: z.number(),
  trialDays: z.number().nullable(),
  stripePriceId: z.string()
})

export const publicPlansResponseSchema = z.object({
  plans: z.array(publicPlanSchema)
})

export const userSubscriptionSummarySchema = z.object({
  id: z.string(),
  stripeSubscriptionId: z.string().nullable(),
  plan: z.string(),
  status: z.string(),
  periodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean().nullable(),
  trialEnd: z.string().datetime().nullable(),
  seats: z.number().nullable(),
  billingInterval: z.string().nullable()
})

export const billingContextSchema = z.object({
  plan: z.string(),
  limits: planLimitsSchema,
  features: planFeaturesSchema
})
