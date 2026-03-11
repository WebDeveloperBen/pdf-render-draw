import { randomUUID } from "crypto"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})

const boundsSchema = z.object({
  minX: z.number().finite(),
  minY: z.number().finite(),
  maxX: z.number().finite(),
  maxY: z.number().finite()
})

const roomSchema = z.object({
  polygon: z.array(pointSchema).min(3),
  area: z.number().positive(),
  centroid: pointSchema,
  bounds: boundsSchema,
  label: z.string().trim().min(1).max(120).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  source: z.string().trim().min(1).max(80).optional()
})

const bodySchema = z.object({
  pageNum: z.number().int().min(1),
  replaceExisting: z.boolean().default(true),
  rooms: z.array(roomSchema).min(1).max(400)
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()
  const userId = session.user.id

  const [file] = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId
    })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, activeOrgId)))

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found or access denied"
    })
  }

  const now = new Date()
  const source = body.rooms[0]?.source ?? "poc-client"

  if (body.replaceExisting) {
    await db.delete(detectedRoom).where(and(eq(detectedRoom.fileId, fileId), eq(detectedRoom.pageNum, body.pageNum)))
  }

  const insertRows = body.rooms.map((room) => ({
    id: randomUUID(),
    fileId,
    projectId: file.projectId,
    pageNum: body.pageNum,
    polygon: room.polygon,
    bounds: room.bounds,
    area: room.area,
    centroidX: room.centroid.x,
    centroidY: room.centroid.y,
    roomLabel: room.label ?? null,
    confidence: room.confidence ?? null,
    source: room.source ?? source,
    visible: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }))

  const savedRows =
    insertRows.length === 0
      ? []
      : await db.insert(detectedRoom).values(insertRows).returning({
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
          visible: detectedRoom.visible
        })

  return {
    savedCount: savedRows.length,
    rooms: savedRows.map((row) => ({
      id: row.id,
      pageNum: row.pageNum,
      polygon: row.polygon,
      bounds: row.bounds,
      area: row.area,
      centroid: { x: row.centroidX, y: row.centroidY },
      label: row.roomLabel,
      confidence: row.confidence,
      source: row.source,
      visible: row.visible
    }))
  }
})
