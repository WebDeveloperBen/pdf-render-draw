# Export Document Modal

## Overview

The export document modal allows users to export annotated documents in various formats with customizable options.

## Trigger

- Export button in editor toolbar
- File menu > Export
- Keyboard shortcut: Cmd/Ctrl + E

## Features

### Export Format Selection

- **PDF (Annotated)**
  - Original PDF with annotations burned in
  - Preserves original quality
  - Annotations become part of document

- **PDF (Layered)**
  - Annotations on separate layer
  - Can be toggled in PDF viewers
  - Editable in compatible software

- **Image Formats**
  - PNG - Lossless, transparent background option
  - JPEG - Compressed, smaller file size
  - SVG - Vector format, scalable

- **Data Export**
  - JSON - All annotation data
  - CSV - Measurements and counts
  - Excel - Formatted spreadsheet

### Page Selection

- **All Pages** - Export entire document
- **Current Page** - Export visible page only
- **Page Range** - Custom range (e.g., 1-5, 8, 10-12)
- **Pages with Annotations** - Only pages that have annotations

### Export Options

- **Quality/Resolution**
  - Screen (72 DPI)
  - Print (150 DPI)
  - High Quality (300 DPI)
  - Custom DPI input

- **Annotation Options**
  - Include annotations (toggle)
  - Include measurements (toggle)
  - Include labels (toggle)
  - Annotation opacity slider

- **Page Options**
  - Original size
  - Fit to page (A4, Letter, etc.)
  - Custom dimensions

- **Filename**
  - Default: {project-name}-export
  - Editable text input
  - Auto-append format extension

### Preview

- Live preview of export result
- Page thumbnail with annotations
- Toggle to show/hide annotations in preview

### Export Progress

- Progress bar for multi-page exports
- Page counter (e.g., "Exporting page 3 of 10")
- Cancel button
- Estimated time remaining

### Actions

- **Export** - Start export process
- **Cancel** - Close modal without exporting

## UI Components

- Format selection cards/tabs
- Page range input
- Quality dropdown
- Toggle switches for options
- Preview panel
- Progress bar
- Filename input

## API Endpoints

- `POST /api/documents/:id/export` - Generate export
- `GET /api/documents/:id/export/:jobId` - Check export status
- `GET /api/documents/:id/export/:jobId/download` - Download result

## Export Process

1. User configures export options
2. User clicks "Export"
3. Request sent to server
4. Server processes document
5. Progress updates via polling/websocket
6. On complete: Auto-download or show download button
7. On error: Display error message

## Error Handling

- Invalid page range
- Export failed (server error)
- File too large
- Timeout for large documents

## Acceptance Criteria

- [ ] All export formats work correctly
- [ ] Page selection options function
- [ ] Quality settings affect output
- [ ] Annotation toggles work
- [ ] Preview updates with options
- [ ] Progress shows during export
- [ ] Export can be cancelled
- [ ] File downloads successfully
- [ ] Filename is customizable
- [ ] Error states handled gracefully
