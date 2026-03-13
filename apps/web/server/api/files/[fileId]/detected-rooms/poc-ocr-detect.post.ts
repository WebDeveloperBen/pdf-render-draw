import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const textLabelSchema = z.object({
  text: z.string(),
  pdfX: z.number(),
  pdfY: z.number(),
  pixelX: z.number().int(),
  pixelY: z.number().int()
})

const bodySchema = z.object({
  pageNum: z.number().int().min(1),
  pageWidth: z.number().positive(),
  pageHeight: z.number().positive(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  imageDataUrl: z.string().min(1000),
  maxRooms: z.number().int().min(1).max(200).optional(),
  textLabels: z.array(textLabelSchema).optional()
})

const providerRoomSchema = z.object({
  label: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  polygon: z.array(z.array(z.number()).length(2)).min(3).max(20)
})

const providerResponseSchema = z.object({
  rooms: z.array(providerRoomSchema).max(250),
  scale: z
    .object({
      pixel_length: z.number().positive(),
      real_length_mm: z.number().positive()
    })
    .nullable()
    .optional()
})

interface OpenAiContentBlock {
  type?: string
  text?: string
}

interface OpenAiOutputItem {
  type?: string
  content?: OpenAiContentBlock[]
}

interface OpenAiResponse {
  output_text?: string
  output?: OpenAiOutputItem[]
}

function normaliseAzureEndpointOrigin(endpoint: string): string {
  try {
    const parsed = new URL(endpoint.trim())
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return endpoint.trim().replace(/\/+$/g, "")
  }
}

function buildAzureV1ResponsesUrl(endpoint: string): string {
  return `${normaliseAzureEndpointOrigin(endpoint)}/openai/v1/responses`
}

function buildAzurePreviewResponsesUrl(endpoint: string, apiVersion: string): string {
  return `${normaliseAzureEndpointOrigin(endpoint)}/openai/responses?api-version=${encodeURIComponent(apiVersion)}`
}

function parseImageDataUrl(imageDataUrl: string): { normalisedDataUrl: string } {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\n\r]+)$/)
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image payload" })
  }
  const mediaType = match[1] ?? ""
  const base64Data = (match[2] ?? "").replace(/[\n\r]/g, "")
  if (!mediaType || !base64Data) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image payload" })
  }
  return { normalisedDataUrl: `data:${mediaType};base64,${base64Data}` }
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }
  throw new Error("No JSON payload found in provider response")
}

function dedupePolygon(points: Point[]): Point[] {
  const output: Point[] = []
  for (const point of points) {
    const prev = output[output.length - 1]
    if (prev && Math.abs(prev.x - point.x) < 0.5 && Math.abs(prev.y - point.y) < 0.5) continue
    output.push(point)
  }
  if (output.length >= 3) {
    const first = output[0]!
    const last = output[output.length - 1]!
    if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) output.pop()
  }
  return output
}

function signedArea(points: Point[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const q = points[(i + 1) % n]!
    area += p.x * q.y - q.x * p.y
  }
  return area / 2
}

function polygonBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  return { minX, minY, maxX, maxY }
}

function polygonCentroid(points: Point[]): Point {
  const area = signedArea(points)
  if (Math.abs(area) < 1e-8) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return { x: sum.x / points.length, y: sum.y / points.length }
  }
  let cx = 0,
    cy = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const q = points[(i + 1) % n]!
    const cross = p.x * q.y - q.x * p.y
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  const factor = 1 / (6 * area)
  return { x: cx * factor, y: cy * factor }
}

