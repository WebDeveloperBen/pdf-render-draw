# Count Tool

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Click to place numbered markers (1, 2, 3...) for counting elements on plans.

## Use Cases
- Count windows, doors, fixtures, outlets, columns, etc.
- Track quantities for estimating and takeoffs
- Group counts by type for different elements

## Features

### Core Functionality
- Click to place numbered markers
- Shows running total per annotation type
- Auto-increment numbers

### Grouping & Organization
- Group by type (different colors for windows vs doors)
- Custom labels per count group
- Category management

### Export & Reporting
- Export count summary
- CSV export for estimating software
- Summary view showing all counts

## Implementation Notes

### Data Structure
```typescript
interface CountAnnotation {
  id: string
  type: 'count'
  pageNum: number
  x: number
  y: number
  label: string      // e.g., "Windows", "Doors"
  number: number     // The count number displayed
  color: string
  groupId: string    // Links related counts together
}
```

### UI Components
- Count marker (circle with number)
- Count group selector/creator
- Running total display
- Summary panel

## Priority Justification
High value, straightforward implementation. Essential for construction takeoffs.
