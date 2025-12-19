/**
 * Composable for managing breadcrumb labels
 * Pages can use this to provide custom labels for dynamic route segments (like UUIDs)
 */

/**
 * Check if a string looks like a UUID
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export function useBreadcrumbs() {
  const route = useRoute()

  // Global state for dynamic breadcrumb labels (keyed by route segment)
  const dynamicLabels = useState<Record<string, string>>("breadcrumb-labels", () => ({}))

  /**
   * Get a display label for a route segment
   */
  function getSegmentLabel(segment: string): string {
    // Check dynamic labels first (for UUIDs or other dynamic segments)
    const dynamicLabel = dynamicLabels.value[segment]
    if (dynamicLabel) {
      return dynamicLabel
    }

    // If it's a UUID and we don't have a label, show truncated version
    if (isUUID(segment)) {
      return segment.slice(0, 8) + "..."
    }

    // Default: capitalize first letter and replace hyphens with spaces
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  }

  /**
   * Set a custom label for a dynamic route segment
   * @param segment The route segment (e.g., the UUID)
   * @param label The display label (e.g., project name)
   */
  const setLabel = (segment: string, label: string) => {
    dynamicLabels.value[segment] = label
  }

  /**
   * Clear a dynamic label
   */
  const clearLabel = (segment: string) => {
    const { [segment]: _, ...rest } = dynamicLabels.value
    dynamicLabels.value = rest
  }

  /**
   * Clear all dynamic labels
   */
  const clearAllLabels = () => {
    dynamicLabels.value = {}
  }

  /**
   * Generate breadcrumb items from the current route
   */
  const items = computed(() => {
    const paths = route.path.split("/").filter(Boolean)
    return paths.map((segment, index) => ({
      label: getSegmentLabel(segment),
      link: "/" + paths.slice(0, index + 1).join("/")
    }))
  })

  return {
    items,
    setLabel,
    clearLabel,
    clearAllLabels
  }
}
