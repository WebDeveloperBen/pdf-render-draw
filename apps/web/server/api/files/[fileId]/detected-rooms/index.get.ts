import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const querySchema = z.object({
  pageNum: z.coerce.number().int().min(1).optional(),
  includeHidden: z
    .string()
    .optional()
    .transform((v) => v === "true")
})

export default defineEventHandler(async (event) => {
  const { orgId } = await requireActiveOrg(event)

  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { pageNum, includeHidden } = await getValidatedQuery(event, querySchema.parse)

  const db = useDrizzle()

  const [file] = await db
    .select({
      id: projectFile.id
    })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, orgId)))

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found or access denied"
    })
  }

  const conditions = [eq(detectedRoom.fileId, fileId)]
  if (!includeHidden) {
    conditions.push(eq(detectedRoom.visible, true))
  }
  if (typeof pageNum === "number") {
    conditions.push(eq(detectedRoom.pageNum, pageNum))
  }

  const rows = await db
    .select({
      id: detectedRoom.id,
      pageNum: detectedRoom.pageNum,
      polygon: detectedRoom.polygon,
      bounds: detectedRoom.bounds,
      area: detectedRoom.area,
      centroidX: detectedRoom.centroidX,
      centroidY: detectedRoom.centroidY,
      roomLabel: detectedRoom.roomLabel,
      confidence: detectedRoom.confidence,
      source: detectedRoom.source,
      visible: detectedRoom.visible,
      updatedAt: detectedRoom.updatedAt
    })
    .from(detectedRoom)
    .where(and(...conditions))
    .orderBy(asc(detectedRoom.pageNum), asc(detectedRoom.createdAt))

  return {
    rooms: rows.map((row) => ({
      id: row.id,
      pageNum: row.pageNum,
      polygon: row.polygon,
      bounds: row.bounds,
      area: row.area,
      centroid: { x: row.centroidX, y: row.centroidY },
      label: row.roomLabel,
      confidence: row.confidence,
      source: row.source,
      visible: row.visible,
      updatedAt: row.updatedAt
    }))
  }
})
