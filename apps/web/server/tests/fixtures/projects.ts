import type { InferInsertModel } from "drizzle-orm"
import type { project, projectFile } from "../../../shared/db/schema"
import { SEED_IDS } from "./users"

type ProjectInsert = InferInsertModel<typeof project>
type ProjectFileInsert = InferInsertModel<typeof projectFile>

export function buildProject(overrides: Partial<ProjectInsert> = {}): ProjectInsert {
  return {
    id: SEED_IDS.projects.floorPlan,
    name: "Office Floor Plan",
    description: "Main office building floor plan with measurements",
    reference: null,
    category: null,
    siteAddress: null,
    suburb: null,
    postcode: null,
    clientName: null,
    clientEmail: null,
    clientPhone: null,
    priority: "normal",
    tags: [],
    notes: null,
    annotationCount: 0,
    lastViewedAt: null,
    createdBy: SEED_IDS.users.user,
    organizationId: SEED_IDS.orgs.acme,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function buildProjectFile(overrides: Partial<ProjectFileInsert> = {}): ProjectFileInsert {
  return {
    id: SEED_IDS.files.floorPlanFile,
    projectId: SEED_IDS.projects.floorPlan,
    pdfUrl: "https://example.com/demo/floor-plan.pdf",
    pdfFileName: "floor-plan.pdf",
    pdfFileSize: 2500000,
    pageCount: 3,
    annotationCount: 0,
    uploadedBy: SEED_IDS.users.user,
    lastViewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
