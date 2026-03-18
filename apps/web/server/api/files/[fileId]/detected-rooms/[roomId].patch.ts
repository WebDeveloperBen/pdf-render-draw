import { z } from "zod"
import { and, eq } from "drizzle-orm"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" }),
  roomId: z.uuid({ message: "Invalid room ID" })
})

const bodySchema = z.object({
  visible: z.boolean()
})

export default defineEventHandler(async (event) => {
  const { orgId } = await requireActiveOrg(event)

  const { fileId, roomId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

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

  const [updated] = await db
    .update(detectedRoom)
    .set({
      visible: body.visible,
      updatedAt: new Date()
    })
    .where(and(eq(detectedRoom.id, roomId), eq(detectedRoom.fileId, fileId)))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: "Room not found"
    })
  }

  return {
    id: updated.id,
    visible: updated.visible
  }
})
