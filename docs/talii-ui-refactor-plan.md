# Talii Mobile App — UI Consistency & Color System Refactor Plan

## Context

The Talii mobile app has undergone partial dark-mode and theming work. The foundation (`theme.ts`, `ThemeProvider`, and a sweep of the worst-offending pages) is in place. However the app still suffers from two overarching problems:

1. **Color system incoherence** — `primary`, `secondary`, and `accent` all resolve to the same `#EE6D23` orange, leaving zero visual hierarchy. Several tokens are pure aliases for each other (`saffronBrown`, `coffeeBrown`, `beige`, `grey`, `darkGrey`, `lightGrey`). The `premium` gold clashes with the brand orange. There are no orange tint variants for subtle surfaces or selected-state backgrounds.
2. **Component inconsistency** — Two completely separate button systems exist side-by-side (`ActionButton.tsx` for auth/landing, `ui/Button.tsx` for the inner app). They have different heights, font sizes, border radii, and variants. `Badge.tsx` still uses `theme.colors.*` directly instead of `useTheme()`. Input fields are rebuilt inline on almost every page instead of using `ui/Input.tsx`. Border radius values vary from `4px` to `24px` with no design rationale.

The priority signal is the **logo itself**: clean, vibrant, flat orange on pure white, with rounded bubbly letterforms. That personality must be the north star — rounded, warm, approachable, high-contrast, and never muddy.

---

## Part 1 — Color Research & Brand Analysis

### Logo Observations
- **Letterform style**: Very round, bubbly, soft corners — not geometric, not sharp. This signals: friendly, approachable, professional but not corporate.
- **Color usage**: Pure flat orange (`#EE6D23`) on pure white background. No gradients, shadows, or effects in the mark itself. The brand is bold and unambiguous.
- **Iconography**: A makeup fan/brush incorporated into the second `i` glyph — subtle but intentional. Communicates beauty, grooming, craft.
- **Mood**: Energetic, warm, modern, clean.

