# Document OCR & Text Extraction

## Priority
**Medium** - Enhances document interaction

## Status
⏳ Planned

## Description
Extract text content from PDF documents using OCR (Optical Character Recognition) and render text regions as interactive overlays. This enables searching, selecting, and interacting with scanned documents or image-based PDFs.

## Use Cases
- Extract text from scanned construction drawings
- Search for room names, dimensions, or labels on plans
- Click on text regions to read extracted content
- Copy text from image-based PDFs
- Auto-detect scale annotations (e.g., "1:100", "1/4" = 1'")

## Provider Options

### Azure Document Intelligence (Recommended)
Microsoft's enterprise OCR service with layout analysis.

**Pros:**
- High accuracy for technical drawings
- Returns polygon coordinates for each text region
- Table detection and structure analysis
- Handles rotated text well

**API Response Structure:**
```typescript
interface DocumentWord {
  content: string           // The extracted text
  polygon: number[]         // [x1,y1, x2,y2, x3,y3, x4,y4] - 4 corner points
  confidence: number        // 0-1 confidence score
  span: { offset: number; length: number }
}

interface DocumentLine {
  content: string
  polygon: number[]
  spans: Span[]
}

interface DocumentParagraph {
  content: string
  boundingRegions: BoundingRegion[]
}
```

### Alternative: Docling (Open Source)
IBM's document understanding library.

**Pros:**
- Self-hosted, no API costs
- Good for structured documents
- Markdown/JSON output

**Cons:**
- Requires Python backend
- Less accurate on handwritten/rotated text

### Alternative: MarkItDown
Microsoft's document-to-markdown converter.

**Pros:**
- Simple text extraction
- Works locally

**Cons:**
- No polygon/coordinate data
- Text-only output (no positions)

## Features

### Core Functionality
- Upload PDF and trigger OCR processing
- Store extracted text with coordinates per page
- Render text regions as transparent overlays
- Toggle OCR layer visibility

### Text Region Rendering
- Draw polygon outlines around detected text
- Hover to highlight text region
- Click to show extracted content
- Color-code by confidence level

### Search & Navigation
- Full-text search across extracted content
- Jump to page/location of search results
- Highlight matching regions

### Scale Detection (Future)
- Auto-detect scale annotations (e.g., "SCALE: 1:50")
- Suggest scale calibration based on detected text

## Implementation Notes

### Data Structure
```typescript
interface OCRResult {
  id: string
  documentId: string
  pageNum: number
  processedAt: string
  provider: 'azure' | 'docling' | 'markitdown'
  words: OCRWord[]
  lines: OCRLine[]
  paragraphs: OCRParagraph[]
}

interface OCRWord {
  content: string
  polygon: Point[]          // 4 corner points
  confidence: number
  boundingBox: Bounds       // Simplified rectangle
}

interface OCRLine {
  content: string
  polygon: Point[]
  words: OCRWord[]
}

interface OCRParagraph {
  content: string
  boundingBox: Bounds
  lines: OCRLine[]
}
```

### API Endpoint
```typescript
// POST /api/documents/[id]/ocr
// Trigger OCR processing for a document

// GET /api/documents/[id]/ocr
// Retrieve OCR results for a document
```

### Azure Document Intelligence Integration
```typescript
// Server-side: server/api/documents/[id]/ocr.post.ts
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer"

const client = new DocumentAnalysisClient(
  process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
)

// Use "prebuilt-layout" model for general document analysis
const poller = await client.beginAnalyzeDocument("prebuilt-layout", pdfBuffer)
const result = await poller.pollUntilDone()
```

### Rendering OCR Regions on Canvas
```typescript
// Convert Azure polygon (flat array) to Points
function polygonToPoints(polygon: number[]): Point[] {
  const points: Point[] = []
  for (let i = 0; i < polygon.length; i += 2) {
    points.push({ x: polygon[i], y: polygon[i + 1] })
  }
  return points
}

// Render as Konva shape
const ocrRegion = new Konva.Line({
  points: points.flatMap(p => [p.x * scale, p.y * scale]),
  stroke: '#3b82f6',
  strokeWidth: 1,
  closed: true,
  opacity: 0.3,
  listening: true  // Enable hover/click
})
```

### Coordinate System
Azure Document Intelligence returns coordinates in **inches** from top-left of page.
- Convert to PDF points: `pdfX = azureX * 72`
- Then apply canvas scale: `canvasX = pdfX * scale`

## Database Schema
```sql
-- OCR results table
create table ocr_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  page_num integer not null,
  provider text not null,
  raw_result jsonb not null,       -- Full API response
  words jsonb not null,            -- Processed word array
  lines jsonb not null,            -- Processed line array
  processed_at timestamptz default now(),
  unique(document_id, page_num)
);
```

## Environment Variables
```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<your-key>
```

## UI Components
- OCR toggle button in toolbar
- OCR processing status indicator
- Text search panel
- OCR region hover tooltip
- Confidence visualization (optional)

## Cost Considerations
Azure Document Intelligence pricing (as of 2024):
- Read model: ~$1.50 per 1,000 pages
- Layout model: ~$10 per 1,000 pages
- Consider caching results to avoid re-processing

## Priority Justification
Medium priority - valuable for scanned documents and automated scale detection, but core measurement functionality works without it.
