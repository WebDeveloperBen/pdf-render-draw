# AI Image Analysis

## Overview

Automatically analyze photos captured in the app to extract metadata, detect objects, recognize text (OCR), generate descriptions, and provide intelligent tagging. This enhances the value of site photos by making them searchable and adding contextual information without manual data entry.

## Use Cases

### Automatic Metadata Extraction
- **Scene Description**: "Photo of a bathroom with damaged tiles near the bathtub"
- **Object Detection**: Identify materials, tools, fixtures
- **Text Recognition**: Read serial numbers, labels, signage
- **Condition Assessment**: Detect damage, wear, issues

### Smart Organization
- **Auto-Tagging**: Categorize photos automatically
- **Search Enhancement**: Find photos by content
- **Grouping Suggestions**: "These photos appear to be from the same room"

### Quote/Report Generation
- **Evidence Summaries**: Auto-generate descriptions for reports
- **Material Lists**: Identify visible materials and fixtures
- **Issue Documentation**: Highlight detected problems

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Photo Upload                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Analysis Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Image Preprocessing                                         │
│     - Resize for API limits                                     │
│     - Orientation correction                                    │
│                                                                 │
│  2. AI Vision Analysis (Claude/GPT-4V/Gemini)                  │
│     - Scene description                                         │
│     - Object detection                                          │
│     - Condition assessment                                      │
│                                                                 │
│  3. OCR (Optional: Google Vision / Tesseract)                  │
│     - Text extraction                                           │
│     - Serial numbers, labels                                    │
│                                                                 │
│  4. Metadata Enrichment                                        │
│     - Auto-tagging                                             │
│     - Category suggestion                                       │
│     - Search indexing                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Update                             │
│  - Store analysis results                                       │
│  - Update search index                                          │
│  - Trigger notifications (if issues detected)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Analysis Results

```typescript
// types/ai-analysis.ts
interface AIImageAnalysis {
  // Generated description
  description: string
  shortDescription: string  // One line summary

  // Detected labels/tags
  labels: LabelDetection[]

  // Detected objects with bounding boxes
  objects: ObjectDetection[]

  // Extracted text (OCR)
  text: TextDetection[]

  // Scene classification
  scene: SceneClassification

  // Condition assessment (for construction/trades)
  condition?: ConditionAssessment

  // Suggested actions
  suggestions?: string[]

  // Confidence scores
  confidence: number

  // Processing metadata
  model: string
  processedAt: Date
  processingTimeMs: number
}

interface LabelDetection {
  label: string
  confidence: number
  category?: string
}

interface ObjectDetection {
  name: string
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  attributes?: Record<string, string>
}

interface TextDetection {
  text: string
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  type?: 'printed' | 'handwritten' | 'label' | 'sign'
}

interface SceneClassification {
  primary: string  // e.g., "bathroom", "kitchen", "exterior"
  secondary?: string  // e.g., "residential", "commercial"
  indoor: boolean
  lighting: 'natural' | 'artificial' | 'mixed' | 'low'
}

interface ConditionAssessment {
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'
  issues: DetectedIssue[]
  materials: DetectedMaterial[]
}

interface DetectedIssue {
  type: string  // e.g., "water damage", "crack", "rust"
  severity: 'minor' | 'moderate' | 'severe'
  location: string  // e.g., "upper left corner", "near window"
  description: string
  confidence: number
}

interface DetectedMaterial {
  name: string  // e.g., "ceramic tile", "hardwood", "drywall"
  confidence: number
  condition?: string
}
```

### Database Schema Extension

```typescript
// server/database/schema/photos.ts (additions)
import { jsonb } from 'drizzle-orm/pg-core'

// Add to photoAttachments table
export const photoAttachments = pgTable('photo_attachments', {
  // ... existing fields

  // AI Analysis results
  aiAnalysis: jsonb('ai_analysis').$type<AIImageAnalysis>(),
  aiAnalyzedAt: timestamp('ai_analyzed_at'),
  aiAnalysisStatus: text('ai_analysis_status'), // pending, processing, completed, failed

  // Search optimization
  searchText: text('search_text'),  // Combined searchable text
})

// Analysis jobs queue
export const analysisJobs = pgTable('analysis_jobs', {
  id: text('id').primaryKey(),
  photoId: text('photo_id')
    .notNull()
    .references(() => photoAttachments.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),  // queued, processing, completed, failed
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at')
})
```

