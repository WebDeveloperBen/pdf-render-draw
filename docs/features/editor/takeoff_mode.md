# Takeoff Mode

## Priority
**Smart Feature**

## Status
⏳ Planned

## Description
Automatic measurement summation for quantity takeoffs. Sum similar measurements automatically.

## Use Cases
- Calculate total wall length
- Sum all floor areas
- Aggregate counts by type
- Export for estimating software

## Features

### Core Functionality
- Automatically sum similar measurements
- Group by type, color, or custom tag
- Running totals as you work
- Export summaries

### Grouping Options
- By annotation type (all measures, all areas)
- By color/category
- By custom tag/label
- By page or document-wide

### Summaries
- Total wall length (all Measure annotations)
- Total floor area (all Area annotations)
- Total window count (all Count annotations)
- Custom groupings

### Export
- CSV format for spreadsheets
- PDF summary report
- Clipboard for pasting
- Integration with estimating software

## Implementation Notes

### Data Aggregation
```typescript
interface TakeoffSummary {
  type: AnnotationType
  groupBy: string              // Color, tag, or 'all'
  items: {
    id: string
    value: number
    unit: string
    label?: string
  }[]
  total: number
  unit: string
}

function calculateTakeoff(
  annotations: Annotation[],
  groupBy: 'type' | 'color' | 'tag'
): TakeoffSummary[] {
  // Group and sum annotations
}
```

### UI Components
- Takeoff panel (sidebar or modal)
- Group selector
- Running totals display
- Export buttons
- Filter by page/selection

### Real-time Updates
- Update totals as annotations are added/modified/deleted
- Computed values based on annotation store

## Implementation Complexity
**Medium** - Aggregation logic is straightforward. UI design needs thought.

## Priority Justification
High-value feature for professional use. Transforms individual measurements into actionable quantities.