### Color Theory Foundation
Orange (#EE6D23) sits at roughly 22° on the HSL wheel (orange-red). Research confirms the following pairings work best with this specific warm orange:

**1. Deep Warm Charcoal for Text** (`#272A2F` — already in theme as `grey`/`darkGrey`)
The logo's implied background for the dark version is deep charcoal, not pure black. This is the correct dark-mode background tone. It carries warmth (slightly brown-tinted) so it never fights the orange.

**2. Off-White / Warm White for Light Surfaces** (a very subtle warm tint, `#FAFAF9` or `#FAF9F8`)
Pure white (`#FFFFFF`) is correct for the page background, but elevated surfaces (cards, modals) should use a barely-warm off-white to create depth without cold gray contrast.

**3. Orange Tint Scale** (orange mixed with white — for selected states, badges, soft highlights)
- `primarySubtle`: `#FFF4EE` — barely visible orange wash; for selected tab backgrounds, badge fill, notification indicators
- `primaryTint`: `#FFE4D1` — medium orange tint; for hover/pressed states, info banners with orange context

**4. True Secondary Color** (not another orange)
`secondary` must visually differentiate from `primary`. Options backed by color theory:
- A deep **warm charcoal** (`#3D3A36`) signals sophistication and professionalism — pairs naturally with orange (analogous-neutral). Use for secondary buttons (outlined/ghost style).
- Avoid blue, green, purple — they create a competing accent that undercuts the orange brand identity. Orange already IS the accent. Secondary must be neutral.

**5. What NOT to Add**
- No competing warm colors: no yellow, no red-orange, no gold-yellow `#ffd700`. These fight the orange.
- No cool grays as primary neutrals: the brand warmth demands the grays be slightly warm-tinted.
- No decorative gradients on interactive elements that aren't `primary` — only orange deserves the gradient treatment.

### Specific Token Problems to Fix

| Current Token | Current Value | Problem | Fix |
|---|---|---|---|
| `secondary` | `#EE6D23` | Same as primary — no hierarchy | Change to outlined/charcoal style — no background fill |
| `secondaryForeground` | `#FFFFFF` | White on orange (same as primary) | Change to `#EE6D23` (orange text, no fill) |
| `accent` | `#EE6D23` | Triple redundancy with primary | Repurpose `accent` as `primaryTint` (`#FFF4EE`) |
| `accentForeground` | `#FFFFFF` | White makes no sense on a tint | Change to `#EE6D23` |
| `premium` | `#ffd700` (pure gold) | Yellow-gold clashes with warm orange | Change to `#F59E0B` (amber — warm but distinct) |
| `warning` | `#f59e0b` | Identical to proposed `premium` | Change warning to `#FB923C` (a lighter, more readable amber-orange — distinct from primary) |
| `saffronBrown` | `#EE6D23` | Redundant alias | Remove from usage, retain for legacy only |
| `coffeeBrown` | `#D85A1A` | Only used in gradients | Rename as `primaryDark` and expose it explicitly |
| `beige` | `#F5F5F5` | Same as `muted` | Remove from usage |
| `grey` / `darkGrey` | `#272a2f` | Duplicate tokens | Consolidate — one token: `charcoal` |
| `lightGrey` | `#F5F5F5` | Same as `muted` | Remove from usage |
| `input` | `#E5E7EB` | Almost identical to `border` (#E4E4E7) | Change to `#F3F4F6` — clearly distinct from border |
| `surface` | `#F5F5F5` | Same as `muted` | Change to `#FAFAF9` (warm off-white) |
| `surfaceElevated` | `#FFFFFF` | Same as `background` — no perceived elevation | Change to `#FFFFFF` with a defined shadow, or `#FFFFFF` for light and deduplicate |

### New Tokens to Add

```typescript
primarySubtle: '#FFF4EE',     // very light orange tint — for selected states, badge backgrounds
primaryTint: '#FFE4D1',       // medium orange tint — for pressed states, soft highlights
primaryDark: '#D85A1A',       // darker orange — for pressed/active primary buttons (rename of coffeeBrown)
info: '#3B82F6',              // blue — complementary to orange, for informational alerts
infoForeground: '#FFFFFF',
```

### Dark Mode Token Corrections

| Token | Current Dark Value | Problem | Fix |
|---|---|---|---|
| `secondary` dark | (inherits light — `#EE6D23`) | Still same as primary | `secondary` in dark should remain outlined-style behavior |
| `premium` dark | (inherits light — `#ffd700`) | Clashes | Fix with amber `#F59E0B` |
| `surface` dark | `#2d2a26` | Slightly warm-tinted — good, keep | No change |
| `mutedForeground` dark | `#b0b0b0` | Pure neutral gray — slightly cold | Consider `#A8A29E` (warm gray) |

---

## Part 2 — Component Consistency Audit & Fixes

### 2.1 Button System — Unification (HIGHEST PRIORITY)

**Problem**: Two button components, zero cross-compatibility.

| Property | `ActionButton.tsx` | `ui/Button.tsx` |
|---|---|---|
| Height | `56px` | `40px` (default), `44px` (lg) |
| Border Radius | `20px` hardcoded | `rounded-md` = `6px` |
| Font Size | `20px` | `16px` |
| Variants | `primary`, `secondary`, `tertiary` | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` |
| Gradient | Yes (primary) | No |
| Animation | Yes (scale + glow) | No |
| Where Used | Home, Login, SignUp | All inner app screens |

**Fix**: The inner `ui/Button.tsx` needs a `size="hero"` variant matching `ActionButton`'s proportions, AND its `borderRadius` must be updated from `rounded-md` (6px) to `rounded-xl` (12px) or `rounded-2xl` (16px) as a default to match the logo's rounded personality. `ActionButton` remains as-is for landing/auth but its `borderRadius: 20` should be replaced with `theme.borderRadius['3xl']` (24px) to come from the token, not a magic number.

**Concrete changes to `ui/Button.tsx`**:
- Default `rounded-md` → `{ borderRadius: theme.borderRadius.xl }` (maps to `theme.borderRadius.xl` = 12px) for all variants
- Add `size="hero"`: height 56px, font 20px, `rounded-2xl` (16px), full-width by default
- `secondary` variant: change from `{ backgroundColor: colors.secondary }` to `{ backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary }` with `color: colors.primary` text — this matches the outlined secondary pattern in `ActionButton`
- `ghost` variant: add `borderRadius: theme.borderRadius.xl` explicitly

**Concrete changes to `ActionButton.tsx`**:
- Replace `borderRadius: 20` → `theme.borderRadius['3xl']`
- Replace `borderRadius: 12` (inner tabs) → `theme.borderRadius.xl`

### 2.2 Badge — Fix Direct `theme.colors` Usage

`Badge.tsx` still calls `theme.colors.*` directly (bypasses `useTheme()` and will not respond to dark mode).

**Fix**:
- Add `const { colors } = useTheme();` 
- Replace all `theme.colors.*` references with `colors.*`
- Add a `soft` variant: `backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle` with `color: colors.primary` text — this is the most useful badge style (used for tags, labels, status chips throughout the app)

### 2.3 Input Fields — Replace Inline Patterns

At least 6 pages (LoginPage, SignUpPage, BarberOnboardingPage, CalendarPage, BookingCalendarPage, SettingsPage) recreate `TextInput` wrappers inline with `height: 56, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input`. This is the same pattern repeated 20+ times.

**`ui/Input.tsx` must match the inline pattern so pages can switch**:
- Ensure `ui/Input.tsx` has: height 56px, `borderRadius: theme.borderRadius['2xl']` (16px), correct `colors.input` background, `colors.border` border, `colors.foreground` text, `colors.mutedForeground` placeholder
- Add a `leftIcon` and `rightIcon` prop to `ui/Input.tsx` for cases like the eye-toggle on password fields
- Once updated, all inline TextInput wrappers on pages are replaced with `<Input />`

### 2.4 Card — Border Radius Standardization

`Card.tsx` uses `rounded-lg` (8px). Pages create custom card-like containers with `borderRadius: 24` or `borderRadius: 16`. This must be consolidated.

**Fix**:
- Add a `variant` prop to `Card`: `default` (existing — 8px), `elevated` (`borderRadius: 16`, subtle shadow from `theme.shadows.md`), `hero` (`borderRadius: 24`, for large modal-style cards like the form containers on Login/SignUp)
- All login/signup form containers currently using inline `borderRadius: 24, padding: 32` → replace with `<Card variant="hero">`

### 2.5 Border Radius System — The Rounded Personality Rule

The logo letterforms inform the following rule: **every interactive or container element must use at least `theme.borderRadius.xl` (12px)**. Sharp corners (`sm: 2`, `md: 6`) are reserved only for tiny inline elements (e.g. a checkbox, a 2px separator, a small tooltip).

Updated mapping for consistent use:
- **Buttons**: `xl` (12px) as default minimum; `2xl` (16px) for standard buttons; `3xl` (24px) for hero/CTA buttons
- **Input fields**: `2xl` (16px)
- **Cards**: `xl` (12px) default; `2xl` (16px) elevated; `3xl` (24px) hero
- **Badges/Tags**: `full` (9999px) — always pill-shaped
- **Modals/Bottom sheets**: `3xl` (24px) top corners
- **Tab indicators/Pills**: `full` (9999px)
- **Icon containers** (the round button circles): `full` (9999px)

### 2.6 Shadow System

`theme.shadows` is defined but almost never used. The system must be applied:
- **`sm`**: Tabs, badges, inactive cards
- **`md`**: Active/elevated cards, dropdowns, tooltips
- **`lg`**: Modals, bottom sheets, FAB buttons
- **Primary button shadow**: Must use `shadowColor: colors.primary` (orange glow), not `#000`. This is already done in `ActionButton` but must be applied consistently to all primary buttons using `ui/Button.tsx`.

### 2.7 Tab Navigation Consistency

Two visual patterns for active tabs exist in the app:
- **Settings**: Underline indicator (`borderBottomWidth: 2, borderBottomColor: colors.primary`)
- **Browse**: A pill/chip background (`backgroundColor: colors.primary, borderRadius: full`)

**Fix**: Pick one pattern and apply it everywhere. Recommendation: **pill/chip pattern** — it matches the rounded brand personality better, and the `TabsList`/`TabsTrigger` components in `ui/tabs.tsx` already implement it. Update SettingsPage to use the pill pattern.

### 2.8 `AnimatedLogo.tsx` — Conditional Asset

The logo component should render `talii-logo-dark.png` in dark mode and `talii-logo.png` in light mode. Currently verify this is working — it probably uses a single asset. If the logo file is the same for both modes (orange on transparent), ensure the container background is the right color so it reads correctly on both backgrounds.

---

## Part 3 — Updated `theme.ts` Token Specification

Below is the complete set of changes to apply to `apps/mobile/app/shared/lib/theme.ts`. Apply these changes incrementally: first update the token values, then propagate to components.

### Light Mode Colors (replace/add)

```typescript
colors: {
  // Backgrounds
  background: '#FFFFFF',
  foreground: '#1C1917',          // CHANGE: warmer near-black (was #2a2a2a)
  
  card: '#FFFFFF',
  cardForeground: '#1C1917',      // CHANGE to match foreground
  
  surface: '#FAFAF9',             // CHANGE: warm off-white (was #F5F5F5)
  surfaceForeground: '#1C1917',   // CHANGE to match foreground
  surfaceElevated: '#FFFFFF',     // keep
  
  popover: '#FFFFFF',
  popoverForeground: '#1C1917',   // CHANGE to match foreground
  
  // Primary (orange — unchanged)
  primary: '#EE6D23',
  primaryForeground: '#FFFFFF',
  primaryDark: '#D85A1A',         // ADD: for pressed/active states (replaces coffeeBrown)
  primarySubtle: '#FFF4EE',       // ADD: lightest orange tint for selected states
  primaryTint: '#FFE4D1',         // ADD: medium orange tint for hover/pressed surfaces

  // Secondary (CHANGED: now charcoal-outlined, not another orange)
  secondary: '#FFFFFF',                    // transparent fill — outline style
  secondaryForeground: '#EE6D23',         // orange text (outlined button)
  // Note: Secondary buttons are rendered as outlined: border=primary, text=primary, bg=transparent
  // The secondary color token is kept as a background but will rarely have a fill
  
  // Muted
  muted: '#F5F5F4',               // CHANGE: slightly warmer (was #F5F5F5)
  mutedForeground: '#78716C',     // CHANGE: warm gray (was #737373)
  
  // Accent (repurposed from orange duplicate to orange tint)
  accent: '#FFF4EE',              // CHANGE: was #EE6D23 — now the primary tint
  accentForeground: '#EE6D23',    // CHANGE: was #FFFFFF — orange text on tint bg

  // Utility
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  border: '#E7E5E4',              // CHANGE: slightly warmer (was #E4E4E7)
  input: '#F3F4F6',               // CHANGE: clearly lighter than border (was #E5E7EB)
  ring: '#EE6D23',
  
  // Status  
  success: '#10B981',
  successForeground: '#FFFFFF',   // ADD
  warning: '#FB923C',             // CHANGE: lighter amber distinct from primary (was #f59e0b)
  warningForeground: '#FFFFFF',   // ADD
  premium: '#F59E0B',             // CHANGE: amber-gold instead of pure yellow (was #ffd700)
  info: '#3B82F6',                // ADD: blue for informational states
  infoForeground: '#FFFFFF',      // ADD

  // Glass / overlay tokens (light mode — unchanged from recent work)
  glass: 'rgba(39, 42, 47, 0.06)',
  glassBorder: 'rgba(39, 42, 47, 0.12)',
  backdrop: 'rgba(39, 42, 47, 0.45)',

  // REMOVE from active use (keep for one release cycle as deprecated):
  // grey, darkGrey, lightGrey, saffronBrown, coffeeBrown, beige
  // (they may still be referenced in old code — fix those references in part 4)
}
```

### Dark Mode Overrides (inside `dark: {}`)

```typescript
dark: {
  background: '#1C1917',          // CHANGE: warm near-black (was #272a2f)
  foreground: '#FAFAF9',          // CHANGE: warm off-white (was #FFFFFF)
  card: '#292524',                // CHANGE: warmer dark card (was #2d2a26)
  cardForeground: '#FAFAF9',
  popover: '#292524',
  popoverForeground: '#FAFAF9',
  surface: '#292524',             // CHANGE: warmer (was #2d2a26)
  surfaceForeground: '#FAFAF9',
  surfaceElevated: '#3C3835',     // CHANGE: warmer elevated surface (was #2a2a2a)
  muted: '#44403C',               // CHANGE: warm dark muted (was #3a3a3a)
  mutedForeground: '#A8A29E',     // CHANGE: warm gray (was #b0b0b0)
  border: '#44403C',              // CHANGE: warmer dark border (was #3a3a3a)
  input: '#44403C',               // CHANGE: matches dark muted (was #3a3a3a)
  glass: 'rgba(0, 0, 0, 0.25)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',  // CHANGE: slightly more visible (was 0.1)
  backdrop: 'rgba(0, 0, 0, 0.65)',
  primarySubtle: '#3A2418',       // ADD: dark-mode orange tint bg
  primaryTint: '#52311E',         // ADD: dark-mode medium orange tint
  accent: '#3A2418',              // ADD: dark-mode accent tint
  accentForeground: '#EE6D23',
  info: '#60A5FA',                // ADD: lighter blue for dark mode readability
}
```

### Gradient Updates

```typescript
gradients: {
  primary: ['#EE6D23', '#D85A1A'],    // unchanged — button/logo gradient
  background: ['#FFFFFF', '#FAFAF9'], // CHANGE: subtle warm-white fade
  backgroundDark: ['#1C1917', '#292524'], // CHANGE: warmer dark gradient
  glass: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'],
  logo: ['#EE6D23', '#D85A1A'],
  text: ['#EE6D23', '#D85A1A'],
  button: ['#EE6D23', '#D85A1A'],
  glow: ['rgba(238, 109, 35, 0.35)', 'rgba(238, 109, 35, 0.08)'], // CHANGE: more visible glow
}
```

---

## Part 4 — File-by-File Implementation Checklist

Work through these files in order. The ordering minimizes downstream breakage (foundations before consumers).

### Phase A — Theme Foundation (do this first, unblocks everything else)

**A1. `apps/mobile/app/shared/lib/theme.ts`**
- Apply all token value changes from Part 3 above
- Add `primaryDark`, `primarySubtle`, `primaryTint`, `info`, `infoForeground`, `successForeground`, `warningForeground` tokens to both `ResolvedColors` type and `dark` overrides
- Remove consumer usage of `grey`, `darkGrey`, `lightGrey`, `saffronBrown`, `coffeeBrown`, `beige` tokens (mark as deprecated with a comment but do NOT delete the keys yet — they might still appear in un-migrated files)
- Update `gradients.background` and `gradients.backgroundDark`

### Phase B — Core Primitive Components (do this second)

**B1. `apps/mobile/app/shared/components/ui/Button.tsx`**
- Default border radius: change `tw\`rounded-md\`` to `{ borderRadius: theme.borderRadius.xl }` (12px) on the `TouchableOpacity`
- `secondary` variant: change from `{ backgroundColor: colors.secondary }` to `{ backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary }`
- `secondary` text variant: change from `{ color: colors.secondaryForeground }` to `{ color: colors.primary }`
- Add `size="hero"` entry to `sizeStyles` and `textSizeStyles`: height 56px, font 20px, horizontal padding 24px, border radius `theme.borderRadius['3xl']` (24px)
- Primary button shadow: add `shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6` to `default` variant styles
- `ghost` and `link` variants: add explicit `borderRadius: theme.borderRadius.xl`

**B2. `apps/mobile/app/shared/components/ui/Badge.tsx`**
- Add `const { colors } = useTheme();` at the top of `Badge` component
- Replace all `theme.colors.*` → `colors.*`
- Add `soft` variant: `{ backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle }` with text `{ color: colors.primary }`
- Add `info` variant: `{ backgroundColor: colors.info, borderColor: colors.info }` with text `{ color: colors.infoForeground }`

**B3. `apps/mobile/app/shared/components/ui/Card.tsx`**
- Add `variant?: 'default' | 'elevated' | 'hero'` prop to `Card`
- `default`: existing `rounded-lg` (8px) + `shadow-sm`
- `elevated`: `borderRadius: theme.borderRadius['2xl']` (16px) + `theme.shadows.md` shadow
- `hero`: `borderRadius: theme.borderRadius['3xl']` (24px) + `theme.shadows.lg` shadow + `padding: 32` default in `CardContent` when this variant is used

**B4. `apps/mobile/app/shared/components/ui/Input.tsx`**
- Ensure: `height: 56`, `borderRadius: theme.borderRadius['2xl']` (16px), `borderWidth: 1`, `borderColor: colors.border`, `backgroundColor: colors.input`, text `color: colors.foreground`, `placeholderTextColor: colors.mutedForeground`
- Add `leftIcon?: React.ReactNode` and `rightIcon?: React.ReactNode` props — render them inside the container view flanking the `TextInput`
- Add `error?: boolean` prop: when true, `borderColor: colors.destructive`
- Add `errorMessage?: string` prop: render error text below the input in `colors.destructive` at `fontSize: 12`

**B5. `apps/mobile/app/shared/components/ActionButton.tsx`**
- Replace hardcoded `borderRadius: 20` → `theme.borderRadius['3xl']` (24px)
- Replace hardcoded `borderRadius: 12` (inner selected tab styling if present) → `theme.borderRadius.xl` (12px)
- `secondary` variant: update to match the new outlined `secondary` pattern (border orange, text orange, no fill) — should already be correct per current code but verify `borderColor: colors.primary, backgroundColor: colors.muted`

**B6. `apps/mobile/app/shared/components/ui/tabs.tsx`**
- Verify `TabsList` and `TabsTrigger` use `useTheme()` and not `theme.colors.*` directly (this was done in the previous session — double-check)
- `TabsTrigger` active state: ensure `backgroundColor: colors.primary` and `color: colors.primaryForeground` — this is the pill pattern
- `TabsTrigger` inactive: `backgroundColor: 'transparent'`, `color: colors.mutedForeground`

**B7. `apps/mobile/app/shared/components/ui/Alert.tsx`** (read and audit this file)
- Add an `info` variant using `colors.info` background tint (`colors.primarySubtle` if info not available yet) 
- Ensure all hardcoded colors are replaced with tokens

**B8. `apps/mobile/app/shared/components/ui/progress.tsx`** (read and audit)
- Active/filled track: must use `colors.primary`
- Background track: must use `colors.muted`
- No hardcoded colors

**B9. `apps/mobile/app/shared/components/ui/LoadingSpinner.tsx`** (read and audit)
- Spinner color: `colors.primary`

### Phase C — Shared Feature Components

**C1. `apps/mobile/app/shared/components/AnimatedBackground.tsx`**
- The overlay `rgba(0, 0, 0, 0.1)` and `rgba(255, 255, 255, 0.1)` hardcodes → replace with `colors.backdrop` (at lower opacity) or keep as-is if purely decorative and theme-neutral
- The orange gradient overlays `rgba(238, 109, 35, 0.12)` and `rgba(238, 109, 35, 0.08)` are fine — they use the literal orange value intentionally as a design element. Keep but ensure they scale appropriately in dark mode (could be `rgba(238, 109, 35, 0.18)` in dark to compensate for the darker background)

**C2. `apps/mobile/app/shared/components/AnimatedLogo.tsx`** (read and audit)
- Confirm it uses `talii-logo-dark.png` in dark mode and `talii-logo.png` in light mode (or a single transparent asset that works on both — if so, verify readability against both backgrounds)

**C3. `apps/mobile/app/shared/components/theme/ThemeToggle.tsx`** (read and audit)
- Ensure toggle uses `colors.primary` for the active state
- Ensure it renders correctly in both modes

### Phase D — Page Migration

For every page below, the following checklist applies before moving to the next:
- [ ] All `theme.colors.*` direct references → `colors.*` via `useTheme()`
- [ ] All `rgba(255,255,255,0.x)` → `colors.glass` or `colors.glassBorder` as appropriate
- [ ] All `rgba(0,0,0,0.x)` → `colors.backdrop`
- [ ] All hardcoded `color: 'white'` → `colors.foreground` or `colors.primaryForeground`
- [ ] All hardcoded `backgroundColor: 'black'` → `colors.background`
- [ ] All inline `TextInput` wrapper patterns → `<Input />` component from `ui/Input.tsx`
- [ ] All `borderRadius: 20` or `borderRadius: 24` on form containers → `<Card variant="hero">` or explicit `theme.borderRadius['3xl']`
- [ ] All icon-in-circle containers → `borderRadius: theme.borderRadius.full`, `backgroundColor: colors.muted`, `borderColor: colors.border`
- [ ] All tab/segmented-control patterns → `<TabsList>/<TabsTrigger>` from `ui/tabs.tsx`

**D1. `apps/mobile/app/pages/LoginPage.tsx`** — Complexity: Medium
- Form container: `borderRadius: 24, padding: 32` → `<Card variant="hero">`
- Inline TextInput wrappers (email, password) → `<Input error={!!error} errorMessage={error} leftIcon={} rightIcon={<Eye />} />`
- Back button circle → verify uses `colors.surface, colors.border, borderRadius: full`
- The scissors icon container → uses `colors.muted, colors.border, borderRadius: full` — check
- Remove `AnimatedText` on the "WELCOME BACK" label — it uses all-caps `"WELCOME BACK"` which is misaligned with the rounded-friendly brand personality. Replace with a regular `<Text>` heading: `"Welcome back"` (title case), `fontSize: 28`, `fontWeight: '700'`, `color: colors.foreground`

**D2. `apps/mobile/app/pages/SignUpPage.tsx`** — Complexity: Medium
- Same pattern as LoginPage
- User type selector (Client / Barber tabs) → replace inline TouchableOpacity pair with `<TabsList>/<TabsTrigger>` from `ui/tabs.tsx`
- Checkbox for terms agreement → use `ui/checkbox.tsx` component
- Inline TextInput wrappers → `<Input />`
- Form container → `<Card variant="hero">`
- Remove all-caps `"CREATE ACCOUNT"` → `"Create an Account"` (title case)

**D3. `apps/mobile/app/pages/SettingsPage.tsx`** — Complexity: Medium
- Tab navigation: currently uses underline indicator (`borderBottomWidth: 2`) → change to pill/chip pattern matching `ui/tabs.tsx`
- Replace the custom tab rendering loop with `<TabsList>` and `<TabsTrigger>` from `ui/tabs.tsx`
- Logout button: currently `borderRadius: 12` (`rounded-xl`) → verify uses `theme.borderRadius.xl` or `'2xl'`
- Delete account card: verify uses token-based colors (already done in previous session — spot check)
- Header icon container: `p-4 rounded-full` → keep as `borderRadius: full`

**D4. `apps/mobile/app/pages/BrowsePage.tsx`** — Complexity: High (partially done)
- Re-audit all remaining hardcoded `rgba` values (the previous session did a pass but may have missed some in nested sub-components)
- `BarberRating` sub-component: verify `useTheme()` is present
- `ReviewsList` sub-component: verify `useTheme()` is present
- Toggle container (grid vs list view): verify uses `colors.muted` not `bg-white/10`
- Replace any remaining `border-white/10` Tailwind classes with `{ borderColor: colors.glassBorder }`

**D5. `apps/mobile/app/pages/CutsPage.tsx`** — Complexity: Low (done in previous session — spot check)
- Verify `RefreshControl` uses `colors.secondary` or `colors.primary` for tint
- Verify no remaining hardcoded `backgroundColor: 'black'`

**D6. `apps/mobile/app/pages/CalendarPage.tsx`** — Complexity: Medium (done in previous session — spot check)
- Verify `placeholderTextColor` uses `colors.mutedForeground` not hardcoded rgba
- Verify all modal overlays use `colors.backdrop`

**D7. `apps/mobile/app/pages/BarberOnboardingPage.tsx`** — Complexity: Medium (done in previous session — spot check)
- Verify card containers use `colors.glass` and `colors.glassBorder`
- Verify progress indicators use `colors.primary`

**D8. `apps/mobile/app/pages/ProfilePreview.tsx`** — Complexity: Medium (done in previous session — spot check)
- Verify banner overlays use `colors.backdrop` not hardcoded `bg-black/40`

**D9. `apps/mobile/app/pages/ProfilePortfolio.tsx`** — Complexity: Medium (done in previous session — spot check)
- Verify portfolio grid items use theme tokens not hardcoded rgba

**D10. `apps/mobile/app/pages/BookingCalendarPage.tsx`** — Complexity: High (NOT YET DONE)
- Read and fully audit the file
- All `rgba(255,255,255,0.x)` → `colors.glass / colors.glassBorder`
- All `rgba(0,0,0,0.x)` → `colors.backdrop`
- All `color: 'white'` → appropriate foreground token
- Time slot selection states: selected → `colors.primary`, unavailable → `colors.muted`, available → `colors.surface`
- Date picker: selected date → `colors.primary` background + `colors.primaryForeground` text; today → `colors.primaryTint` background + `colors.primary` text

**D11. `apps/mobile/app/pages/FindBarberPage.tsx`** — Complexity: Medium (NOT YET DONE)
- Read and fully audit the file
- Search input → `<Input />` from `ui/Input.tsx`
- Filter chips/tags → `<Badge variant="soft">` when selected, `<Badge variant="outline">` when unselected
- List cards → `<Card variant="elevated">` or direct `borderRadius: theme.borderRadius['2xl']`

**D12. `apps/mobile/app/pages/BookingSuccessPage.tsx`** — Complexity: Low (NOT YET DONE)
- Read and audit
- Success icon: `colors.success` background circle with white icon
- CTA button: `<ActionButton variant="primary">` or `<Button size="hero">` — pick one and be consistent

**D13. `apps/mobile/app/pages/EmailConfirmationScreen.tsx`** — Complexity: Low (NOT YET DONE)
- Read and audit
- Likely simple — verify uses `AnimatedBackground`, `colors.foreground`, `colors.primary`

**D14. `apps/mobile/app/pages/TermsPage.tsx`** — Complexity: Low (NOT YET DONE)
- Read and audit
- Likely a content page — verify `ScrollView` background is `colors.background`, headings are `colors.foreground`, body text is `colors.mutedForeground`

**D15. `apps/mobile/app/pages/PrivacyPolicyPage.tsx`** — Complexity: Low (NOT YET DONE)
- Same as TermsPage

### Phase E — Settings Sub-components

All files under `apps/mobile/app/shared/components/settings/` must be audited:
- `ProfileSettings.tsx`
- `ServicesSettings.tsx`
- `AddonsSettings.tsx`
- `ShareSettings.tsx`
- `AvailabilityManager.tsx`
- `EarningsDashboard.tsx`

For each:
- Replace hardcoded rgba and color values with tokens
- Replace inline TextInput patterns with `<Input />`
- Replace inline button patterns with `<Button>` from `ui/Button.tsx`
- Replace inline card containers with `<Card variant="elevated">` or `<Card>`

---

## Part 5 — Consistency Rules (Enforce These Everywhere)

These are the standing rules to apply as a checklist after every file edit:

### Button Rules
1. One CTA per screen → `<ActionButton variant="primary">` OR `<Button size="hero" variant="default">` (pick one system per screen and be consistent — auth screens use `ActionButton`, inner app uses `ui/Button`)
2. Secondary/outline actions → `variant="secondary"` which is outlined (orange border, orange text, no fill)
3. Ghost actions (low emphasis) → `variant="ghost"` or `variant="link"`
4. Destructive → `variant="destructive"` with `colors.destructive` background
5. No inline `TouchableOpacity` styled to look like a button unless there is no matching variant — if you need a new variant, add it to `ui/Button.tsx`

### Color Rules
1. Never hardcode a `rgba(...)` value — always use a token (`colors.glass`, `colors.glassBorder`, `colors.backdrop`, `colors.primarySubtle`, `colors.primaryTint`)
2. Never hardcode `'white'` or `'black'` — use `colors.primaryForeground`, `colors.foreground`, `colors.background`
3. Never use `theme.colors.*` directly in a component — always go through `useTheme()`
4. `colors.secondary` background should be transparent (outlined style) — if you want a solid orange button, use `colors.primary`
5. Stars/rating indicators → `colors.premium` (amber), not `#FFD700`
6. Error text/borders → `colors.destructive`
7. Success indicators → `colors.success`
8. Informational indicators → `colors.info`

### Border Radius Rules
1. All interactive elements (buttons, inputs, selects, checkboxes, toggles): minimum `theme.borderRadius.xl` (12px)
2. Pill/tag/badge shapes: `theme.borderRadius.full`
3. Icon circles: `theme.borderRadius.full`
4. Card containers: `theme.borderRadius.xl` default, `'2xl'` elevated, `'3xl'` hero
5. Never use `borderRadius: 4` or `borderRadius: 6` on anything user-facing

### Typography Rules
1. Page titles: `fontSize: 28`, `fontWeight: '700'`, `color: colors.foreground` — title case, not ALL CAPS
2. Section headers: `fontSize: 18`, `fontWeight: '600'`, `color: colors.foreground`
3. Body text: `fontSize: 16`, `fontWeight: '400'`, `color: colors.foreground`
4. Secondary/caption text: `fontSize: 14`, `color: colors.mutedForeground`
5. Micro/label text: `fontSize: 12`, `color: colors.mutedForeground`
6. No ALL CAPS text except `Badge` labels and very short abbreviations (e.g. AM/PM)

### Shadow Rules
1. Cards with `variant="elevated"` → `theme.shadows.md`
2. Modals, bottom sheets, popovers → `theme.shadows.lg`
3. Primary action buttons → `shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12`
4. Flat/ghost elements → no shadow

---

## Part 6 — What NOT to Change

- Do not modify `TelematicsConnect.jsx` under any circumstances.
- Do not change the `AnimatedBackground` particle animations — only the colors.
- Do not change the `ActionButton` animation system (scale + glow on press) — only tokens.
- Do not change navigation structure, route names, or data-fetching logic.
- Do not change any Supabase query, auth logic, or business logic.
- The existing `getResolvedColors` function in `theme.ts` must not be restructured — only token values change.

---

## Part 7 — Implementation Order for Agent

Execute the phases strictly in order. Do not start Phase B until Phase A is complete. Do not start Phase C until Phase B is complete. Within each phase, work file-by-file in the order listed. After each file, run `npx tsc --noEmit` (or the project's equivalent lint/type check command) to confirm no type errors were introduced before moving to the next file.

**Recommended execution sequence for a single agent session**:
1. `theme.ts` — all token changes
2. `ui/Button.tsx`
3. `ui/Badge.tsx`
4. `ui/Card.tsx`
5. `ui/Input.tsx`
6. `ActionButton.tsx`
7. `ui/tabs.tsx` (verify/spot check)
8. `ui/Alert.tsx`, `ui/progress.tsx`, `ui/LoadingSpinner.tsx`
9. `AnimatedBackground.tsx`, `AnimatedLogo.tsx`
10. `LoginPage.tsx`
11. `SignUpPage.tsx`
12. `SettingsPage.tsx`
13. `BrowsePage.tsx` (re-audit)
14. `BookingCalendarPage.tsx`
15. `FindBarberPage.tsx`
16. `BookingSuccessPage.tsx`
17. `EmailConfirmationScreen.tsx`
18. `TermsPage.tsx`, `PrivacyPolicyPage.tsx`
19. Settings sub-components (Profile, Services, Addons, Share, Availability, Earnings)
20. Final lint + type check pass across all modified files

---

## Part 8 — Success Criteria

The refactor is complete when all of the following are true:

1. **Color hierarchy is visible**: Primary buttons (orange fill) and secondary buttons (orange outline, transparent fill) look meaningfully different at a glance. No two competing warm color accents appear on the same screen.
2. **Token purity**: `rg "rgba(" apps/mobile/app` returns zero results outside of `theme.ts`, `AnimatedBackground.tsx`, and any intentional animation overlay that uses a named color constant.
3. **No direct theme references**: `rg "theme\.colors\." apps/mobile/app` returns zero results outside of `theme.ts` itself. All component code accesses colors through `useTheme()`.
4. **Border radius consistency**: No interactive element has a `borderRadius` below 12. No `borderRadius: 4`, `borderRadius: 6`, or `borderRadius: 8` appears on buttons or input fields.
5. **No inline TextInput wrappers**: All `height: 56, borderRadius: 20, backgroundColor: colors.input` inline patterns are replaced by `<Input />`.
6. **No ALL CAPS headings**: Page titles and section headings use title case, not `"WELCOME BACK"` or `"CREATE ACCOUNT"`.
7. **TypeScript passes**: `npx tsc --noEmit` returns 0 errors.
8. **Both modes readable**: Every screen has been visually verified (or linted) in both light and dark mode — no white text on white backgrounds, no invisible borders, no orange-on-orange contrast failures.

---

This plan is self-contained and ready to paste into a new Cursor Plan-mode chat. The agent should read `theme.ts` at the start of each session to confirm current token state, then work through Phase A → B → C → D → E in order without skipping ahead.