## Implementation

### Analysis Service

```typescript
// server/utils/ai-analysis.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

interface AnalysisOptions {
  includeOCR?: boolean
  includeCondition?: boolean
  context?: string  // e.g., "construction project", "home inspection"
}

export async function analyzeImage(
  imageUrl: string,
  options: AnalysisOptions = {}
): Promise<AIImageAnalysis> {
  const startTime = Date.now()

  // Fetch image and convert to base64
  const imageResponse = await fetch(imageUrl)
  const imageBuffer = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString('base64')
  const mediaType = 'image/jpeg'

  // Build analysis prompt
  const systemPrompt = buildSystemPrompt(options)
  const userPrompt = buildUserPrompt(options)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ],
    system: systemPrompt
  })

  // Parse structured response
  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI')
  }

  const analysis = parseAnalysisResponse(textContent.text)

  return {
    ...analysis,
    model: 'claude-sonnet-4-20250514',
    processedAt: new Date(),
    processingTimeMs: Date.now() - startTime
  }
}

function buildSystemPrompt(options: AnalysisOptions): string {
  let prompt = `You are an expert image analyst specializing in construction, trades, and property documentation.
Analyze images to extract useful metadata for project documentation and quotes.

Always respond with valid JSON matching this structure:
{
  "description": "Detailed description of what's in the image",
  "shortDescription": "One sentence summary",
  "labels": [{"label": "string", "confidence": 0.0-1.0, "category": "optional"}],
  "objects": [{"name": "string", "confidence": 0.0-1.0, "attributes": {}}],
  "scene": {"primary": "string", "secondary": "string", "indoor": boolean, "lighting": "natural|artificial|mixed|low"},
  "confidence": 0.0-1.0
}`

  if (options.includeOCR) {
    prompt += `\n\nAlso extract any visible text:
  "text": [{"text": "string", "confidence": 0.0-1.0, "type": "printed|handwritten|label|sign"}]`
  }

  if (options.includeCondition) {
    prompt += `\n\nAssess the condition of what's shown:
  "condition": {
    "overall": "excellent|good|fair|poor|damaged",
    "issues": [{"type": "string", "severity": "minor|moderate|severe", "location": "string", "description": "string", "confidence": 0.0-1.0}],
    "materials": [{"name": "string", "confidence": 0.0-1.0, "condition": "string"}]
  }`
  }

  if (options.context) {
    prompt += `\n\nContext: This image is from a ${options.context}.`
  }

  return prompt
}

function buildUserPrompt(options: AnalysisOptions): string {
  let prompt = 'Analyze this image and provide structured metadata.'

  if (options.includeCondition) {
    prompt += ' Pay special attention to any damage, wear, or issues visible.'
  }

  if (options.includeOCR) {
    prompt += ' Extract any visible text, labels, or serial numbers.'
  }

  prompt += ' Respond only with valid JSON.'

  return prompt
}

function parseAnalysisResponse(text: string): Partial<AIImageAnalysis> {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('Could not parse AI response as JSON')
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0]
  return JSON.parse(jsonStr)
}
```

### Analysis Queue Worker