export default defineEventHandler(async (event) => {
  requireFeature("roomAiDetect")

  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organisation. Please select an organisation."
    })
  }

  const db = useDrizzle()
  const [file] = await db
    .select({ id: projectFile.id })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, activeOrgId)))

  if (!file) {
    throw createError({ statusCode: 404, statusMessage: "File not found or access denied" })
  }

  const config = useRuntimeConfig()
  const azureApiKey = typeof config.azureOpenaiApiKey === "string" ? config.azureOpenaiApiKey : undefined
  const azureApiVersion = typeof config.azureOpenaiApiVersion === "string" ? config.azureOpenaiApiVersion : undefined
  const azureEndpoint = typeof config.azureOpenaiEndpoint === "string" ? config.azureOpenaiEndpoint : undefined
  const azureDeployment = typeof config.azureOpenaiDeployment === "string" ? config.azureOpenaiDeployment : undefined

  if (!azureApiKey || !azureApiVersion || !azureEndpoint || !azureDeployment) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Missing Azure OpenAI config. Set NUXT_AZURE_OPENAI_API_VERSION, NUXT_AZURE_OPENAI_API_KEY, NUXT_AZURE_OPENAI_ENDPOINT, and NUXT_AZURE_OPENAI_DEPLOYMENT."
    })
  }

  console.log(`[RoomOCR] Text label hints: ${(body.textLabels ?? []).length}`)
  for (const l of (body.textLabels ?? []).slice(0, 10)) {
    console.log(`[RoomOCR]   "${l.text}" at pixel (${l.pixelX}, ${l.pixelY}) / PDF (${l.pdfX}, ${l.pdfY})`)
  }

  const { normalisedDataUrl } = parseImageDataUrl(body.imageDataUrl)
  const maxRooms = body.maxRooms ?? 80
  const model = azureDeployment
  const providerUrlV1 = buildAzureV1ResponsesUrl(azureEndpoint)
  const providerUrlPreview = buildAzurePreviewResponsesUrl(azureEndpoint, azureApiVersion)

  const textLabels = body.textLabels ?? []

  const labelHintsSection =
    textLabels.length > 0
      ? [
          "",
          "RED CROSSHAIR MARKERS:",
          "Red crosshair markers (⊕) have been drawn on the image at the exact pixel locations of room labels extracted from the PDF.",
          "Each marker shows where a room label is. The room polygon MUST contain its marker point.",
          ...textLabels.map((l) => `  - "${l.text}" → red marker at pixel (${l.pixelX}, ${l.pixelY})`),
          "",
          "Use these markers as precise anchor points. Start from each marker, then trace outward to find the enclosing walls.",
          ""
        ]
      : []

  const prompt = [
    `You are an expert architectural plan analyser. The image is a floor plan that is exactly ${body.imageWidth}px wide and ${body.imageHeight}px tall.`,
    "",
    "YOUR TASK: Identify every enclosed room and return a precise polygon tracing each room's inner wall boundaries.",
    ...labelHintsSection,
    "STEP-BY-STEP APPROACH for each room:",
    "1. Find a room — either by its text label (with red crosshair marker) or by identifying enclosed wall boundaries",
    "2. Identify the thick black wall lines that form ALL sides of this room's boundary",
    "3. For EACH wall segment, measure the EXACT pixel x,y where it starts and ends",
    "4. Trace the polygon CLOCKWISE along the inner edge of each wall, placing vertices at wall corners/intersections",
    "5. VERIFY: Does the polygon contain the room's label/marker? If not, adjust.",
    "6. VERIFY: Do shared walls between adjacent rooms have IDENTICAL edge coordinates?",
    "",
    "CRITICAL ACCURACY RULES:",
    "- Measure wall positions by looking at the actual pixel coordinates of the wall lines, not by estimating",
    "- Walls are typically 8-20 pixels thick in the image. Trace the INNER face.",
    "- Adjacent rooms share walls — ensure shared edges have identical coordinates",
    "- Do NOT extend a room's boundary past its actual walls into neighboring rooms",
    "- If a room is rectangular, it needs exactly 4 polygon points",
    "- If a room is L-shaped, use 6 points. For more complex shapes, use more points as needed.",
    "",
    "COORDINATE RULES:",
    `- x: integer 0–${body.imageWidth}, y: integer 0–${body.imageHeight}`,
    "- Origin (0,0) is top-left. X increases right, Y increases down.",
    "",
    "WHAT IS A WALL vs WHAT IS NOT:",
    "- WALLS: Thick black/dark lines forming room boundaries (typically 8-20px thick)",
    "- NOT WALLS: Dimension lines (thin lines with measurements like '3400'), dashed lines, annotation lines, furniture outlines",
    "",
    "WHAT TO DETECT:",
    "- Every enclosed room: bedrooms, bathrooms, kitchen, living, family, garage, hallway, entry, laundry, study, robe/WIR, pantry, WC, store, linen, lounge, rumpus, ensuite, dressing room, alfresco, porch, mud room, etc.",
    "- Small utility rooms too (store, linen, WC, powder room)",
    "- Do NOT include: title blocks, dimension strips, notes, legends, section views, outdoor areas without walls",
    "",
    "SCALE: Find a dimension line with a measurement in mm and measure its pixel length.",
    "",
    `Return JSON. Maximum ${maxRooms} rooms.`,
    "",
    "Schema:",
    JSON.stringify({
      rooms: [
        {
          label: "string|null",
          confidence: 0.95,
          polygon: [
            [480, 650],
            [780, 650],
            [780, 920],
            [480, 920]
          ]
        }
      ],
      scale: { pixel_length: 150, real_length_mm: 3400 }
    })
  ].join("\n")

  const requestBody = {
    model,
    temperature: 0,
    max_output_tokens: 16384,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: normalisedDataUrl }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema" as const,
        name: "detected_rooms",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: {
                    anyOf: [{ type: "string" }, { type: "null" }]
                  },
                  confidence: {
                    anyOf: [{ type: "number" }, { type: "null" }]
                  },
                  polygon: {
                    type: "array",
                    items: {
                      type: "array",
                      items: { type: "number" },
                      minItems: 2,
                      maxItems: 2
                    },
                    minItems: 3,
                    maxItems: 20
                  }
                },
                required: ["label", "confidence", "polygon"]
              }
            },
            scale: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    pixel_length: { type: "number" },
                    real_length_mm: { type: "number" }
                  },
                  required: ["pixel_length", "real_length_mm"]
                },
                { type: "null" }
              ]
            }
          },
          required: ["rooms", "scale"]
        }
      }
    }
  }

  let providerResponse: OpenAiResponse
  try {
    providerResponse = await $fetch<OpenAiResponse>(providerUrlV1, {
      method: "POST",
      headers: {
        "api-key": azureApiKey,
        "content-type": "application/json"
      },
      body: requestBody
    })
  } catch (primaryError: unknown) {
    const statusCode =
      typeof primaryError === "object" && primaryError !== null
        ? Number((primaryError as { statusCode?: number }).statusCode ?? (primaryError as { status?: number }).status)
        : NaN

    if (statusCode !== 404) throw primaryError

    console.warn(`[RoomOCR] Azure v1 responses path not available, falling back to preview path`)

    providerResponse = await $fetch<OpenAiResponse>(providerUrlPreview, {
      method: "POST",
      headers: {
        "api-key": azureApiKey,
        "content-type": "application/json"
      },
      body: requestBody
    })
  }

  const contentText =
    providerResponse.output_text?.trim() ||
    (providerResponse.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((block) => block.type === "output_text" && typeof block.text === "string")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim()

  if (!contentText) {
    throw createError({
      statusCode: 502,
      statusMessage: "OCR provider returned no text response"
    })
  }

  console.log(`[RoomOCR] Raw response length: ${contentText.length} chars`)

  let parsedRooms: z.infer<typeof providerResponseSchema>
  try {
    const jsonPayload = extractJsonPayload(contentText)
    parsedRooms = providerResponseSchema.parse(JSON.parse(jsonPayload))
  } catch (error) {
    console.error("[RoomOCR] Failed to parse provider JSON:", contentText.slice(0, 500))
    throw createError({
      statusCode: 502,
      statusMessage: "OCR provider response was not valid room JSON"
    })
  }

  // Log raw pixel coordinates for debugging
  console.log(`[RoomOCR] Raw rooms from model: ${parsedRooms.rooms.length}`)
  for (const r of parsedRooms.rooms.slice(0, 5)) {
    const coords = r.polygon.map((p) => `(${p[0]},${p[1]})`).join(" ")
    console.log(`[RoomOCR]   ${r.label ?? "?"}: ${coords}`)
  }

  // Map pixel coordinates → PDF viewport coordinates
  const scaleX = body.pageWidth / body.imageWidth
  const scaleY = body.pageHeight / body.imageHeight

  console.log(
    `[RoomOCR] Mapping pixels (${body.imageWidth}x${body.imageHeight}) → PDF viewport (${body.pageWidth.toFixed(1)}x${body.pageHeight.toFixed(1)}), scale: ${scaleX.toFixed(4)}x${scaleY.toFixed(4)}`
  )

  // Build a lookup of text labels by normalized name for snapping
  const labelLookup = new Map<string, { pdfX: number; pdfY: number }>()
  for (const label of textLabels) {
    const key = label.text.toLowerCase().trim()
    // Store in PDF viewport coords (pdfX/pdfY from client are already viewport coords)
    labelLookup.set(key, { pdfX: label.pdfX, pdfY: label.pdfY })
  }

  const minArea = Math.max(150, body.pageWidth * body.pageHeight * 0.0002)
  const mappedRooms = parsedRooms.rooms
    .slice(0, maxRooms)
    .map((room, index) => {
      // Convert [x, y] pixel pairs → {x, y} PDF viewport points, clamped to page bounds
      const polygon = dedupePolygon(
        room.polygon.map((pair) => ({
          x: Math.max(0, Math.min(body.pageWidth, (pair[0] ?? 0) * scaleX)),
          y: Math.max(0, Math.min(body.pageHeight, (pair[1] ?? 0) * scaleY))
        }))
      )
      if (polygon.length < 3) return null

      const area = Math.abs(signedArea(polygon))
      if (!Number.isFinite(area) || area < minArea) return null

      const bounds = polygonBounds(polygon)
      const centroid = polygonCentroid(polygon)

      return {
        id: `ocr-${body.pageNum}-${index + 1}`,
        pageNum: body.pageNum,
        polygon,
        bounds,
        area,
        centroid,
        label: room.label ?? null,
        confidence: room.confidence ?? null,
        source: "ocr-azure-openai"
      }
    })
    .filter((room): room is NonNullable<typeof room> => room !== null)

  // Map scale reference to PDF viewport space if available
  let scaleReference = null
  if (parsedRooms.scale && parsedRooms.scale.pixel_length > 0 && parsedRooms.scale.real_length_mm > 0) {
    // Convert pixel length to PDF points using the average of x/y scale
    const avgScale = (scaleX + scaleY) / 2
    scaleReference = {
      pdfPointsLength: parsedRooms.scale.pixel_length * avgScale,
      realLengthMm: parsedRooms.scale.real_length_mm,
      pixelLength: parsedRooms.scale.pixel_length
    }
  }

  console.log(
    `[RoomOCR] Detected ${mappedRooms.length} rooms, scale: ${scaleReference ? `${scaleReference.realLengthMm}mm = ${scaleReference.pixelLength}px` : "not detected"}`
  )

  return {
    pageNum: body.pageNum,
    provider: "azure-openai",
    model,
    rooms: mappedRooms,
    scale: scaleReference
  }
})
