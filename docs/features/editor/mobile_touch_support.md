# Mobile & Touch Device Support

## Overview

Enable full touch-based interaction for the PDF annotation editor on mobile devices and tablets. The application will be deployed via Tauri to iOS and Android, requiring all drawing tools, transform handles, and navigation to work seamlessly with touch controls.

## Target Platforms

- **iOS** (iPhone, iPad) via Tauri
- **Android** (phones, tablets) via Tauri
- **Web** (touch-enabled laptops, tablets)

## Core Touch Interactions

### Single Touch Gestures

| Gesture | Action |
|---------|--------|
| Tap | Select annotation / Place point (drawing tools) |
| Double-tap | Edit annotation (e.g., text editing) |
| Long-press | Context menu / Multi-select toggle |
| Drag | Move annotation / Draw / Pan viewport |
| Swipe | Pan viewport (when not on annotation) |

### Multi-Touch Gestures

| Gesture | Action |
|---------|--------|
| Pinch | Zoom in/out |
| Two-finger rotate | Rotate viewport (optional) |
| Two-finger drag | Pan viewport |
| Pinch on selection | Scale selected annotation(s) |
| Two-finger rotate on selection | Rotate selected annotation(s) |

## Component-Specific Touch Support

### Transform Handles (`app/components/Editor/Handles/`)

#### Transform.vue (Selection Box)
- **Touch drag on selection box** → Move selected annotation(s)
- **Double-tap on selection box** → Enter edit mode (text)
- Increase hit area size for touch (min 44x44px per Apple HIG)

#### Scale.vue (Resize Handles)
- **Touch drag on corner/edge handles** → Scale annotation
- Larger touch targets (minimum 44px)
- Visual feedback on touch start
- Handle positions adjusted for finger occlusion

#### Rotation.vue (Rotation Handle)
- **Touch drag on rotation handle** → Rotate annotation
- Extended hit area for easier grabbing
- Visual rotation indicator during drag
- Snap angles with haptic feedback (if available)

#### PdfRotate.vue (Page Rotation)
- Touch-friendly rotation controls
- Large tap targets for rotation buttons

### Drawing Tools

#### Point-Based Tools (Measure, Line, Area, Perimeter)
```typescript
// Touch event flow for point-based tools
interface TouchDrawingFlow {
  // Single tap places a point
  onTouchStart: (e: TouchEvent) => void

  // Move shows preview (finger position)
  onTouchMove: (e: TouchEvent) => void

  // Lift finger confirms point OR completes shape
  onTouchEnd: (e: TouchEvent) => void

  // Double-tap to complete polygon (Area, Perimeter)
  onDoubleTap: (e: TouchEvent) => void
}
```

#### Click-Based Tools (Count, Fill, Text)
- Single tap to place
- Adjust placement to account for finger position (offset above touch point)
- Preview under finger with slight offset

### Annotation Selection

- **Tap on annotation** → Select
- **Tap on empty space** → Deselect
- **Long-press on annotation** → Context menu
- **Long-press + tap others** → Multi-select
- **Drag selection** → Marquee select (two-finger or dedicated mode)

### Viewport Navigation

#### Pan
- Single finger drag on empty space
- Two-finger drag anywhere (overrides annotation interaction)
- Momentum/inertia scrolling

#### Zoom
- Pinch to zoom (centered on pinch midpoint)
- Double-tap to zoom in (cycle: fit → 100% → 200% → fit)
- Zoom controls in UI for precise control

#### Page Navigation
- Swipe left/right for page change (optional, can conflict with pan)
- Page indicator with tap to jump
- Thumbnail strip for quick navigation

## Implementation Strategy

### Event Handling Architecture

```typescript
// Unified pointer events (recommended approach)
interface JsonAnnotationLayerEvents {
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerCancel: (e: PointerEvent) => void
}

// Touch-specific handling when needed
interface TouchSpecificHandlers {
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
  onGestureStart?: (e: GestureEvent) => void  // Safari
  onGestureChange?: (e: GestureEvent) => void
  onGestureEnd?: (e: GestureEvent) => void
}
```

### Pointer Events vs Touch Events

