# Tool Plugin Architecture

## Overview

This codebase uses a **plugin architecture** for annotation tools. Each tool is self-contained and registers itself with the system. This allows easy addition of new tools without modifying core components.

## Core Concepts

### 1. Tool Registry (`useToolRegistry`)
Central registry where all tools register themselves. SvgAnnotationLayer auto-discovers and renders registered tools.

### 2. Base Annotation Component (`BaseAnnotation.vue`)
All annotation types should use or extend this base component which provides:
- Selection handling
- Transform handles (rendered per-annotation, not as overlay)
- Event delegation (double-click, context menu)
- Common slots for customization

### 3. Transform Inside Annotations
Transform handles are rendered **inside each annotation** when selected, not as a separate overlay. This ensures:
- Natural event flow (events hit annotation first)
- No event interception issues
- Each tool owns its complete behavior stack

## Creating a New Tool

### Step 1: Create Tool Composable

```typescript
// composables/tools/useMyTool.ts
import { registerTool } from "~/composables/useToolRegistry"
import MyToolComponent from "~/components/tools/MyTool.vue"

export function useProvideMyTool() {
  const annotationStore = useAnnotationStore()

  // Tool state
  const completed = computed(() =>
    annotationStore.getAnnotationsByTypeAndPage("myTool", currentPage)
  )

  // Tool-specific logic
  function handleClick(e: MouseEvent) {
    // Create annotation
  }

  function handleDoubleClick(id: string) {
    // Edit annotation
  }

  return {
    completed,
    handleClick,
    handleDoubleClick
  }
}

// Register the tool (runs when module is imported)
registerTool({
  type: "myTool",
  component: MyToolComponent,
  onDoubleClick: (id) => {
    const tool = useProvideMyTool()
    tool.handleDoubleClick(id)
  }
})

export { useProvideMyTool, useMyToolState }
```

### Step 2: Create Tool Component

```vue
<!-- components/tools/MyTool.vue -->
<script setup lang="ts">
import { useMyToolState } from "~/composables/tools/useMyTool"

const tool = useMyToolState()
if (!tool) {
  throw new Error('MyTool must be used within SvgAnnotationLayer')
}

const { completed } = tool
</script>

<template>
  <g class="my-tool">
    <!-- Render each annotation using BaseAnnotation -->
    <BaseAnnotation
      v-for="annotation in completed"
      :key="annotation.id"
      :annotation="annotation"
    >
      <!-- Customize the content slot -->
      <template #content="{ annotation, isSelected }">
        <!-- Your tool's rendering logic -->
        <rect
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          fill="blue"
        />
      </template>

      <!-- Optionally customize transform handles -->
      <template #transform="{ annotation, isSelected }">
        <HandlesTransform v-if="isSelected" :annotation="annotation" />
      </template>
    </BaseAnnotation>
  </g>
</template>
```

### Step 3: Auto-Registration

Import the tool composable in `SvgAnnotationLayer.vue` to auto-register:

```typescript
// The import triggers registration
import { useProvideMyTool } from "~/composables/tools/useMyTool"
```

That's it! The tool will automatically:
- ✅ Render in SvgAnnotationLayer
- ✅ Handle events via BaseAnnotation
- ✅ Show transform handles when selected
- ✅ Respond to double-clicks if handler registered

## Global Tools (Exceptions)

### Transform & Select

These are **meta-tools** that work across all annotation types:

- **Transform**: Rendered per-annotation (inside BaseAnnotation), but uses shared `useTransformBase()` logic
- **Select**: Selection mode that works on any annotation type

## Benefits

### ✅ Tool Isolation
- Each tool is self-contained
- Tools don't know about each other
- No tight coupling

### ✅ Easy Extension
- Create tool → Register → It works
- No need to modify SvgAnnotationLayer or other core files
- Natural event flow through component tree

### ✅ Scalable
- Add 40+ tools without architectural changes
- Each tool owns its complete behavior
- Base functionality shared via composable

### ✅ Type-Safe
- TypeScript enforces tool definition contracts
- Compile-time checks for missing handlers

## Migration Path

To migrate existing tools:

1. Keep composable logic as-is
2. Wrap component rendering in `<BaseAnnotation>`
3. Call `registerTool()` in composable file
4. Remove hardcoded tool rendering from SvgAnnotationLayer
5. Import tool composable to trigger registration

## Event Flow

```
User Double-Clicks
  ↓
BaseAnnotation receives event
  ↓
Checks tool registry for handler
  ↓
Calls tool.onDoubleClick(id)
  ↓
Tool handles its own logic
```

No global event buses, no manual wiring, no registries to manage per-component. Just register once and it works.
