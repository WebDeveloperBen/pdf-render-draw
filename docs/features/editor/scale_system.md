# Scale System Overhaul

## Priority
**High** - Core functionality for accurate measurements

## Status
⏳ Planned

## Problem Statement

The current scale implementation has several issues that limit robustness and cause confusion:

1. **Duplicate code** - `parsePdfPageScale()` exists in two files
2. **Inconsistent function signatures** - Some functions fetch scale internally, others require it as a parameter
3. **String-based storage** - Scale stored as "1:100" string with regex parsing at runtime
4. **No validation** - Invalid scales like "1:0", "2:100", or "invalid" silently fallback to 1
5. **Scale not persisted with annotations** - If settings change, old measurements recalculate with new scale
6. **Naming confusion** - `rendererStore.scale` (zoom) vs `settingsStore.pdfScale` (measurement scale)
7. **Hardcoded DPI** - Assumes 72 DPI for all PDFs
8. **Limited format support** - Only handles "1:N" format

---

## Current Implementation

### Storage
```typescript
// stores/settings.ts
general: {
  pdfScale: "1:100"  // string type
}
```

### Parsing
```typescript
// utils/editor/transform.ts & utils/calculations.ts (DUPLICATE!)
function parsePdfPageScale(scaleString: string): number {
  const match = scaleString.match(/1:(\d+)/)
  if (!match || !match[1]) return 1
  return parseInt(match[1])
}
```

### Usage (Inconsistent)
```typescript
// Pattern A: Fetch from store internally
calculateDistance(p1, p2, dpi) // Gets scale from settingsStore

// Pattern B: Explicit parameter
calculateDistance(p1, p2, scaleString, dpi) // Scale passed in
```

---

## Proposed Solution

### Phase 1: Research & Design

#### 1.1 Scale Format Analysis
Research common PDF scale formats:

| Format | Example | Description |
|--------|---------|-------------|
| Ratio | 1:100 | 1 unit on paper = 100 units real |
| Ratio (reversed) | 100:1 | Enlargement (rare) |
| Fraction | 1/100 | Same as 1:100 |
| Decimal | 0.01 | Same as 1:100 |
| Imperial | 1" = 10' | Architectural scale |
| Metric | 1cm = 1m | Metric architectural |
| Named | "Full Size" | Common preset names |

#### 1.2 Design Decision: Storage Format

**Option A: Keep String, Improve Parsing**
```typescript
type ScaleString = `1:${number}` | `${number}:1` | `1/${number}` | string
```
- Pros: Human-readable, familiar format
- Cons: Runtime parsing, validation complexity

**Option B: Store as Number (Multiplier)**
```typescript
// 1:100 stored as 100, 1:50 stored as 50
pdfScale: number
```
- Pros: Simple math, no parsing
- Cons: Loses original format, less intuitive

**Option C: Structured Object**
```typescript
interface PdfScale {
  ratio: number       // The scale factor (100 for 1:100)
  format: string      // Original format for display ("1:100")
  type: 'metric' | 'imperial' | 'custom'
}
```
- Pros: Best of both worlds, extensible
- Cons: More complex storage

**Recommendation: Option C** - Provides flexibility for future imperial support and preserves display format.

#### 1.3 DPI Handling

PDFs can have different DPI. Options:

1. **Detect from PDF** - Read UserUnit or MediaBox
2. **User override** - Allow user to specify DPI
3. **Per-document storage** - Store DPI with document metadata
4. **Default with warning** - Keep 72 DPI default, warn if different

---

### Phase 2: Core Refactor

#### 2.1 Create Scale Types

```typescript
// types/scale.ts

export interface ScaleConfig {
  /** The scale multiplier (100 for 1:100) */
  multiplier: number

  /** Display format string ("1:100") */
  displayFormat: string

  /** Scale type for future imperial support */
  type: 'ratio' | 'fraction' | 'imperial' | 'custom'

  /** DPI for this scale context */
  dpi: number
}

export type ScalePreset =
  | '1:1' | '1:5' | '1:10' | '1:20' | '1:25'
  | '1:50' | '1:100' | '1:200' | '1:500' | '1:1000'

export const SCALE_PRESETS: Record<ScalePreset, ScaleConfig> = {
  '1:1': { multiplier: 1, displayFormat: '1:1', type: 'ratio', dpi: 72 },
  '1:5': { multiplier: 5, displayFormat: '1:5', type: 'ratio', dpi: 72 },
  '1:10': { multiplier: 10, displayFormat: '1:10', type: 'ratio', dpi: 72 },
  '1:20': { multiplier: 20, displayFormat: '1:20', type: 'ratio', dpi: 72 },
  '1:25': { multiplier: 25, displayFormat: '1:25', type: 'ratio', dpi: 72 },
  '1:50': { multiplier: 50, displayFormat: '1:50', type: 'ratio', dpi: 72 },
  '1:100': { multiplier: 100, displayFormat: '1:100', type: 'ratio', dpi: 72 },
  '1:200': { multiplier: 200, displayFormat: '1:200', type: 'ratio', dpi: 72 },
  '1:500': { multiplier: 500, displayFormat: '1:500', type: 'ratio', dpi: 72 },
  '1:1000': { multiplier: 1000, displayFormat: '1:1000', type: 'ratio', dpi: 72 },
}
```

