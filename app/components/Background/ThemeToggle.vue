<script setup lang="ts">
const colorMode = useColorMode()

function toggleTheme() {
  colorMode.preference = colorMode.value === "light" ? "dark" : "light"
  document.documentElement.setAttribute("data-theme", colorMode.preference)
}
</script>

<template>
  <button
    id="theme-toggle"
    class="theme-toggle"
    :title="'Toggles light & dark'"
    :aria-label="colorMode.preference"
    aria-live="polite"
    type="button"
    @click="toggleTheme"
  >
    <svg class="sun-and-moon" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
      <mask id="moon-mask" class="moon">
        <rect x="0" y="0" width="100%" height="100%" fill="white" />
        <circle cx="24" cy="10" r="6" fill="black" />
      </mask>
      <circle class="sun" cx="12" cy="12" r="6" mask="url(#moon-mask)" fill="currentColor" />
      <g class="sun-beams" stroke="currentColor">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  --icon-fill: #fbbf24;
  --icon-fill-hover: #fde68a;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  padding: 0.5rem;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  outline: none;
  transition: background 0.2s;
}

.theme-toggle:is(:hover, :focus-visible) {
  background: rgba(251, 191, 36, 0.1);
}

.sun-and-moon > :is(.moon, .sun, .sun-beams) {
  transform-origin: center;
}
.sun-and-moon > :is(.moon, .sun) {
  fill: var(--icon-fill);
}
.theme-toggle:is(:hover, :focus-visible) > .sun-and-moon > :is(.moon, .sun) {
  fill: var(--icon-fill-hover);
}
.sun-and-moon > .sun-beams {
  stroke: var(--icon-fill);
  stroke-width: 2px;
}
.theme-toggle:is(:hover, :focus-visible) .sun-and-moon > .sun-beams {
  stroke: var(--icon-fill-hover);
}
[data-theme="dark"] .sun-and-moon > .sun {
  transform: scale(1.75);
}
[data-theme="dark"] .sun-and-moon > .sun-beams {
  opacity: 0;
}
[data-theme="dark"] .sun-and-moon > .moon > circle {
  transform: translateX(-7px);
}
@supports (cx: 1) {
  [data-theme="dark"] .sun-and-moon > .moon > circle {
    cx: 17;
    transform: translateX(0);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .sun-and-moon > .sun {
    transition: transform 0.5s cubic-bezier(0.23, 1.15, 0.47, 1.15);
  }
  .sun-and-moon > .sun-beams {
    transition:
      transform 0.5s cubic-bezier(0.16, 1.08, 0.33, 1),
      opacity 0.5s cubic-bezier(0.4, 0, 0.6, 1);
  }
  .sun-and-moon .moon > circle {
    transition: transform 0.25s cubic-bezier(0.16, 1.08, 0.33, 1);
  }
  @supports (cx: 1) {
    .sun-and-moon .moon > circle {
      transition: cx 0.25s cubic-bezier(0.16, 1.08, 0.33, 1);
    }
  }
  [data-theme="dark"] .sun-and-moon > .sun {
    transition-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
    transition-duration: 0.25s;
    transform: scale(1.75);
  }
  [data-theme="dark"] .sun-and-moon > .sun-beams {
    transition-duration: 0.15s;
    transform: rotateZ(-25deg);
  }
  [data-theme="dark"] .sun-and-moon > .moon > circle {
    transition-duration: 0.5s;
    transition-delay: 0.25s;
  }
}
</style>