```typescript
// server/api/photos/analyze.post.ts
import { analyzeImage } from '~/server/utils/ai-analysis'
import { db, schema } from '~/server/utils/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { photoId } = await readBody(event)

  // Get photo
  const [photo] = await db
    .select()
    .from(schema.photoAttachments)
    .where(eq(schema.photoAttachments.id, photoId))

  if (!photo) {
    throw createError({ statusCode: 404, message: 'Photo not found' })
  }

  // Update status
  await db
    .update(schema.photoAttachments)
    .set({ aiAnalysisStatus: 'processing' })
    .where(eq(schema.photoAttachments.id, photoId))

  try {
    // Run analysis
    const analysis = await analyzeImage(photo.url, {
      includeOCR: true,
      includeCondition: true,
      context: 'construction/trades project documentation'
    })

    // Generate searchable text
    const searchText = generateSearchText(analysis)

    // Update photo with results
    await db
      .update(schema.photoAttachments)
      .set({
        aiAnalysis: analysis,
        aiAnalyzedAt: new Date(),
        aiAnalysisStatus: 'completed',
        searchText
      })
      .where(eq(schema.photoAttachments.id, photoId))

    // Auto-suggest category if not set
    if (!photo.category) {
      const suggestedCategory = suggestCategory(analysis)
      if (suggestedCategory) {
        await db
          .update(schema.photoAttachments)
          .set({ category: suggestedCategory })
          .where(eq(schema.photoAttachments.id, photoId))
      }
    }

    return { success: true, analysis }
  } catch (error) {
    await db
      .update(schema.photoAttachments)
      .set({
        aiAnalysisStatus: 'failed'
      })
      .where(eq(schema.photoAttachments.id, photoId))

    throw createError({
      statusCode: 500,
      message: 'Analysis failed'
    })
  }
})

function generateSearchText(analysis: AIImageAnalysis): string {
  const parts: string[] = [
    analysis.description,
    analysis.shortDescription,
    ...analysis.labels.map(l => l.label),
    ...analysis.objects.map(o => o.name),
    ...(analysis.text?.map(t => t.text) ?? []),
    analysis.scene.primary,
    analysis.scene.secondary ?? ''
  ]

  if (analysis.condition) {
    parts.push(
      analysis.condition.overall,
      ...analysis.condition.issues.map(i => `${i.type} ${i.description}`),
      ...analysis.condition.materials.map(m => m.name)
    )
  }

  return parts.filter(Boolean).join(' ').toLowerCase()
}

function suggestCategory(analysis: AIImageAnalysis): string | null {
  // Check for damage/issues
  if (analysis.condition?.issues.length) {
    return 'issue'
  }

  // Check scene type
  const scene = analysis.scene.primary.toLowerCase()
  if (scene.includes('material') || scene.includes('supply')) {
    return 'material'
  }

  // Check labels for common categories
  const labels = analysis.labels.map(l => l.label.toLowerCase())
  if (labels.some(l => l.includes('receipt') || l.includes('invoice'))) {
    return 'receipt'
  }

  return null
}
```

### Search with AI Analysis

```typescript
// server/api/photos/search.get.ts
import { db, schema } from '~/server/utils/db'
import { sql, and, eq, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { projectId, q, category, hasIssues, material } = query

  const conditions = []

  if (projectId) {
    conditions.push(eq(schema.photoAttachments.projectId, projectId as string))
  }

  if (q) {
    // Full-text search on AI-generated content
    conditions.push(
      or(
        ilike(schema.photoAttachments.searchText, `%${q}%`),
        ilike(schema.photoAttachments.notes, `%${q}%`)
      )
    )
  }

  if (category) {
    conditions.push(eq(schema.photoAttachments.category, category as string))
  }

  if (hasIssues === 'true') {
    // Filter to photos with detected issues
    conditions.push(
      sql`${schema.photoAttachments.aiAnalysis}->'condition'->'issues' IS NOT NULL
          AND jsonb_array_length(${schema.photoAttachments.aiAnalysis}->'condition'->'issues') > 0`
    )
  }

  if (material) {
    // Search for specific material
    conditions.push(
      sql`${schema.photoAttachments.aiAnalysis}->'condition'->'materials' @> ${JSON.stringify([{ name: material }])}::jsonb`
    )
  }

  const photos = await db
    .select()
    .from(schema.photoAttachments)
    .where(and(...conditions))
    .orderBy(schema.photoAttachments.capturedAt)

  return photos
})
```

## UI Components

### AI Analysis Display