#### 2.2 Create Scale Parser Utility

```typescript
// utils/scale.ts

import type { ScaleConfig, ScalePreset } from '~/types/scale'
import { SCALE_PRESETS } from '~/types/scale'

/**
 * Parse a scale string into a ScaleConfig
 * Supports: "1:100", "1/100", "0.01", imperial formats
 */
export function parseScale(input: string | number): ScaleConfig {
  // Check presets first
  if (typeof input === 'string' && input in SCALE_PRESETS) {
    return SCALE_PRESETS[input as ScalePreset]
  }

  // Handle number input directly
  if (typeof input === 'number') {
    return {
      multiplier: input,
      displayFormat: `1:${input}`,
      type: 'custom',
      dpi: 72
    }
  }

  // Try ratio format: "1:100" or "100:1"
  const ratioMatch = input.match(/^(\d+):(\d+)$/)
  if (ratioMatch) {
    const [, left, right] = ratioMatch
    const leftNum = parseInt(left!, 10)
    const rightNum = parseInt(right!, 10)

    if (leftNum === 1) {
      return { multiplier: rightNum, displayFormat: input, type: 'ratio', dpi: 72 }
    } else if (rightNum === 1) {
      // Enlargement: 100:1 means 1 unit real = 100 units on paper
      return { multiplier: 1 / leftNum, displayFormat: input, type: 'ratio', dpi: 72 }
    }
  }

  // Try fraction format: "1/100"
  const fractionMatch = input.match(/^1\/(\d+)$/)
  if (fractionMatch) {
    const denom = parseInt(fractionMatch[1]!, 10)
    return { multiplier: denom, displayFormat: `1:${denom}`, type: 'fraction', dpi: 72 }
  }

  // Try decimal format: "0.01"
  const decimal = parseFloat(input)
  if (!isNaN(decimal) && decimal > 0 && decimal <= 1) {
    const multiplier = Math.round(1 / decimal)
    return { multiplier, displayFormat: `1:${multiplier}`, type: 'custom', dpi: 72 }
  }

  // Try imperial: 1" = 10' (future)
  // const imperialMatch = input.match(/^1"\s*=\s*(\d+)'$/)

  // Fallback
  console.warn(`Invalid scale format: "${input}", defaulting to 1:1`)
  return SCALE_PRESETS['1:1']
}

/**
 * Validate a scale value
 */
export function isValidScale(input: string | number): boolean {
  try {
    const config = parseScale(input)
    return config.multiplier > 0 && config.multiplier < 100000
  } catch {
    return false
  }
}

/**
 * Format a scale for display
 */
export function formatScale(config: ScaleConfig): string {
  return config.displayFormat
}
```

#### 2.3 Update Settings Store

```typescript
// stores/settings.ts

import type { ScaleConfig } from '~/types/scale'
import { parseScale, SCALE_PRESETS } from '~/utils/scale'

interface GeneralSettings {
  // ... other settings

  /** PDF measurement scale configuration */
  pdfScale: ScaleConfig

  /** @deprecated Use pdfScale.displayFormat */
  pdfScaleString?: string
}

// Default
const defaultGeneral: GeneralSettings = {
  // ...
  pdfScale: SCALE_PRESETS['1:100']
}

// Actions
function setPdfScale(input: string | number | ScaleConfig) {
  if (typeof input === 'object' && 'multiplier' in input) {
    state.general.pdfScale = input
  } else {
    state.general.pdfScale = parseScale(input)
  }
}

// Getters
const getPdfScale = computed(() => state.general.pdfScale)
const getPdfScaleMultiplier = computed(() => state.general.pdfScale.multiplier)
const getPdfScaleDisplay = computed(() => state.general.pdfScale.displayFormat)
```

#### 2.4 Update Calculation Functions