**Recommended: Use Pointer Events**
- Unified API for mouse, touch, and stylus
- Better browser support now
- Simpler codebase

```typescript
// composables/editor/usePointerEvents.ts
export function usePointerEvents() {
  const activePointers = ref<Map<number, PointerEvent>>(new Map())

  function onPointerDown(e: PointerEvent) {
    activePointers.value.set(e.pointerId, e)

    if (activePointers.value.size === 1) {
      // Single pointer - drawing/selection
      handleSinglePointerStart(e)
    } else if (activePointers.value.size === 2) {
      // Two pointers - pinch/zoom/rotate
      handleMultiPointerStart()
    }
  }

  function onPointerMove(e: PointerEvent) {
    activePointers.value.set(e.pointerId, e)

    if (activePointers.value.size === 2) {
      handlePinchZoom()
    } else {
      handleSinglePointerMove(e)
    }
  }

  function onPointerUp(e: PointerEvent) {
    activePointers.value.delete(e.pointerId)
  }

  return { onPointerDown, onPointerMove, onPointerUp }
}
```

### Gesture Recognition

```typescript
// composables/editor/useGestureRecognition.ts
export function useGestureRecognition() {
  const gestureState = ref<GestureState>({
    type: 'none',
    startDistance: 0,
    startAngle: 0,
    startCenter: { x: 0, y: 0 }
  })

  function detectGesture(pointers: PointerEvent[]): GestureType {
    if (pointers.length === 1) {
      return 'drag'
    }

    if (pointers.length === 2) {
      const distance = getDistance(pointers[0], pointers[1])
      const angle = getAngle(pointers[0], pointers[1])

      // Determine if pinch, rotate, or pan based on movement
      return classifyTwoFingerGesture(distance, angle)
    }

    return 'none'
  }

  return { gestureState, detectGesture }
}
```

### Touch Target Sizes

```typescript
// constants/touch.ts
export const TOUCH_TARGETS = {
  // Minimum touch target size (Apple HIG: 44pt, Material: 48dp)
  MIN_SIZE: 44,

  // Handle sizes for touch
  SCALE_HANDLE_RADIUS: 22,  // Larger than mouse (was 8)
  ROTATION_HANDLE_RADIUS: 24,

  // Hit area expansion
  HIT_AREA_PADDING: 12,

  // Selection box drag area
  SELECTION_BOX_TOUCH_INSET: -10  // Expand inward
} as const
```

### Coordinate Transformation

```typescript
// Handle touch coordinate conversion
function getTouchPoint(e: TouchEvent, svg: SVGSVGElement): Point {
  const touch = e.touches[0] || e.changedTouches[0]
  const pt = svg.createSVGPoint()
  pt.x = touch.clientX
  pt.y = touch.clientY
  const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse())
  return { x: svgPoint.x, y: svgPoint.y }
}

// Handle finger occlusion offset
function getAdjustedTouchPoint(point: Point, toolType: string): Point {
  // Offset point above finger for visibility
  const FINGER_OFFSET = 20  // pixels

  if (toolType === 'count' || toolType === 'text') {
    return { x: point.x, y: point.y - FINGER_OFFSET }
  }

  return point
}
```

## UI Adaptations

### Responsive Handle Sizes

```vue
<!-- Scale handles with responsive sizing -->
<circle
  v-for="handle in handles"
  :key="handle.position"
  :cx="handle.x"
  :cy="handle.y"
  :r="isTouchDevice ? 16 : 8"
  class="scale-handle"
/>
```

### Touch-Friendly Toolbar

- Larger tool buttons (min 48px)
- Bottom toolbar on mobile (thumb-friendly)
- Collapsible/expandable tool groups
- Haptic feedback on tool selection

### Context Menu

- Long-press triggered
- Positioned above finger (not under)
- Large touch targets for menu items
- Swipe to dismiss

### On-Screen Controls

```vue
<!-- Mobile zoom controls -->
<div v-if="isMobile" class="mobile-controls">
  <button @click="zoomIn" class="touch-button">+</button>
  <span class="zoom-level">{{ zoomPercent }}%</span>
  <button @click="zoomOut" class="touch-button">-</button>
</div>
```

## Platform Detection

