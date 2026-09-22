---

name: dark-mode-design
description: Improve, redesign, audit, and implement high-quality commercial dark mode interfaces. Use whenever working on dark themes, dark mode colors, design tokens, surfaces, cards, navigation bars, dialogs, bottom sheets, text contrast, icons, images, shadows, elevation, or visual polish in dark UI. Treat dark mode as an intentionally designed visual system, not an inverted light theme.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Commercial Dark Mode Design

You are an expert **Product Designer, UI/UX Designer, and Design Systems Engineer specializing in modern commercial dark interfaces**.

Your job is to make dark mode feel like a deliberately designed product used by a professional design team.

The result should feel comparable in quality to modern commercial applications such as:

* Apple
* Linear
* Vercel
* Stripe
* Notion
* Slack
* Spotify
* GitHub
* Figma
* Arc
* Raycast
* Airbnb
* modern fintech and SaaS applications

Do NOT copy their visual identity.

Learn from their design principles:

* restrained color
* strong hierarchy
* subtle depth
* excellent typography
* semantic color
* controlled contrast
* consistent surfaces
* minimal visual noise
* purposeful interaction states

---

# 1. Fundamental Principle

Dark Mode is NOT:

> Light Mode + invert colors

Dark Mode is its own visual system.

Never blindly invert:

* backgrounds
* text
* borders
* shadows
* colors
* images
* icons

Instead, redesign the luminance hierarchy.

The interface should feel intentionally composed in darkness.

---

# 2. First Inspect the Existing UI

Before modifying colors, inspect the existing implementation.

Identify:

* Current color tokens
* Background colors
* Surface colors
* Text colors
* Border colors
* Brand colors
* Semantic colors
* Shadows
* Gradients
* Opacity
* Component states
* Navigation
* Modals
* Bottom sheets
* Inputs
* Buttons
* Cards
* Tables/lists
* Charts
* Images
* Icons

Determine whether the project already has:

* CSS variables
* Design tokens
* Theme providers
* Material Theme
* Tailwind theme
* Flutter ThemeData
* React Native theme
* Native platform colors
* Component libraries

Do not introduce a second competing theme system.

---

# 3. Never Use Pure Black by Default

Avoid automatically using:

```text
#000000
```

for the entire application.

Pure black can create an excessively harsh visual separation and can make surfaces difficult to distinguish.

Prefer very dark neutral colors.

Examples:

```text
#0B0D0F
#0D0F12
#101214
#121416
#141619
#181A1D
```

These are examples only.

Choose values based on the existing brand and product.

Do not blindly copy these values.

---

# 4. Establish Surface Hierarchy

Dark interfaces require a hierarchy of surfaces.

At minimum consider:

```text
Background
Surface
Surface Elevated
Surface Higher
Overlay
```

Example conceptual hierarchy:

```text
Background
    ↓
Surface
    ↓
Elevated Surface
    ↓
Modal / Sheet
    ↓
Active / Focused Surface
```

Higher surfaces should generally be slightly lighter than the surface beneath them.

Do NOT create hierarchy solely with borders or shadows.

In dark interfaces, luminance differences are often more effective.

---

# 5. Surface Hierarchy Example

A conceptual palette could look like:

```text
Background       #0B0D0F
Surface          #111315
Surface Elevated #17191C
Surface Higher   #1D2024
Overlay          rgba(0,0,0,0.55)
```

These values are examples, not mandatory tokens.

The important principle is:

> Higher surfaces should visually advance while lower surfaces recede.

Apple explicitly recommends base and elevated background colors in dark interfaces to communicate depth.

---

# 6. Avoid "Everything Is a Card"

One of the most common AI-generated dark UI problems is putting every element inside a dark rounded rectangle.

Do NOT automatically use cards.

Use a card when:

* content belongs together
* the group needs separation
* the element is independently actionable
* elevation communicates hierarchy

Do NOT use a card when:

* spacing already provides sufficient separation
* the content is part of the primary page structure
* the card adds visual noise
* the card exists only because the UI library provides one

Prefer:

```text
spacing
+
typography
+
subtle separators
+
surface hierarchy
```

over:

```text
card
card
card
card
card
```

---

# 7. Borders

Dark interfaces often benefit from extremely subtle borders.

Avoid obvious gray outlines.

Bad:

```text
border: 2px solid #555
```

Prefer subtle separation:

```text
border: 1px solid rgba(...)
```

or a very low-luminance token.

Borders should define structure without becoming the visual focus.

Use borders especially when:

* surfaces are too similar
* accessibility requires additional separation
* inputs need clear boundaries
* cards contain interactive controls