```vue
<!-- components/photo/AIAnalysis.vue -->
<script setup lang="ts">
const props = defineProps<{
  analysis: AIImageAnalysis | null
  loading?: boolean
}>()

const showDetails = ref(false)
</script>

<template>
  <div class="ai-analysis">
    <!-- Loading state -->
    <div v-if="loading" class="loading">
      <Spinner />
      <span>Analyzing image...</span>
    </div>

    <!-- Analysis results -->
    <div v-else-if="analysis" class="results">
      <!-- Description -->
      <div class="description">
        <h4>AI Description</h4>
        <p>{{ analysis.shortDescription }}</p>
        <Button
          v-if="analysis.description !== analysis.shortDescription"
          variant="ghost"
          size="sm"
          @click="showDetails = !showDetails"
        >
          {{ showDetails ? 'Less' : 'More' }}
        </Button>
        <p v-if="showDetails" class="full-description">
          {{ analysis.description }}
        </p>
      </div>

      <!-- Labels/Tags -->
      <div v-if="analysis.labels.length" class="labels">
        <h4>Detected</h4>
        <div class="tag-list">
          <Badge
            v-for="label in analysis.labels.slice(0, 10)"
            :key="label.label"
            variant="secondary"
            :title="`${Math.round(label.confidence * 100)}% confidence`"
          >
            {{ label.label }}
          </Badge>
        </div>
      </div>

      <!-- Condition Assessment -->
      <div v-if="analysis.condition" class="condition">
        <h4>Condition</h4>
        <Badge
          :variant="getConditionVariant(analysis.condition.overall)"
        >
          {{ analysis.condition.overall }}
        </Badge>

        <!-- Issues -->
        <div v-if="analysis.condition.issues.length" class="issues">
          <h5>Issues Detected</h5>
          <div
            v-for="(issue, i) in analysis.condition.issues"
            :key="i"
            class="issue"
          >
            <Badge :variant="getSeverityVariant(issue.severity)">
              {{ issue.severity }}
            </Badge>
            <span class="issue-type">{{ issue.type }}</span>
            <span class="issue-location">{{ issue.location }}</span>
            <p class="issue-description">{{ issue.description }}</p>
          </div>
        </div>

        <!-- Materials -->
        <div v-if="analysis.condition.materials.length" class="materials">
          <h5>Materials</h5>
          <ul>
            <li v-for="mat in analysis.condition.materials" :key="mat.name">
              {{ mat.name }}
              <span v-if="mat.condition" class="material-condition">
                ({{ mat.condition }})
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Extracted Text -->
      <div v-if="analysis.text?.length" class="ocr">
        <h4>Text Found</h4>
        <ul>
          <li v-for="(text, i) in analysis.text" :key="i">
            <Badge variant="outline" size="sm">{{ text.type }}</Badge>
            {{ text.text }}
          </li>
        </ul>
      </div>

      <!-- Confidence -->
      <div class="confidence">
        <span class="text-muted">
          Analysis confidence: {{ Math.round(analysis.confidence * 100) }}%
        </span>
      </div>
    </div>

    <!-- No analysis -->
    <div v-else class="no-analysis">
      <p class="text-muted">No AI analysis available</p>
    </div>
  </div>
</template>

<script lang="ts">
function getConditionVariant(condition: string) {
  switch (condition) {
    case 'excellent':
    case 'good':
      return 'default'
    case 'fair':
      return 'secondary'
    case 'poor':
    case 'damaged':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getSeverityVariant(severity: string) {
  switch (severity) {
    case 'minor':
      return 'secondary'
    case 'moderate':
      return 'warning'
    case 'severe':
      return 'destructive'
    default:
      return 'outline'
  }
}
</script>

<style scoped>
.ai-analysis {
  padding: 1rem;
  border-radius: 8px;
  background: var(--card);
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.issue {
  padding: 0.5rem;
  margin: 0.5rem 0;
  border-left: 3px solid var(--border);
  padding-left: 1rem;
}

.issue-type {
  font-weight: 600;
  margin-left: 0.5rem;
}

.issue-location {
  color: var(--muted-foreground);
  margin-left: 0.5rem;
}

.issue-description {
  margin-top: 0.25rem;
  font-size: 0.9em;
}
</style>
```

### Smart Search