```typescript
// utils/editor/transform.ts

import type { ScaleConfig } from '~/types/scale'

/**
 * Calculate distance between two points in real-world units
 */
export function calculateDistance(
  p1: Point,
  p2: Point,
  scale?: ScaleConfig | number
): number {
  // Get scale config
  const scaleConfig = resolveScale(scale)

  // Calculate Euclidean distance in PDF points
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const distanceInPoints = Math.sqrt(dx * dx + dy * dy)

  // Convert to millimeters: points → inches → mm
  const distanceInMm = distanceInPoints * (25.4 / scaleConfig.dpi)

  // Apply scale
  const realDistanceMm = distanceInMm * scaleConfig.multiplier

  return Math.round(realDistanceMm)
}

/**
 * Resolve scale from various input types
 */
function resolveScale(scale?: ScaleConfig | number): ScaleConfig {
  if (!scale) {
    // Fetch from settings store
    const settingsStore = useSettingStore()
    return settingsStore.getPdfScale
  }

  if (typeof scale === 'number') {
    return { multiplier: scale, displayFormat: `1:${scale}`, type: 'custom', dpi: 72 }
  }

  return scale
}
```

#### 2.5 Persist Scale with Annotations

```typescript
// types/annotations.ts

interface BaseAnnotation {
  id: string
  type: AnnotationType
  pageNum: number
  rotation: number

  /** Scale used when annotation was created (for recalculation) */
  scaleMultiplier?: number

  /** DPI used when annotation was created */
  dpi?: number
}
```

---

### Phase 3: Migration

#### 3.1 Backward Compatibility

```typescript
// Migration helper for existing data
function migrateScaleSettings(settings: unknown): GeneralSettings {
  if (typeof settings === 'object' && settings !== null) {
    const s = settings as Record<string, unknown>

    // Check for old string format
    if (typeof s.pdfScale === 'string') {
      return {
        ...s,
        pdfScale: parseScale(s.pdfScale)
      } as GeneralSettings
    }
  }

  return settings as GeneralSettings
}
```

#### 3.2 Consolidate Duplicate Code

1. Delete `parsePdfPageScale` from `utils/calculations.ts`
2. Update all imports to use `utils/scale.ts`
3. Remove duplicate calculation functions

---

### Phase 4: UI Integration

#### 4.1 Scale Selector Component

```vue
<!-- components/settings/ScaleSelector.vue -->
<template>
  <div class="scale-selector">
    <select v-model="selectedPreset" @change="onPresetChange">
      <option v-for="preset in presets" :key="preset" :value="preset">
        {{ preset }}
      </option>
      <option value="custom">Custom...</option>
    </select>

    <input
      v-if="isCustom"
      v-model="customValue"
      placeholder="e.g. 1:75"
      @blur="onCustomBlur"
    />
  </div>
</template>
```

#### 4.2 Scale Calibration Tool Integration

Connect with the planned [Scale Calibration Tool](./scale_calibration_tool.md):
- User draws line on known dimension
- Enters real-world measurement
- System calculates and sets scale automatically

---

## Implementation Tasks

### Research & Design
- [ ] Survey common PDF scale formats used in construction/architecture
- [ ] Decide on storage format (recommend Option C: structured object)
- [ ] Design type definitions
- [ ] Plan migration strategy for existing data

### Core Refactor
- [ ] Create `types/scale.ts` with ScaleConfig interface
- [ ] Create `utils/scale.ts` with parsing and validation
- [ ] Update `stores/settings.ts` to use ScaleConfig
- [ ] Update calculation functions to accept ScaleConfig
- [ ] Add scale persistence to annotation data

### Migration
- [ ] Create migration helper for old string format
- [ ] Remove duplicate `parsePdfPageScale` functions
- [ ] Update all imports across codebase
- [ ] Add backward compatibility tests

### Testing
- [ ] Unit tests for `parseScale()` with all formats
- [ ] Unit tests for `isValidScale()`
- [ ] Integration tests for calculation accuracy
- [ ] Migration tests for backward compatibility

### UI
- [ ] Create ScaleSelector component
- [ ] Add scale display to toolbar
- [ ] Integrate with Scale Calibration Tool

---

## Edge Cases to Handle

1. **Zero scale**: `1:0` - Should reject, not divide by zero
2. **Negative scale**: `-1:100` - Should reject
3. **Very large scale**: `1:1000000` - Warn about precision loss
4. **Very small scale**: `1:0.1` - Enlargement, handle correctly
5. **Invalid format**: `"banana"` - Graceful fallback with warning
6. **Empty input**: `""` - Use default
7. **Whitespace**: `" 1 : 100 "` - Trim and parse
8. **Decimal ratios**: `1:33.33` - Round or preserve?

---

## Success Criteria

1. ✅ Single source of truth for scale parsing
2. ✅ Type-safe scale configuration
3. ✅ Support for common scale formats
4. ✅ Validation with clear error messages
5. ✅ Backward compatible with existing data
6. ✅ Scale persisted with annotations
7. ✅ UI for changing scale
8. ✅ 100% test coverage for scale utilities
