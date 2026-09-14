---
name: Kinetic Console
colors:
  surface: '#161024'
  surface-dim: '#161024'
  surface-bright: '#3d364c'
  surface-container-lowest: '#110b1f'
  surface-container-low: '#1e182d'
  surface-container: '#221c31'
  surface-container-high: '#2d273c'
  surface-container-highest: '#383147'
  on-surface: '#e9defa'
  on-surface-variant: '#c4c9b0'
  inverse-surface: '#e9defa'
  inverse-on-surface: '#342d43'
  outline: '#8e937d'
  outline-variant: '#444936'
  surface-tint: '#aad636'
  primary: '#f9ffdf'
  on-primary: '#273500'
  primary-container: '#c2ef4e'
  on-primary-container: '#516b00'
  inverse-primary: '#4e6700'
  secondary: '#ffb1c8'
  on-secondary: '#640233'
  secondary-container: '#821f4a'
  on-secondary-container: '#ff95b8'
  tertiary: '#fffaff'
  on-tertiary: '#2d1d81'
  tertiary-container: '#e1dbff'
  on-tertiary-container: '#6055b6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c5f251'
  primary-fixed-dim: '#aad636'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#3a4d00'
  secondary-fixed: '#ffd9e2'
  secondary-fixed-dim: '#ffb1c8'
  on-secondary-fixed: '#3e001d'
  on-secondary-fixed-variant: '#821f4a'
  tertiary-fixed: '#e4dfff'
  tertiary-fixed-dim: '#c7bfff'
  on-tertiary-fixed: '#170065'
  on-tertiary-fixed-variant: '#443798'
  background: '#161024'
  on-background: '#e9defa'
  surface-variant: '#383147'
  surface-canvas-dark: '#1f1633'
  surface-canvas-light: '#ffffff'
  surface-night: '#150f23'
  accent-violet-deep: '#422082'
  accent-violet-mid: '#79628c'
  hairline-violet: '#362d59'
  hairline-cool: '#cfcfdb'
  hairline-cloud: '#e5e7eb'
  on-dark-muted: '#bdb8c0'
  on-dark-faint: '#3f3849'
  ring-focus: '#9dc1f5'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 88px
    fontWeight: '700'
    lineHeight: 105px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 60px
    fontWeight: '700'
    lineHeight: 66px
    letterSpacing: -0.01em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
  body-lg:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-sm:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-btn:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-eyebrow:
    fontFamily: Rubik
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 21px
    letterSpacing: 0.08em
  label-micro:
    fontFamily: Rubik
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.05em
  code-prompt:
    fontFamily: Space Mono
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  code-prompt-bold:
    fontFamily: Space Mono
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-xxl: 2rem
  space-section: 6rem
---

## Brand & Style

This design system fuses the raw, unsparing precision of a developer debugger with the vibrant, expressive kineticism of a next-generation generative video studio. Tailored for creative engineers, motion artists, and technical directors manipulating AI generation graphs, the interface evokes the sensation of operating an electrified analog-digital synthesis console: authoritative, technical, yet charged with creative mischief.

The aesthetic blends **High-Contrast Brutalism** with **Modern Developer Utility**. It deliberately rejects generic corporate pastel gradients in favor of an unapologetic deep cosmic ground punctured by hyper-saturated electric highlights. The emotional posture is confident, razor-sharp, and irreverent. Micro-interactions snap with zero-latency command-line immediacy, while visual storytelling pairs dense monospaced prompt telemetry alongside punchy display headlines and sticker-like vector artifacts.

## Colors

