import { createSharedComposable } from "@vueuse/core"

export interface DateRange {
  start: Date
  end: Date
}

const DEFAULT_START = new Date("2023-01-01T00:00:00")

function _useDateRange() {
  const dateRange = ref<DateRange>({
    start: DEFAULT_START,
    end: new Date()
  })

  const isDefaultRange = computed(() => {
    return dateRange.value.start.getTime() === DEFAULT_START.getTime()
  })

  const hasDateRange = computed(() => !isDefaultRange.value)

  const dateRangeLabel = computed(() => {
    if (isDefaultRange.value) return "All time"
    const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    return `${fmt(dateRange.value.start)} – ${fmt(dateRange.value.end)}`
  })

  const setDateRange = (range: DateRange) => {
    dateRange.value = { start: new Date(range.start), end: new Date(range.end) }
  }

  const resetToAllTime = () => {
    dateRange.value = { start: DEFAULT_START, end: new Date() }
  }

  const applyPreset = (days: number) => {
    setDateRange({
      start: new Date(Date.now() - days * 864e5),
      end: new Date()
    })
  }

  const formatForQuery = (key: "start" | "end") => {
    if (isDefaultRange.value) return undefined
    return dateRange.value[key].toISOString().split("T")[0]
  }

  return {
    dateRange,
    isDefaultRange,
    hasDateRange,
    dateRangeLabel,
    setDateRange,
    resetToAllTime,
    applyPreset,
    formatForQuery
  }
}

export const useDateRange = createSharedComposable(_useDateRange)