```vue
<!-- components/photo/SmartSearch.vue -->
<script setup lang="ts">
const props = defineProps<{
  projectId: string
}>()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const showIssuesOnly = ref(false)
const selectedMaterial = ref<string | null>(null)

const { data: photos } = await useFetch('/api/photos/search', {
  query: computed(() => ({
    projectId: props.projectId,
    q: searchQuery.value || undefined,
    category: selectedCategory.value || undefined,
    hasIssues: showIssuesOnly.value ? 'true' : undefined,
    material: selectedMaterial.value || undefined
  }))
})

// Get unique materials from analyzed photos
const materials = computed(() => {
  const mats = new Set<string>()
  photos.value?.forEach(photo => {
    photo.aiAnalysis?.condition?.materials?.forEach(m => {
      mats.add(m.name)
    })
  })
  return Array.from(mats).sort()
})
</script>

<template>
  <div class="smart-search">
    <div class="search-bar">
      <Input
        v-model="searchQuery"
        placeholder="Search photos by content, description, text..."
        class="flex-1"
      >
        <template #prefix>
          <Icon name="search" />
        </template>
      </Input>
    </div>

    <div class="filters">
      <Select v-model="selectedCategory">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="null">All Categories</SelectItem>
          <SelectItem value="before">Before</SelectItem>
          <SelectItem value="after">After</SelectItem>
          <SelectItem value="progress">Progress</SelectItem>
          <SelectItem value="issue">Issue</SelectItem>
          <SelectItem value="material">Material</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="selectedMaterial">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="Material" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="null">All Materials</SelectItem>
          <SelectItem v-for="mat in materials" :key="mat" :value="mat">
            {{ mat }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex items-center gap-2">
        <Checkbox id="issues" v-model:checked="showIssuesOnly" />
        <label for="issues">Issues only</label>
      </div>
    </div>

    <!-- Results -->
    <div class="results">
      <p class="result-count">
        {{ photos?.length ?? 0 }} photos found
      </p>

      <PhotoGallery :photos="photos ?? []" />
    </div>
  </div>
</template>
```

## Configuration

### Environment Variables

```env
# AI Provider
ANTHROPIC_API_KEY="sk-ant-..."

# Alternative: OpenAI
OPENAI_API_KEY="sk-..."

# Alternative: Google Cloud Vision
GOOGLE_CLOUD_PROJECT_ID=""
GOOGLE_CLOUD_KEY_FILE=""

# Analysis settings
AI_ANALYSIS_ENABLED=true
AI_ANALYSIS_AUTO=true  # Auto-analyze on upload
AI_ANALYSIS_MAX_SIZE=10485760  # 10MB max for analysis
```

### Nuxt Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    aiAnalysis: {
      enabled: process.env.AI_ANALYSIS_ENABLED === 'true',
      auto: process.env.AI_ANALYSIS_AUTO === 'true',
      maxSize: parseInt(process.env.AI_ANALYSIS_MAX_SIZE || '10485760')
    }
  }
})
```

## Cost Considerations

### Pricing (Approximate)

| Provider | Model | Cost per Image |
|----------|-------|----------------|
| Anthropic | Claude Sonnet | ~$0.01-0.03 |
| OpenAI | GPT-4 Vision | ~$0.01-0.03 |
| Google | Cloud Vision | ~$0.0015 |

### Optimization Strategies

1. **Resize images** before analysis (1024px max)
2. **Cache results** - don't re-analyze same image
3. **Batch processing** during off-peak hours
4. **User-triggered** vs auto-analysis option
5. **Tiered by plan** - limit analysis count on free tier

## Acceptance Criteria

### Analysis Quality
- [ ] Scene description is accurate and useful
- [ ] Object detection identifies relevant items
- [ ] OCR extracts readable text accurately
- [ ] Condition assessment reflects visible issues
- [ ] Confidence scores are meaningful

### Integration
- [ ] Analysis triggers automatically on upload
- [ ] Manual re-analysis option available
- [ ] Results stored with photo record
- [ ] Search uses AI-generated content
- [ ] Category auto-suggestion works

### Performance
- [ ] Analysis completes in < 10 seconds
- [ ] Failed analysis retries automatically
- [ ] Queue handles high volume
- [ ] Results cached appropriately

### User Experience
- [ ] Loading state while analyzing
- [ ] Results displayed clearly
- [ ] Users can edit/correct suggestions
- [ ] Search by AI content works
- [ ] Issue detection highlighted

### Cost Control
- [ ] Analysis count tracked per user
- [ ] Limits enforced by subscription tier
- [ ] Admin can disable feature
- [ ] Usage reported in dashboard
