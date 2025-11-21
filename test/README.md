# Testing Guide

This project uses [Vitest](https://vitest.dev/) with [@nuxt/test-utils](https://nuxt.com/docs/getting-started/testing) for testing.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (recommended for development)
pnpm test --watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Test Structure

Tests are colocated with the code they test:

```
app/
├── composables/
│   └── tools/
│       ├── useTextTool.ts
│       └── useTextTool.spec.ts        # Tests for text tool
├── stores/
│   ├── annotations.ts
│   └── annotations.spec.ts            # Tests for annotation store
└── utils/
    ├── calculations.ts
    └── calculations.spec.ts           # Tests for calculations
```

## What We Test

### 1. **Critical Regressions**

Tests that catch bugs we've encountered:

- **Text Rotation Stamp Behavior** (`useTextTool.spec.ts`)
  - Text rotation is baked into annotation at creation time
  - Text appears upright when placed, then rotates with PDF

- **Page Awareness** (`useTextTool.spec.ts`, `annotations.spec.ts`)
  - Annotations are filtered by page number
  - Only current page annotations are visible

### 2. **Business Logic**

- **Calculations** (`calculations.spec.ts`)
  - Distance measurements are accurate
  - Area calculations handle different shapes
  - Centroid and midpoint calculations

### 3. **Store Operations**

- **CRUD Operations** (`annotations.spec.ts`)
  - Adding, updating, deleting annotations
  - Retrieving annotations by ID, type, and page
  - Selection state management

## Writing Tests

### Testing Composables

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMyComposable } from './useMyComposable'

describe('useMyComposable', () => {
  beforeEach(() => {
    // Mock stores or dependencies
    vi.stubGlobal('useAnnotationStore', () => ({
      // mock implementation
    }))
  })

  it('should do something', () => {
    const composable = useMyComposable()
    expect(composable.something.value).toBe(expected)
  })
})
```

### Testing Stores

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useMyStore } from './myStore'

describe('My Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should update state', () => {
    const store = useMyStore()
    store.doSomething()
    expect(store.state).toBe(expected)
  })
})
```

### Testing Utilities

```typescript
import { describe, it, expect } from 'vitest'
import { myUtilFunction } from './myUtil'

describe('myUtilFunction', () => {
  it('should calculate correctly', () => {
    const result = myUtilFunction(input)
    expect(result).toBeCloseTo(expected, 2)
  })
})
```

## Coverage

Coverage reports are generated in the `coverage/` directory when running `pnpm test:coverage`.

Target coverage:
- **Utilities**: 90%+ (pure functions, easy to test)
- **Stores**: 80%+ (business logic)
- **Composables**: 70%+ (may have complex DOM dependencies)

## Best Practices

1. **Colocate tests** - Keep test files next to the code they test
2. **Test behavior, not implementation** - Test what the code does, not how it does it
3. **Use descriptive test names** - `it('should calculate area of rectangle')` not `it('works')`
4. **Mock external dependencies** - Mock stores, APIs, and browser APIs
5. **Test edge cases** - Empty arrays, null values, extreme numbers
6. **Keep tests fast** - Unit tests should run in milliseconds

## Common Patterns

### Mocking Stores

```typescript
const mockStore = {
  getAnnotationsByTypeAndPage: vi.fn().mockReturnValue([]),
  addAnnotation: vi.fn(),
}

vi.stubGlobal('useAnnotationStore', () => mockStore)
```

### Testing Reactive Values

```typescript
const composable = useMyComposable()

// Test initial value
expect(composable.value.value).toBe(initialValue)

// Trigger change
composable.doSomething()

// Test updated value
expect(composable.value.value).toBe(newValue)
```

### Testing Floating Point Calculations

```typescript
// Use toBeCloseTo for floating point comparisons
expect(distance).toBeCloseTo(35.28, 2) // 2 decimal places
```

## CI/CD Integration

Tests run automatically on:
- Every commit (pre-commit hook - optional)
- Every pull request (GitHub Actions - optional)
- Before deployment (deployment pipeline - optional)

## Troubleshooting

### Tests failing with "Cannot find module"

Make sure you've run `pnpm install` and `pnpm postinstall` to generate Nuxt types.

### Tests timeout

Increase timeout in `vitest.config.ts`:

```typescript
export default defineVitestConfig({
  test: {
    testTimeout: 10000, // 10 seconds
  }
})
```

### Mock not working

Make sure to call `vi.stubGlobal()` in `beforeEach()`, not in the test itself.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Nuxt Testing Documentation](https://nuxt.com/docs/getting-started/testing)
- [@nuxt/test-utils](https://github.com/nuxt/test-utils)
- [Vue Test Utils](https://test-utils.vuejs.org/)