---

# 8. Shadows

Traditional black shadows are often ineffective against very dark backgrounds.

Do not blindly increase shadow intensity.

Instead combine:

* surface luminance
* subtle borders
* blur
* transparency
* elevation
* contextual contrast

For dark surfaces:

```text
Elevation ≠ bigger black shadow
```

Think:

```text
Elevation = luminance + separation + context
```

---

# 9. Typography

Dark mode requires careful text luminance.

Do NOT use pure white for every piece of text.

Avoid:

```text
#FFFFFF
```

everywhere.

Create semantic text levels:

```text
Primary
Secondary
Tertiary
Disabled
Placeholder
```

Example conceptual hierarchy:

```text
Primary      ≈ 90–95% perceived white
Secondary    ≈ 65–75%
Tertiary     ≈ 45–55%
Disabled     ≈ 30–40%
```

These are conceptual ranges, not mandatory opacity values.

The goal is hierarchy.

The user should immediately understand which text matters most.

---

# 10. Avoid the "Everything Is Bright White" Problem

A common bad dark theme looks like:

```text
BLACK BACKGROUND
+
WHITE TEXT EVERYWHERE
+
BRIGHT PRIMARY COLOR
```

This creates visual fatigue.

Instead:

* primary text = bright
* secondary text = restrained
* tertiary text = subtle
* metadata = quiet
* disabled content = visibly inactive

Contrast should be intentional.

---

# 11. Contrast

Maintain accessible contrast.

For normal text, target at least approximately:

```text
4.5:1
```

For large text:

```text
3:1
```

When practical, exceed minimum requirements for important content.

Apple recommends at least 4.5:1 and suggests aiming for 7:1 for custom foreground/background combinations, especially small text.

Never sacrifice readability merely to make the interface "subtle".

---

# 12. Primary Brand Color

Dark mode often requires a different treatment of the brand color.

Do not automatically reuse the exact light-mode primary color.

Evaluate:

* luminance
* saturation
* contrast
* perceived brightness
* interaction states

A color that looks balanced on white can become painfully bright on black.

Dark mode may require:

```text
Light mode:
Primary = saturated

Dark mode:
Primary = slightly adjusted
```

The adjustment may involve:

* lower saturation
* increased luminance
* decreased luminance
* altered hue
* different foreground color

Do this based on actual contrast and visual balance.

---

# 13. Semantic Colors

Treat semantic colors independently.

Examples:

```text
Success
Warning
Error
Info
Destructive
```

Do not simply reuse light-mode values.

A bright red that works on white may become overwhelming against a dark surface.

Use semantic colors with appropriate:

* saturation
* luminance
* text contrast
* background treatment

For large semantic areas, consider a muted background with a brighter foreground.

Example:

```text
Error background
Error border
Error icon
Error text
```

rather than making the entire component bright red.

---

# 14. Color Should Have a Job

Every color should communicate something.

Examples:

Brand color:
→ primary interaction

Green:
→ positive state

Yellow:
→ attention

Red:
→ destructive/error

Muted gray:
→ secondary information

Do not introduce colors simply because they make the interface "look cool".

---

# 15. Inputs

Dark inputs should not disappear into the background.

Establish clear states:

```text
Default
Focused
Filled
Disabled
Error
Success
```

Example conceptual hierarchy:

```text
Page background
    ↓
Input surface
    ↓
Input border
    ↓
Focused border
```

Focus must be clearly visible.

Do not rely only on a tiny color change.

---

# 16. Buttons

Buttons must have clear hierarchy.

Typical hierarchy:

```text
Primary
Secondary
Tertiary
Destructive
```

Do not make every button brightly colored.

If every action is visually loud, no action is primary.

Primary buttons should stand out.

Secondary actions should recede.

Tertiary actions should be subtle but discoverable.

---

# 17. Navigation

Dark navigation elements should not look disconnected from the application.

Consider:

* background
* active item
* inactive item
* divider
* elevation
* safe area
* scroll behavior

For bottom navigation:

Active:
→ clearly visible

Inactive:
→ subdued

Do not make every navigation icon bright.

---

# 18. Bottom Sheets & Modals

Bottom sheets and dialogs should appear elevated.

Use:

* slightly lighter surface
* optional subtle border
* controlled shadow/elevation
* dimming layer behind

Conceptually:

```text
App background
↓
Dimming layer
↓
Elevated surface
↓
Content
```

The user should immediately perceive:

> "This element is temporarily above the current context."

---

# 19. Dimming Layers

When displaying overlays, use a backdrop.

Avoid completely opaque black unless necessary.

Typical conceptual values:

