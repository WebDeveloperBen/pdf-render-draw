# frontend-design

Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.

---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Project-Specific Tech Stack

This project uses:
- **Nuxt 4** with TypeScript strict mode
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **UI-Thing** (shadcn-vue style) components in `app/components/ui/`
- **Reka UI** as headless component primitives
- **tailwind-variants** (`tv()`) for component styling with variants
- **@nuxt/icon** with Iconify - use `<Icon name="lucide:icon-name" />` format
- **vee-validate** with zod for forms
- **motion-v** for animations in Vue

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font. Consider: DM Serif Display, Playfair Display, Bebas Neue, Raleway, Josefin Sans, Crimson Pro, Montserrat Alternates, Spectral, Archivo Black, Cormorant Garamond, etc.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables (Tailwind v4 format: `--color-primary`, etc.) for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Consider thematic color schemes: industrial (slate/orange), organic (sage/terracotta), luxury (navy/gold), playful (coral/mint), etc.
- **Motion**: Use `motion-v` for Vue animations and effects. Prioritize CSS-only solutions when possible. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density. Consider: offset grids, diagonal sections, overlapping cards, floating elements, broken symmetry.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like:
  - Gradient meshes with multiple color stops
  - Noise textures via CSS filters or SVG patterns
  - Geometric patterns (dots, grids, lines)
  - Layered transparencies with backdrop-filter
  - Dramatic shadows (box-shadow with multiple layers)
  - Decorative borders and dividers
  - Custom cursor styles
  - Grain overlays for analog warmth

## Component Patterns

When creating UI components:
- Use `tv()` from tailwind-variants for variant-based styling
- Export styled variants for reuse (like `buttonStyles`)
- Use semantic Tailwind classes: `bg-primary`, `text-muted-foreground`, `border-input`
- Leverage UI-Thing components as building blocks: `<UiButton>`, `<UiCard>`, `<UiInput>`, etc.
- Use `<Icon name="lucide:icon-name" />` for all icons
- Wrap forms with vee-validate for validation

Example component structure:
```vue
<script setup lang="ts">
import { tv } from 'tailwind-variants'

const cardStyles = tv({
  base: 'rounded-lg border backdrop-blur-sm transition-all duration-300',
  variants: {
    variant: {
      default: 'bg-card text-card-foreground shadow-sm',
      ghost: 'border-transparent hover:border-border',
      elevated: 'bg-card shadow-lg hover:shadow-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface Props {
  variant?: 'default' | 'ghost' | 'elevated'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})
</script>

<template>
  <div :class="cardStyles({ variant })">
    <slot />
  </div>
</template>
```

## What to AVOID

NEVER use generic AI-generated aesthetics:
- Overused font families: Inter, Roboto, Arial, system fonts, Space Grotesk
- Cliched color schemes: purple gradients on white, blue-gradient-everything
- Predictable layouts: centered cards with equal spacing, symmetrical everything
- Cookie-cutter design that lacks context-specific character
- Timid color choices: all pastels, all neutrals, no contrast
- Default component libraries without customization

## Design Philosophy

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between:
- Light and dark themes
- Different font pairings
- Contrasting aesthetics (minimal vs. maximal, organic vs. geometric)
- NEVER converge on common choices across generations

**IMPORTANT**: Match implementation complexity to the aesthetic vision:
- **Maximalist designs** need elaborate code with extensive animations, layered effects, rich textures
- **Minimalist designs** need restraint, precision, careful spacing, subtle typography details, micro-interactions
- Elegance comes from executing the vision well, not from adding more features

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Implementation Checklist

Before delivering:
- [ ] Clear aesthetic direction chosen and documented
- [ ] Custom typography loaded (Google Fonts, local fonts, or web fonts)
- [ ] Cohesive color scheme using CSS variables
- [ ] At least one memorable visual detail or interaction
- [ ] Responsive design considerations
- [ ] Accessibility basics (contrast, focus states, semantic HTML)
- [ ] Production-ready code (no console logs, TODOs, or placeholders)
- [ ] TypeScript types defined for all props and data structures
