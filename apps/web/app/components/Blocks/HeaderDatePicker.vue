<script setup lang="ts">
import { CalendarDays, RotateCcw } from "lucide-vue-next"

const { dateRange, isDefaultRange, hasDateRange, dateRangeLabel, setDateRange, resetToAllTime, applyPreset } =
  useDateRange()

const dates = ref({
  start: new Date(dateRange.value.start),
  end: new Date(dateRange.value.end)
})

const datepickerRef = useTemplateRef("datepicker")

const { width } = useWindowSize()
const columns = computed(() => (width.value < 640 ? 1 : 2))

// Only sync to global state when popover closes (avoids mid-render crashes)
function onPopoverHide() {
  if (dates.value?.start && dates.value?.end) {
    setDateRange({ start: new Date(dates.value.start), end: new Date(dates.value.end) })
  }
}

const presets = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 }
]

function onApplyPreset(days: number) {
  const range = {
    start: new Date(Date.now() - days * 864e5),
    end: new Date()
  }
  dates.value = range
  setDateRange(range)
  datepickerRef.value?.datepickerRef?.move(range.start)
}

function onResetToAllTime() {
  const range = { start: new Date("2023-01-01T00:00:00"), end: new Date() }
  dates.value = range
  resetToAllTime()
  datepickerRef.value?.datepickerRef?.move(range.start)
}
</script>

<template>
  <UiDatepicker
    ref="datepicker"
    v-model.range="dates"
    :columns="columns"
    :popover="{ placement: 'bottom-end' }"
    @popover-did-hide="onPopoverHide"
  >
    <template #default="{ togglePopover }">
      <UiButton
        variant="outline"
        :class="[hasDateRange && 'border-primary/30 bg-primary/5 text-primary']"
        @click="togglePopover"
      >
        <CalendarDays
          :class="['size-4 mr-2', hasDateRange ? 'text-primary' : 'text-muted-foreground']"
        />
        {{ dateRangeLabel }}
      </UiButton>
    </template>
    <template #footer>
      <div class="flex items-center justify-between border-t border-border p-2">
        <div class="flex gap-1">
          <UiButton
            variant="ghost"
            size="xs"
            :class="[isDefaultRange && 'bg-primary/10 text-primary']"
            @click="onResetToAllTime"
          >
            All
          </UiButton>
          <UiButton
            v-for="preset in presets"
            :key="preset.label"
            variant="ghost"
            size="xs"
            @click="onApplyPreset(preset.days)"
          >
            {{ preset.label }}
          </UiButton>
        </div>
        <UiButton variant="ghost" size="xs" class="text-muted-foreground" @click="onResetToAllTime">
          <RotateCcw class="size-3 mr-1" />
          Reset
        </UiButton>
      </div>
    </template>
  </UiDatepicker>
</template>