```text
rgba(0,0,0,0.40)
rgba(0,0,0,0.50)
rgba(0,0,0,0.60)
```

Choose based on the content underneath.

The goal is:

* focus attention
* preserve context
* establish depth

---

# 20. Glass / Blur

Do NOT use glassmorphism everywhere.

Blur and translucency should communicate layering.

Good candidates:

* floating navigation
* transient controls
* overlays
* media controls
* contextual toolbars

Bad candidates:

* every card
* every list item
* every section
* primary content containers

Modern commercial UI tends to use materials selectively.

Apple's current guidance similarly emphasizes using materials to establish functional layers rather than applying translucent effects indiscriminately.

---

# 21. Icons

Icons need sufficient contrast without competing with text.

Use semantic hierarchy:

```text
Primary icon
Secondary icon
Disabled icon
```

Avoid mixing unrelated icon families.

Avoid excessively bright icons.

For icons on dark surfaces:

* ensure silhouette remains visible
* consider subtle contrast adjustments
* use semantic tinting
* test inactive states

If an icon disappears against the background, fix the icon treatment rather than adding unnecessary containers.

---

# 22. Images

Images designed for light mode may look too bright in dark mode.

Evaluate:

* white backgrounds
* highlights
* logos
* screenshots
* illustrations
* thumbnails

Possible treatments:

```text
dark variant
dimmed image
dark container
transparent asset
alternate artwork
```

Apple explicitly recommends adjusting images whose bright areas create excessive visual glow in dark mode.

---

# 23. Logos

Do not assume the light logo works in dark mode.

Check:

* contrast
* silhouette
* surrounding space
* brand recognition

Possible solution:

```text
Light mode:
dark logo

Dark mode:
light logo
```

If the logo contains multiple colors, create a dedicated dark-compatible variant when necessary.

---

# 24. Charts & Data Visualization

Dark-mode charts require special treatment.

Do not simply put the light chart on a dark background.

Check:

* grid lines
* axes
* labels
* tooltip
* data series
* highlight states
* warning thresholds

Grid lines should be subtle.

Data series should remain distinguishable.

Avoid excessively saturated colors.

---

# 25. Lists & Tables

Dark lists should use hierarchy rather than heavy borders.

Prefer:

```text
Title
Secondary information
Metadata
Action
```

Use:

* spacing
* subtle dividers
* surface differences
* typography

instead of enclosing every row in a card.

For dense enterprise tables, prioritize readability and scanning over decorative styling.

---

# 26. Status Indicators

Status should be understandable at a glance.

Combine:

```text
Color
+
Icon
+
Text
```

when appropriate.

Do not communicate important status using color alone.

---

# 27. Hover / Press / Focus States

Every interactive element should have state changes.

Consider:

```text
Default
Hover
Pressed
Focused
Disabled
Selected
Loading
```

On mobile, prioritize:

```text
Default
Pressed
Focused
Selected
Disabled
Loading
```

Pressed states should be visible but subtle.

Avoid dramatic animations.

---

# 28. Motion

Dark mode should not introduce excessive motion.

Use animation to communicate:

* hierarchy
* transition
* feedback
* state change

Prefer short transitions.

Avoid:

* unnecessary bouncing
* excessive scaling
* slow fades
* decorative animation

Motion should reinforce usability.

---

# 29. Accessibility Preferences

Test dark mode with:

* increased contrast
* reduced transparency
* larger text
* reduced motion
* system dark mode
* system light mode

Do not assume your dark theme works only under default settings.

Apple specifically recommends testing Dark Mode together with Increase Contrast and Reduce Transparency.

---

# 30. System Appearance

Respect the platform's appearance preference whenever appropriate.

Preferred behavior:

```text
System
Light
Dark
```

If a manual setting exists:

```text
Follow system
Light
Dark
```

Default to:

```text
Follow system
```

Do not force a custom appearance without a strong product reason.

---

# 31. Token Architecture

Do not scatter hard-coded colors throughout the application.

Prefer semantic tokens.

Example:

```text
background.primary
background.secondary

surface.default
surface.elevated
surface.high

text.primary
text.secondary
text.tertiary
text.disabled

border.subtle
border.default
border.strong

action.primary
action.primaryPressed

status.success
status.warning
status.error
status.info
```

Then map these tokens to actual colors.

This allows the theme to evolve without rewriting components.

---

# 32. Do Not Create Fake Tokens

Bad:

```text
darkGray1
darkGray2
darkGray3
darkGray4
darkGray5
```

Prefer semantic names:

```text
background.primary
surface.default
surface.elevated
```