```typescript
// composables/useDeviceCapabilities.ts
export function useDeviceCapabilities() {
  const isTouchDevice = ref(false)
  const isTablet = ref(false)
  const isMobile = ref(false)
  const hasStylusSupport = ref(false)

  onMounted(() => {
    isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    const ua = navigator.userAgent
    isMobile.value = /iPhone|iPod|Android.*Mobile/i.test(ua)
    isTablet.value = /iPad|Android(?!.*Mobile)/i.test(ua) ||
                     (isTouchDevice.value && window.innerWidth >= 768)

    // Check for stylus support
    hasStylusSupport.value = navigator.maxTouchPoints > 1
  })

  return { isTouchDevice, isTablet, isMobile, hasStylusSupport }
}
```

## Stylus/Apple Pencil Support

- Pressure sensitivity for stroke width (future)
- Palm rejection (handled by OS)
- Hover preview (Apple Pencil 2)
- Tilt for brush angle (future)

## Performance Considerations

### Touch Event Optimization

```typescript
// Throttle touch move events
const throttledTouchMove = useThrottleFn((e: TouchEvent) => {
  handleTouchMove(e)
}, 16)  // ~60fps

// Passive event listeners where possible
element.addEventListener('touchmove', handler, { passive: true })

// Use CSS touch-action to prevent delays
// .annotation-layer { touch-action: none; }
```

### Rendering Optimization

- Reduce annotation detail during gestures
- Lower resolution preview during pinch-zoom
- GPU-accelerated transforms
- RequestAnimationFrame for smooth updates

## Tauri-Specific Considerations

### iOS
- Safe area insets for notch/home indicator
- Prevent Safari bounce scroll
- Handle keyboard appearance
- Support iPad multitasking (split view)

### Android
- Handle back button for cancel/undo
- Support different screen densities
- Handle soft keyboard
- Material Design touch feedback

## Testing Strategy

### Manual Testing
- Test on physical devices (not just simulators)
- Test with different finger sizes
- Test with stylus
- Test in landscape and portrait

### Automated Testing
- Playwright touch event simulation
- Gesture sequence testing
- Multi-touch scenarios

## Files to Modify

### Core Event Handling
- `app/components/Editor/AnnotationLayer.vue` - Add pointer/touch events
- `app/composables/editor/useEditorEventHandlers.ts` - Unified event handling
- `app/composables/editor/useEditorCoordinates.ts` - Touch coordinate conversion

### Transform Handles
- `app/components/Editor/Handles/Transform.vue` - Touch drag support
- `app/components/Editor/Handles/Scale.vue` - Touch resize
- `app/components/Editor/Handles/Rotation.vue` - Touch rotation

### Drawing Tools
- `app/composables/editor/tools/useDrawingTool.ts` - Touch drawing base
- Individual tool composables for touch-specific behavior

### New Files
- `app/composables/useDeviceCapabilities.ts` - Device detection
- `app/composables/editor/useGestureRecognition.ts` - Gesture handling
- `app/composables/editor/usePinchZoom.ts` - Pinch-to-zoom
- `app/constants/touch.ts` - Touch target constants

## Acceptance Criteria

### Basic Touch Support
- [ ] Single tap selects annotation
- [ ] Double-tap enters edit mode
- [ ] Drag moves selected annotation
- [ ] Tap on empty space deselects

### Transform Handles
- [ ] Touch drag on selection box moves annotation
- [ ] Touch drag on scale handles resizes
- [ ] Touch drag on rotation handle rotates
- [ ] Handle sizes appropriate for touch (44px min)

### Multi-Touch Gestures
- [ ] Pinch to zoom viewport
- [ ] Two-finger pan viewport
- [ ] Pinch on selection to scale (optional)

### Drawing Tools
- [ ] All point-based tools work with tap
- [ ] Preview follows finger
- [ ] Double-tap completes polygons
- [ ] Cancel gesture (three-finger tap or shake)

### Viewport Navigation
- [ ] Pan with single finger on empty space
- [ ] Zoom with pinch gesture
- [ ] Page navigation works

### Platform Support
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Works in Tauri iOS build
- [ ] Works in Tauri Android build
- [ ] Graceful fallback on non-touch devices