The system uses a strict **two-polarity canvas architecture** rather than fluid theme-switching:
- **Dark Polarity Canvas (`surface-canvas-dark` #1f1633 / `surface-night` #150f23)**: Serves as the primary operational environment for video rendering timelines, prompt engineering blocks, node trees, and high-impact hero displays. Cards and tool panels nest inside darker midnight voids bordered by structural hairline strokes.
- **Light Polarity Canvas (`surface-canvas-light` #ffffff)**: Deployed selectively for dense transactional decision matrixes, enterprise documentation, billing, and export inspection tables.

### Role Assignments
- **Primary (`#c2ef4e` Electric Lime)**: Reserved strictly for typographic syntax highlighting, active generation badges, kinetic prompt chips, and signal accents. It is deliberately prohibited from being used as a generic full-surface background fill to preserve its visual voltage.
- **Secondary (`#fa7faa` Hot Pink)**: Punctuation color for seed indicators, rendering errors/warnings, timeline keyframes, and vector stickers.
- **Tertiary (`#6a5fc1` Electric Violet)**: Used for interactive inline links, active parameters, and stateful focus accents.
- **Neutral (`#150f23` Midnight Violet)**: Foundational anchor tone. Provides infinite-black depth with a chromatic violet undertone.

## Typography

The typographic hierarchy implements a rigorous split:
- **Space Grotesk** drives all major titles and numerical generation figures, providing a chunky, structural, brutalist edge reminiscent of mid-century technical handbooks and early digital apparatuses.
- **Rubik** delivers humanist readability and rounded geometric clarity for all UI controls, body explanations, parameters, and metadata chips.
- **Space Mono** handles all prompt inputs, token parameters, model parameters (CFG scale, seed, motion steps), and telemetry logs.

### Stylistic Mechanics
- **Syntax Inline Highlighting**: Words wrapped in generative emphasis chips inherit zero vertical padding and high-contrast lime surrounds directly inline with display titles.
- **Micro Labels & Buttons**: All navigation triggers, eyebrows, and primary button labels are rendered in uppercase tracking (`letter-spacing: 0.05em` to `0.08em`) to mirror console commands and hardware legend plates.

## Layout & Spacing

The layout is architected around an **8px base grid** (with atomic subdivisions of 2px and 4px for tight console metadata) anchored within a centered 1152px maximum container width.

### Responsive Grids & Viewports
- **Desktop (≥ 1152px)**: 12-column fluid grid, 16px (`1rem`) gutters, 32px (`2rem`) margins. Sections breathe with 96px (`6rem`) vertical cadence.
- **Tablet / Laptop (768px – 1151px)**: 8-column layout, 16px gutters, 24px margins. Section spacing compresses to 64px (`4rem`).
- **Mobile (≤ 767px)**: 4-column layout, 12px (`0.75rem`) gutters, 16px (`1rem`) margins. Section rhythm collapses to 40px–48px.

Studio canvas areas (video generation viewport, node-graph canvasing) bypass fixed document boundaries and dock directly to screen edges using safe-area constraints.

## Elevation & Depth

This design system deliberately eschews naturalistic, multi-stop blurred shadows in favor of **structural containment, hairline demarcation, and inverted atmospheric glows**:

- **Layer 0 (Base Canvas)**: Flat `surface-canvas-dark` (#1f1633) with an optional fine, faint pinprick coordinate grid.
- **Layer 1 (Recessed Containers & Night Cards)**: Deep `surface-night` (#150f23) framed by a crisp `1px solid #362d59` (`hairline-violet`) border. No shadow.
- **Layer 2 (Interactive Modules / Video Previews)**: Solid base with a stark, offset tactile edge: `box-shadow: 0 4px 0 0 #150f23` on light canvas, or a deep midnight perimeter glow (`box-shadow: 0 0 8px 6px #150f23`) on dark hero surfaces.
- **Layer 3 (Overlays, Modals, Model Drawers)**: Heavy backdrop scrim (`rgba(21, 15, 35, 0.85)` with `backdrop-filter: blur(8px)`) paired with `hairline-violet` containment and high-contrast perimeter outlines.

Depth is fundamentally graphic: stickers, window-chrome UI mockups tilted slightly off-axis (±2deg), and high-contrast color boundaries convey stacking order without synthetic lighting.

## Shapes

The shape system adopts a **softened geometric brutalist** paradigm. It uses tight, disciplined radiuses to keep control consoles feeling structured and dense:

- **Micro / Pills (`rounded-xs`, 4px)**: Status badges, terminal tokens, inline prompt highlight chips, parameter tags.
- **Inputs & Controls (`rounded-sm`, 6px)**: Prompt textareas, numerical seed boxes, dropdown selects.
- **Buttons & Core Panels (`rounded-md`, 8px)**: Primary CTAs, playback controls, inspector cards, generation code blocks.
- **Large Studio Modules (`rounded-xl`, 12px – 18px)**: Tilted video viewport cards, generative preview canvases, showcase frames.
- **Signature Squiggle**: Full-width container section transitions use a raw vector squiggle stroke in Electric Lime (#c2ef4e) with a 3px hairline stroke.

## Components

### Buttons
- **Primary Command Button**: Inverted white `#ffffff` fill on dark canvas with bold `surface-night` (`#150f23`) uppercase text, or solid `#150f23` fill with white text on light canvas. Padding: `12px 16px`, radius: `8px`. Active state presses inward with a crisp `2px` downward tactile translation.
- **Ghost Console Button**: Fill: `on-dark-faint` (`rgba(255, 255, 255, 0.18)`), border: `1px solid #362d59`, text: `#ffffff`.
- **Accent Generator Button**: Reserved for model run triggers; Electric Lime (`#c2ef4e`) text on `#150f23` with a glowing lime perimeter ring when active.

### Chips & Syntax Badges
- **Lime Keyword Chip**: Rendered inline within copy or standalone. Background: `#c2ef4e`, text: `#150f23`, font: `Space Mono`, weight: `700`, radius: `4px`, padding: `2px 8px`.
- **Metadata Token**: Background: `#79628c` at 30% opacity, border: `1px solid #362d59`, text: `#bdb8c0`.

### Form Inputs & Prompt Fields
- **Prompt Field Area**: Monospaced font (`Space Mono`), background: `surface-night` (`#150f23`), border: `1px solid #cfcfdb` (light canvas) or `1px solid #362d59` (dark canvas). Focus state activates a distinct focus ring (`box-shadow: 0 0 0 2px #9dc1f5`).
- **Sliders & Model Selects**: Deep violet fill (`#422082`) with high-contrast text and custom chevron graphics.

### Cards & Canvas Containers
- **Dark Studio Card**: Background `#150f23`, border `1px solid #362d59`, padding `32px`, radius `12px`.
- **Featured Inverted Card**: When embedded within light layouts, featured tiers or active generation queues invert completely into Midnight Violet (`#150f23`) with white headlines and Electric Lime accent dividers.

### Checkboxes & Radios
- Square geometric boxes with `4px` radius. Border: `1.5px solid #79628c`. Selected state fills with `#c2ef4e` using an ink-violet `#150f23` check icon.