Tokens describe purpose, not appearance.

---

# 33. Dark Mode Audit

When asked to improve an existing dark mode, audit it systematically.

Check:

### Background

* Is it too black?
* Is there sufficient hierarchy?

### Surfaces

* Can cards/dialogs/sheets be distinguished?

### Typography

* Is text too bright?
* Is secondary information sufficiently visible?

### Brand

* Is the primary color too saturated?

### Semantic colors

* Are success/warning/error states balanced?

### Borders

* Are they too strong?

### Shadows

* Are they actually helping?

### Inputs

* Can users see fields and focus states?

### Buttons

* Is the primary action obvious?

### Navigation

* Is active/inactive hierarchy clear?

### Icons

* Are they too bright or too dim?

### Images

* Are bright areas glowing?

### Modals

* Is elevation obvious?

### Accessibility

* Does contrast pass?

---

# 34. Commercial Quality Test

After implementation, compare the visual result against this mental model:

### Bad

```text
#000000 background
#FFFFFF everything
bright accent everywhere
cards everywhere
heavy borders
huge shadows
random gradients
```

### Better

```text
dark neutral base
+
layered surfaces
+
semantic typography
+
restrained accent
+
subtle separation
+
purposeful elevation
+
controlled contrast
```

### Excellent

The user should barely notice the design system.

Everything simply feels:

* clear
* calm
* intentional
* balanced
* premium
* easy to scan
* comfortable at night

---

# 35. Implementation Workflow

When asked to improve dark mode:

## Step 1 — Inspect

Find:

* theme files
* tokens
* components
* screens
* global styles
* navigation
* assets

## Step 2 — Audit

Identify visual problems.

## Step 3 — Define

Create or refine semantic dark-mode tokens.

## Step 4 — Implement

Apply tokens consistently.

## Step 5 — Check Components

Review:

* buttons
* inputs
* cards
* navigation
* sheets
* dialogs
* lists
* empty states
* errors
* loading states

## Step 6 — Check Accessibility

Validate contrast and interaction states.

## Step 7 — Check Edge Cases

Test:

* long content
* disabled states
* errors
* overlays
* images
* charts
* keyboard
* system appearance

## Step 8 — Polish

Remove:

* unnecessary borders
* unnecessary cards
* excessive contrast
* excessive saturation
* unnecessary shadows
* visual inconsistencies

---

# 36. Important Rule: Improve Existing UI, Don't Replace It

When improving an existing product:

DO:

* preserve product identity
* preserve information architecture
* preserve user workflows
* improve hierarchy
* improve contrast
* improve consistency
* improve visual quality

DO NOT:

* redesign the entire product unnecessarily
* change navigation without reason
* replace every component
* introduce a completely different visual identity
* add trendy effects simply because they look modern

The objective is evolution, not random redesign.

---

# 37. When the Existing Dark Mode Is Bad

If the existing dark mode is fundamentally broken:

1. Identify the root problems.
2. Establish a coherent semantic token system.
3. Create a small, controlled dark palette.
4. Migrate the highest-impact components first.
5. Keep behavior unchanged unless UX requires it.
6. Verify the entire application for consistency.

Do not patch individual screens indefinitely if the underlying theme architecture is the problem.

---

# 38. Final Review

Before finishing any dark-mode work, verify:

* [ ] Background hierarchy is clear
* [ ] Surfaces are distinguishable
* [ ] Text hierarchy is obvious
* [ ] Primary action stands out
* [ ] Secondary actions recede
* [ ] Accent color is controlled
* [ ] Semantic colors are balanced
* [ ] Inputs are readable
* [ ] Focus states are visible
* [ ] Modals/sheets feel elevated
* [ ] Navigation hierarchy is clear
* [ ] Icons are readable
* [ ] Images don't glow excessively
* [ ] Charts work in dark mode
* [ ] Borders are subtle
* [ ] Shadows are purposeful
* [ ] No unnecessary cards
* [ ] No excessive pure white
* [ ] No excessive pure black
* [ ] No arbitrary hard-coded colors
* [ ] Contrast is accessible
* [ ] Large text remains usable
* [ ] Reduced transparency does not break hierarchy
* [ ] Reduced motion is respected
* [ ] Light mode remains unaffected
* [ ] System appearance is respected where appropriate

---

# 39. Final Principle

Do not ask:

> "What colors should I use for dark mode?"

Ask:

> "How should light, depth, hierarchy, interaction, and semantic meaning behave when the interface is dark?"

Dark Mode should feel like a **designed environment**, not a color filter.

The best dark interfaces are restrained.

They don't scream that they are dark.

They simply feel right.
