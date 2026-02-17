## Talii Landing Experience – UI/UX Design Spec (Web First, Then Mobile)

This document defines the **visual and interaction system** for the new **Talii** landing experience, grounded in:

- The existing BOCM/Talii product and design system in the repo.
- Modern **2025–2026** web landing and mobile UI best practices.
- The new **Talii** brand and logo.

The goal is that an AI or engineer can **implement or refactor** the landing pages and related components **purely from this file**, without needing additional design tools.

---

## 1. Scope & Principles

- **Scope**
  - Web: `apps/web/src/app/landing/landing-page.tsx` + related layout and shared UI primitives.
  - Mobile: `apps/mobile/app/pages/HomePage.tsx` and adjacent onboarding/entry experiences.
  - Brand tokens: Tailwind / CSS variables (web) and the theme module (mobile).
- **High-level principles**
  - **Clarity over aesthetics**: Users must understand what Talii does within **3–5 seconds** of arriving.
  - **Proof over promises**: Real metrics, testimonials, and interactive previews above the fold where possible.
  - **Reduced friction**: Short, obvious paths from interest → action, both web and mobile.
  - **Consistency**: Web and mobile share palette, typography, and spacing logic even if layouts differ.
  - **Performance & accessibility**: Lightweight animations, optimized media, strong contrast, and keyboard/screen reader support.

---

## 2. Brand & Logo Usage

### 2.1 Logo File & Variants

- **Source asset**
  - Current logo file (reference only, do not move):  
    - `~/Library/Application Support/Cursor/User/workspaceStorage/.../Talii_Logo.pdf`
  - When integrating into the codebase, store exported versions (SVG + PNG) under a stable path, for example:
    - Web: `apps/web/public/brand/talii-logo-dark.svg`
    - Mobile: `apps/mobile/app/assets/brand/talii-logo-dark.png`
- **Variants to maintain**
  - `talii-logo-dark` – optimized for **light or mid-tone** backgrounds.
  - `talii-logo-light` – optimized for **dark** backgrounds.
  - Optional: mark-only variant (icon without text) for tight spaces (favicons, app icon derivations, etc.).

### 2.2 Placement & Hierarchy

- **Web**
  - **Top nav**: logo at **top-left**, always clickable to home (`/landing` or `/`).
  - **Hero**: the hero headline, not the logo, is the visual focal point. The logo in nav should be **smaller and quieter** than the hero title.
  - **Footer**: logo can be repeated at a smaller size for brand anchoring.
- **Mobile**
  - **First-load welcome/onboarding**: center the logo near the top, with a **single strong headline** and primary action(s) beneath it.
  - **Authenticated app**: use the logo more sparingly; it can appear in intro modals or occasional empty states but not repeated on every screen.

### 2.3 Clear Space & Sizing

- **Clear space (web + mobile)**
  - Maintain at least **1× logo-wordmark height** of empty space **above and below** the logo in hero or full-screen welcome contexts.
  - In nav, maintain **0.5× logo height** padding to nav edges and adjacent nav items.
- **Sizing**
  - Web nav:
    - Height: **24–32px** for the logo mark/wordmark area.
    - Never exceed 40px in nav; the hero heading should be visually larger.
  - Mobile welcome:
    - Logo height: **72–96px** on phones; can scale up slightly on tablets.

### 2.4 Backgrounds & Misuse

- **Backgrounds**
  - Use **solid or extremely subtle gradient** backgrounds behind the logo.
  - Avoid:
    - Detailed photography directly behind the logo.
    - Low-contrast color-on-color combos that reduce legibility.
- **Do not**
  - Skew, stretch, recolor arbitrarily, or add hard drop shadows.
  - Place the logo in cramped badges or chips unless using an approved icon-only variant.

---

## 3. Color System

The Talii color system is **role-based** so implementation maps easily to Tailwind CSS variables on web and theme tokens on mobile.

> Note: When implementing, derive specific hex values from the logo’s primary accent(s) and existing palette in `apps/web/src/app/globals.css` and `apps/mobile/app/lib/theme.ts`, then update those files instead of hardcoding colors in components.

### 3.1 Core Color Roles

**Semantic tokens (web CSS variables & mobile theme keys):**

- `background`
  - Primary page background.
  - Web: typically a near-black charcoal or very light neutral; choose based on best logo and content contrast.
  - Mobile: match the same tonal direction where possible.
- `surface`
  - Card and section backgrounds that sit on top of `background`.
  - Slightly lighter/darker than `background` depending on theme.
- `primary`
  - Main brand/CTA color, derived from a **distinct accent** in the Talii logo.
  - Used for primary buttons, primary links, progress states.
- `primary-foreground`
  - Text/icon color on primary backgrounds.
  - Typically pure or near-white for contrast.
- `secondary`
  - Secondary accent color, likely the warm gold/saffron tone used in existing designs.
  - Used for badges, secondary CTAs, highlights in charts.
- `muted`
  - Subtle background for chips, muted sections, and info banners.
- `muted-foreground`
  - Text color for muted contexts.
- `border`
  - Dividers, card borders, input outlines in rest state.
- `input`
  - Input background color (if distinct from surface).
- `ring`
  - Focus ring color for web forms and interactive states.
- `destructive` / `destructive-foreground`
  - Errors and destructive actions.
- `success` / `success-foreground`
  - Success feedback, positive stats.
- `warning` / `warning-foreground`
  - Warnings and caution states.
- `info` / `info-foreground`
  - Neutral informational banners.

### 3.2 States & Gradients

For each main role relevant to controls (`primary`, `secondary`, `destructive`), define state variants:

- **Hover**
  - Slightly darker/lighter variant (adjust L\* by 5–8).
  - Maintain or increase contrast with foreground text.
- **Active/pressed**
  - More pronounced darkening/lightening; reduced elevation (shadow) on web.
- **Disabled**
  - Lower saturation and contrast; ensure disabled text still passes **3:1** contrast ratio against its background.
- **Soft/ghost variants**
  - `primary-soft`: light tint of primary, used for chips, highlight cards, or banners.
  - `secondary-soft`, etc., as needed.

**Gradients (optional, web hero only):**

- Very subtle top-to-bottom or radial gradient between two close neutrals or between a brand color and neutral.
- Avoid high-contrast rainbow gradients; they reduce clarity and legibility.

### 3.3 Usage Patterns

- **Hero**
  - Background: `background` or a subtle gradient.
  - Main CTA: `primary` background with `primary-foreground` text.
  - Secondary CTA: outlined or ghost version using `secondary` or neutral.
  - Small accents (icons, underlines, tiny shapes) can use `secondary` and `saffron`-like accents.
- **Body sections**
  - Predominantly neutral `background` and `surface`.
  - Use accent colors for:
    - Icons, metrics.
    - Section overlines (small label above a headline).
    - Important links and actions.
- **Testimonial and calculator sections**
  - Can use a darker or lighter `surface` to distinguish from surrounding content.
  - Use `primary` or `secondary` for emphasis on numbers and CTA.

### 3.4 Accessibility Targets

- For any **body text** against its background: **≥ 4.5:1** contrast.
- For **large text** (≥ 24px regular or 18.66px bold) and icons: **≥ 3:1**.
- For **key interactive elements**:
  - The component in rest + hover state should remain ≥ 3:1 vs surrounding background.
  - Focus outline `ring` must be visually obvious at a glance.

When implementing, run colors through a contrast checker (e.g., WCAG contrast tools) before finalizing.

---

## 4. Typography System

### 4.1 Typefaces

- **Web**
  - **Display / Hero**: Bebas Neue (or closest available), all-caps, used **sparingly**.
  - **Body / UI**: Inter (or system fallback sans) for all paragraph text, labels, buttons, and form inputs.
- **Mobile**
  - Use **platform system fonts**:
    - iOS: SF Pro.
    - Android: Roboto.
  - Try to mirror Inter-like sizing and weight choices for consistency with web.

Avoid specialty/script fonts (e.g. `font-pacifico`) unless explicitly used for a micro-branding moment; they should *not* appear in main navigation, form labels, or any functional text.

### 4.2 Type Scale

Use a modular scale tuned to both readability and hierarchy.

**Web (desktop baseline):**

- `display` (hero): **48–64px**, weight 600–700, letter-spacing slightly negative for Bebas.
- `h1`: **32–40px**, weight 600–700.
- `h2`: **24–28px**, weight 600.
- `h3`: **20–22px**, weight 500–600.
- `body-lg`: **18–20px**, weight 400–500.
- `body` (default): **16px**, weight 400.
- `caption/small`: **12–14px**, weight 400–500.

**Mobile (phone baseline):**

- `display`: **32–40px**.
- `h1`: **24–28px**.
- `h2`: **20–24px**.
- `body-lg`: **16–18px**.
- `body`: **14–16px**.
- `caption`: **12–13px**.

### 4.3 Line Height & Letter Spacing

- **Line-height**
  - Hero/display: **1.1–1.2** (tight).
  - Headings: **1.2–1.3**.
  - Body: **1.4–1.6** for comfortable reading.
- **Letter-spacing**
  - Bebas / display: small **negative** tracking to avoid airy feel at large sizes.
  - Body: use defaults or slight positive tracking at small sizes for readability.

### 4.4 Stylistic Rules

- Limit each view (hero + immediate fold, mobile screen) to **3–4 text styles** max:
  - E.g. hero heading, body, button label, small overline.
- Keep button text **sentence case** or **title case**, but be consistent across web and mobile.
- Avoid mixing multiple center and left alignments within the same section unless there is a clear hierarchy reason.

---

## 5. Spacing, Layout & Grids

### 5.1 Spacing System

Use an **8pt-based spacing system**, with occasional 4pt for fine-tuning:

- 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96

Map to tokens or Tailwind spacing (web) and theme spacing scale (mobile), reusing or extending what already exists.

### 5.2 Page Padding & Section Rhythm

- **Web (desktop)**
  - Top hero padding: **80–120px** from top of viewport/nav (depending on nav height).
  - Horizontal padding:
    - **≥ 24–32px** on small screens.
    - Use a centered max-width (e.g. `max-w-5xl` / `max-w-6xl`) with auto margins.
  - Vertical spacing between major sections:
    - **80–120px**.
- **Web (tablet)**
  - Top padding: ~**64px**.
  - Horizontal padding: **20–24px**.
  - Vertical spacing between sections: **64–96px**.
- **Mobile**
  - Top padding on primary screens: **48–64px** from safe area.
  - Horizontal padding: **16–20px**.
  - Vertical spacing between stacked components: **16–24px** for related items, **32–48px** between major blocks.

### 5.3 Layout Patterns (Web)

**Hero (desktop):**

- **Two-column layout**
  - Left: text stack (logo in nav above, overline, hero headline, subheadline, CTAs, supporting proof).
  - Right: product visual / interactive demo / illustration.
- Content alignment:
  - Left column generally left-aligned.
  - Right visual anchored to right side but responsive.
- Mobile behavior:
  - Stack: text first, then visual.
  - Center the CTAs on small screens.

**Bento grid (features/value props):**

- Use a **2×2 or 3×2 grid** depending on number of core benefits.
- Each card:
  - Icon or mini visual.
  - Short title line.
  - 1–2 line description.
  - Optional inline link.
- Maintain consistent heights and vertical padding inside each card.

**Testimonial band:**

- Could be a full-width band with one of the following:
  - 1–3 cards in a row on desktop with subtle hover elevation.
  - A horizontally scrollable list on mobile.
- Section should feel distinct from the rest (background or layout variation) but not overly noisy.

**Calculator section:**

- Encapsulated as a **feature block** with:
  - Left: text (title, explanatory copy).
  - Right: input and animated result.
- Provide **clear labels and defaults** (e.g. starting monthly revenue).

### 5.4 Alignment Rules

- Define a main **content column width** (e.g. 680–800px max for long text) and align headings, paragraph copy, and CTAs within that column.
- Align sections vertically, so key CTAs and headline blocks share optical centers across scroll.
- On mobile:
  - Align content to a single column with consistent left margin; center only key CTAs or hero headings when appropriate.

---

## 6. Web Landing Page: Section-by-Section Spec

This section translates best practices and the existing `LANDING_PAGE_STRUCTURE` docs into concrete section patterns for Talii.

### 6.1 Hero Section

- **Goal:** Make Talii’s purpose instantly clear and offer an obvious next step.

**Content:**

- Logo in nav (top-left, small).
- Overline (optional): short uppercased label, e.g. “FOR BEAUTY & GROOMING PROS”.
- **Hero headline**:
  - Outcome-focused, e.g. “Turn Every Appointment Into Predictable Growth with Talii”.
  - Use `display` or `h1` style.
- **Subheadline**:
  - 1–2 sentences describing **how Talii helps** (e.g., automating bookings, maximizing chair time, optimizing revenue).
- **Primary CTA**:
  - e.g. “Start with Talii” / “Start Growing with Talii”.
  - Primary button style with `primary` color.
- **Secondary CTA**:
  - e.g. “See how it works”.
  - Outlined or ghost button using neutral/secondary color.
- **Proof (above or below CTAs)**:
  - Short metric or trust badge (e.g. “Loved by independent stylists and barbers across [region]”).

**Visual:**

- Option A (preferred): Product preview / interactive demo inspired by existing dashboard + calendar.
- Option B: Tightly art-directed illustration that hints at:
  - Packed schedule.
  - Multiple income streams.
  - Happy clients.

**Behavior:**

- On page load, stagger animations (text fade-in, then CTAs, then visual).
- Keep motion **subtle** and performant (CSS transforms, opacity transitions).

### 6.2 Revenue / “Multiplier” Section

Based on existing “Revenue Multiplier” concept and research around **“aha moment”** UI:

- **Section title**: short, bold statement (e.g. “The Revenue Multiplier for Your Chair”).
- **Subheadline**: describes typical lift (e.g. “Talii pros often see 30–40% more revenue in their first 90 days.”).
- **Content layout**:
  - Left/right or top/bottom with copy + illustrative visual (chart, booking view, calendar snippet).
- **Key UI considerations**:
  - Use cards or a mini dashboard layout to show:
    - Monthly revenue.
    - Booking rate.
    - Average ticket size.
  - Keep numbers **plausible** and clearly “representative, not guaranteed”.

### 6.3 Features Section

Reflecting the “BUILT FOR PROFESSIONALS” section in existing docs:

- **Section title**: outcome-focused (e.g. “Built for How You Actually Work”).
- **Structure**:
  - 3–5 feature cards in a grid.
  - Each card includes:
    - Icon.
    - Title.
    - 1–2 line description.
    - (Optional) subtle badge like “Most used”.
- **Examples**:
  - Smart Booking.
  - Premium Pricing.
  - Client Retention.
  - Automated reminders.

### 6.4 Social Proof Section

- **Section title**: e.g. “Real Results from Real Pros”.
- **Content**:
  - 2–3 testimonial cards with:
    - Quote.
    - Name.
    - Role and city.
    - Key metric (e.g. “+300% revenue in 6 months”).
  - Optionally, a logo row of barbershops/salons using Talii (real or placeholders).
- **UI behavior**:
  - Card hover: slight elevation and scale, subtle shadow, no dramatic transformation.
  - On mobile: horizontally scrollable or vertically stacked.

### 6.5 Calculator / “Holy Sh*t Moment” Section

The calculator provides the **interactive proof** that research indicates improves conversion:

- **Inputs**:
  - Current monthly revenue (pre-filled with a realistic default, e.g. `$5,000`).
- **Outputs**:
  - Potential monthly revenue with typical lift (e.g. +30%).
  - Estimated extra yearly revenue.
- **UI considerations**:
  - Clear label and helper text explaining this is an **example estimate**.
  - Use `animateNumber`-style logic to animate output values for delight, but cap amounts and avoid unrealistic numbers.
  - Primary CTA below results that mirrors hero CTA label.

### 6.6 Final CTA Band

- **Section title**: e.g. “Ready to Grow with Talii?”.
- **Copy**: restates the core benefit and clearly articulates **risk-free nature** (trial, cancel anytime, etc., as applicable).
- **CTAs**:
  - Primary: start now / start free trial.
  - Secondary: book a demo or talk to someone.
- **Layout**:
  - Full-width band with contrasting background.
  - Mobile: stacked CTAs, no more than two.

### 6.7 Footer

- **Content**:
  - Logo (small).
  - Columnized links for Product, Support, Company.
  - Copyright line.
- **Behavior**:
  - Respect reduced motion preferences (no continuous animations here).

---

## 7. Mobile Home & Onboarding Alignment

The goal is **not** to duplicate the entire marketing landing on mobile, but to **echo the brand and core message** while staying focused on **entry flows** (sign up, log in, onboarding).

### 7.1 Entry / Welcome Screen (HomePage)

- **Structure**:
  - Top: Talii logo centered with sufficient clear space.
  - Middle: concise headline + 1–2 line subcopy.
  - Bottom: primary and secondary actions.

**Content:**

- Headline: 1 line that mirrors or shortens the web hero.
- Subcopy: describes immediate benefit, not everything Talii does.
- Primary CTA: “Get Started” / “Create an account”.
- Secondary CTA: “Log in”.

**UI rules:**

- Align main content to a vertical center or slightly above center.
- Use background consistent with web (`background` token).
- Avoid long carousels or multi-paragraph walls of text.

### 7.2 Progressive Onboarding

Research-backed guidance:

- Focus onboarding on **value**, not instruction:
  - Let users **do something meaningful** within the first 30 seconds.
- Keep onboarding steps **short**:
  - 2–4 screens max, with a clear progress indicator.
- Examples of screens:
  - Choose role (barber, stylist, etc.).
  - Select goal (fill schedule, increase prices, etc.).
  - Confirm or auto-detect location, time zone.

**UI patterns:**

- Use large tappable cards with:
  - Icon.
  - Short label.
  - Support text in smaller caption style if needed.
- Maintain 16–24px vertical spacing between items; 32–40px between groups.
- Always display a **next/continue** button anchored to the bottom of the screen with safe-area padding.

### 7.3 Navigation

- **Bottom tab bar** remains the primary pattern in-app:
  - 3–5 items max.
  - Icons + short labels (one word if possible).
  - Active tab clearly distinguished (color + weight).
- **Behavior**:
  - Tapping the currently active tab scrolls to the top of that stack if content is scrollable.
  - Don’t hide core navigation behind deep-level menus.

### 7.4 Spacing & Typography (Mobile)

- Use the same **spacing tokens** as web but scaled to mobile:
  - `xs 4`, `sm 8`, `md 16`, `lg 24`, `xl 32`, `xxl 48`.
- Text:
  - Headline: `h1` or `display` style (24–32px).
  - Body: 14–16px.
  - Button labels: 14–16px, medium/semibold.
- Maintain at least **16px** of padding from edges of the safe area for main content.

### 7.5 Microinteractions & Feedback

- Use **microinteractions** for:
  - Button presses (scale + opacity changes + subtle shadow).
  - Success/failure toasts.
  - Tab transitions.
- Include **haptic feedback** (where supported) on:
  - Primary button presses.
  - Completing key steps (e.g. finishing onboarding).
- Avoid:
  - Overly long or distracting animations.
  - Animations that delay users from taking action.

### 7.6 Dark Mode

- Mobile should fully support light/dark modes.
- Tokens:
  - Define per-mode values for `background`, `surface`, `primary`, etc.
  - Ensure text and control colors meet contrast requirements in both modes.
- Test:
  - Home, onboarding, and core tabs in both themes, including error states.

---

## 8. Cross-Platform Visual Language

This section summarizes how web and mobile should feel **the same**, even though they are implemented differently.

### 8.1 Shared Elements

- **Brand colors**: same primary/secondary palette and semantic roles.
- **Typography**: same hierarchy and relative sizes, adapted to platform.
- **Spacing**: identical spacing scale values, interpreted appropriately.
- **Components**:
  - Buttons: similar corner radii, color usage, and state behavior.
  - Cards: consistent elevation, radius, and padding.
  - Badges/Chips: same color semantics and general shape language.

### 8.2 Divergent but Coordinated Elements

- **Navigation**:
  - Web: top nav + scroll-based sections.
  - Mobile: bottom tabs + stacked screens.
- **Interactions**:
  - Web: hover states, scroll-triggered animations, parallax can be used subtly.
  - Mobile: tap, swipe, and haptic feedback; no hover.

### 8.3 Component Mapping Examples

- Web `Button` ↔ Mobile `Button`:
  - Variants: `default/primary`, `secondary`, `outline`, `ghost`, `link`.
  - States: rest, hover (web only), pressed, disabled, loading.
- Web `Card` ↔ Mobile `Card`:
  - Both use `surface` background, `border` or subtle shadow, and `md` radius.

---

## 9. Accessibility Guidelines

### 9.1 Web

- **Semantics**
  - Use proper heading structure (`h1` for hero title, `h2` for section titles).
  - Use `<main>`, `<nav>`, `<section>`, `<footer>` for major layout regions.
- **Keyboard navigation**
  - All interactive elements must be reachable and operable via keyboard.
  - Focus states must be visible and not removed.
- **ARIA**
  - Use ARIA roles only when native semantics are not sufficient.
  - Label inputs and calculator fields clearly with `<label>` elements.

### 9.2 Mobile

- **Touch targets**
  - Minimum **44×44pt** for interactive elements.
- **Screen readers**
  - Provide accessible labels for buttons and icons.
  - Order content logically so screen readers narrate in a sensible sequence.
- **Dynamic Type**
  - Prefer using scalable text where possible; ensure layouts do not break with larger text settings.

### 9.3 Color & Motion

- Respect user **prefers-reduced-motion** settings (web) and system motion settings (mobile).
- Provide ways to **avoid flashing or overly animated** sequences.

---

## 10. Performance Guidelines

### 10.1 Web

- **Images**
  - Use appropriately sized responsive images.
  - Prefer modern formats (e.g. WebP/AVIF) for hero visuals when available.
  - Lazy-load below-the-fold images and sections.
- **Scripts**
  - Avoid heavy animation libraries; favor CSS transitions and transforms.
  - Defer non-critical scripts and analytics where possible.

### 10.2 Mobile

- **Assets**
  - Optimize image dimensions to match usage; avoid loading large background images for small views.
- **Animations**
  - Use hardware-accelerated properties (opacity, transform).
  - Keep animation durations short (150–300ms) to avoid sluggish feel.

---

## 11. Pre-Built Components & External Resources

This section lists **specific external component libraries and resources** to leverage when implementing the Talii landing experience. Since you already have strong foundations (Radix UI + Framer Motion on web, Reanimated on mobile), these recommendations **complement** your existing stack rather than replace it.

### 11.1 Web Component Resources

**Your current stack (already installed):**
- ✅ Radix UI primitives (dialogs, dropdowns, etc.)
- ✅ Framer Motion for animations
- ✅ Tailwind CSS + class-variance-authority
- ✅ Lucide React icons

**Recommended additions for landing page:**

#### shadcn/ui Registry Components

You're already using Radix primitives, which is the foundation of shadcn/ui. Consider adding these **specific shadcn/ui patterns** via copy-paste (not npm install):

- **Hero components**
  - `hero-simple` — clean hero section pattern
  - `hero-with-video` — hero with embedded demo
  - `pricing-cards` — if you add pricing section later
- **Landing sections**
  - `feature-grid` — bento-style feature showcase
  - `testimonial-carousel` — scrollable testimonial cards
  - `stats-section` — metrics display for social proof
- **Interactive elements**
  - `animated-beam` — subtle connection lines between features
  - `marquee` — infinite scroll for logos or testimonials

**Where to find:** [shadcn/ui](https://ui.shadcn.com/) and community registries like [shadcnregistry.com](https://shadcnregistry.com/)

#### Magic UI (Animated Components)

**Magic UI** offers 150+ free animated components that work perfectly with your Framer Motion + Tailwind stack. Recommended components for Talii:

- **Hero animations**
  - `text-reveal` — animated hero headline entrance
  - `word-pull-up` / `word-fade-in` — staggered text animations
  - `shine-border` — animated border for primary CTA button
  - `shimmer-button` — micro-interaction on hover
- **Background effects**
  - `grid-pattern` / `dot-pattern` — subtle hero background
  - `animated-gradient-text` — for key numbers in calculator
- **Feature sections**
  - `bento-grid` — pre-built animated card layouts
  - `marquee` — for logo bands or continuous testimonials
  - `number-ticker` — animated revenue numbers in calculator

**Where to find:** [magicui.design](https://magicui.design/) — all components are free, copy-paste, and work with your existing stack.

**Usage example (calculator animated number):**
```tsx
import NumberTicker from "@/components/magicui/number-ticker";

<NumberTicker value={projectedRevenue} />
```

#### Aceternity UI (Landing-Specific Components)

**Aceternity UI** specializes in **landing page components** with Tailwind + Motion. Recommended for Talii:

- **Hero variants**
  - `hero-parallax` — subtle parallax scroll effect
  - `text-generate-effect` — typewriter-style hero text
- **Feature showcases**
  - `card-hover-effect` — 3D tilt on testimonial cards
  - `spotlight` — subtle mouse-follow effect on hero
- **Navigation**
  - `floating-navbar` — navbar that shows/hides on scroll
  - `navbar-menu` — animated mobile menu

**Where to find:** [ui.aceternity.com](https://ui.aceternity.com/)

#### Framer Motion Patterns (Already Installed)

Since you already have Framer Motion, use these specific patterns for landing sections:

- **Viewport-triggered animations:**
```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
  {/* Feature card */}
</motion.div>
```

- **Stagger children (for feature grid):**
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div variants={container} initial="hidden" whileInView="show">
  {features.map(f => (
    <motion.div key={f.id} variants={item}>
      {/* Feature card */}
    </motion.div>
  ))}
</motion.div>
```

#### Pre-Built Landing Page Templates (For Reference)

If you want to see complete implementations to reference:

- **Tailwind UI Marketing Components** (paid, high-quality) — [tailwindui.com/components/marketing](https://tailwindui.com/components/marketing)
- **shadcn Landing** (free examples) — [shadcn-landing.vercel.app](https://shadcn-landing.vercel.app/)
- **Magic UI Startup Template** (free example) — shows full landing page structure : https://magicui.design/docs/templates/Startup
- **Magic UI Mobile Template** (free example) - shows landing page structure for mobile app : https://magicui.design/docs/templates/mobile
- **Vercel templates** — [vercel.com/templates](https://vercel.com/templates) filtered for "landing" and "SaaS"

**Recommendation:** Browse these for layout inspiration and specific component patterns, then implement using your existing stack + the free component resources above.

### 11.2 Mobile Component Resources

**Your current stack (already installed):**
- ✅ React Native Reanimated for animations
- ✅ TailwindRN (twrnc) for styling
- ✅ Lucide React Native for icons
- ✅ Expo's comprehensive SDK

**Recommended additions for mobile landing/onboarding:**

#### NativeWind UI Patterns

Since you're using twrnc (TailwindRN), consider looking at **NativeWind** patterns for consistency with web Tailwind:

- You can keep twrnc but reference NativeWind component patterns for structure.
- **Resource:** [nativewind.dev](https://nativewind.dev/)

#### Neo UI (Copy-Paste Components)

**Neo UI** is built for Expo/React Native with Material Design aesthetics and includes:

- **Onboarding components**
  - Swipeable intro screens
  - Progress indicators
  - Animated welcome cards
- **Form components**
  - Modern input fields with labels
  - Button variants matching web semantics
- **Feedback**
  - Toast notifications
  - Loading states

**Where to find:** [docs.neo-ui.dev](https://docs.neo-ui.dev/)

**Note:** Since you already have a UI system documented in `UI_UPDATE_README.md`, use Neo UI for **pattern inspiration** rather than wholesale replacement.

#### React Native Reanimated Examples (Already Installed)

Leverage Reanimated for smooth onboarding and landing animations:

- **Fade-in entrance:**
```tsx
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

<Animated.View entering={FadeInUp.duration(600).delay(200)}>
  {/* Logo */}
</Animated.View>

<Animated.View entering={FadeInDown.duration(600).delay(400)}>
  {/* CTA buttons */}
</Animated.View>
```

- **Scale button press:**
```tsx
import { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';

// On press, scale down then back up
const scale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }]
}));
```

**Resource:** [React Native Reanimated Docs](https://docs.swmansion.com/react-native-reanimated/)

#### Expo Router UI Patterns

Since you're using Expo Router (~5.1.0), reference these layout patterns:

- **Onboarding flow:**
  - Stack navigator with modal presentation for onboarding screens
  - Progress indicator at top
- **Tab bar customization:**
  - Custom tab bar component with icon + label
  - Active state with scale/color change

**Resource:** [Expo Router Docs — Layouts](https://docs.expo.dev/router/layouts/)

#### React Native UI Libraries (For Specific Components)

If you need specific polished components beyond what you've built:

- **React Native Paper** — Material Design components (buttons, cards, inputs)
  - Only if you want to match Material Design exactly; otherwise your custom components are better.
- **React Native Elements** — Cross-platform UI toolkit
  - Good for reference, but you likely won't need to install given your existing UI system.

**Recommendation:** Stick with your existing custom components documented in `UI_UPDATE_README.md`, and only borrow patterns/animations from the resources above.

### 11.3 Icon & Illustration Resources

You already have **Lucide React** (web) and **Lucide React Native** (mobile), which is excellent for consistency.

**Additional icon sources (if needed):**
- **Heroicons** — [heroicons.com](https://heroicons.com/) (similar style to Lucide)
- **Phosphor Icons** — [phosphoricons.com](https://phosphoricons.com/) (more variety)

**Illustration resources (for hero/features):**
- **unDraw** — [undraw.co](https://undraw.co/) (free, customizable color)
- **Storyset** — [storyset.com](https://storyset.com/) (free animated illustrations)
- **Humaaans** — [humaaans.com](https://humaaans.com/) (mix-and-match people illustrations)

**Usage:** Export SVGs and integrate into your landing page hero or feature sections to add visual interest without heavy imagery.

### 11.4 Font Resources

Your spec calls for **Bebas Neue** (display) and **Inter** (body).

**Web:**
- Use Google Fonts or Fontsource for easy integration:
  - `@fontsource/bebas-neue`
  - `@fontsource/inter`
- Or use Next.js Font Optimization with `next/font/google`.

**Mobile:**
- Use Expo Google Fonts:
  - `expo install @expo-google-fonts/bebas-neue @expo-google-fonts/inter`
  - `import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';`

### 11.5 Implementation Strategy

**Step-by-step approach:**

1. **Web landing page:**
   - Start with your existing `landing-page.tsx` structure.
   - Copy-paste specific components from Magic UI or Aceternity UI for hero, features, and testimonials.
   - Use Framer Motion for viewport-triggered animations on scroll.
   - Integrate animated calculator from Magic UI's `number-ticker`.
   - Keep using your existing Radix primitives for dialogs, dropdowns, etc.

2. **Mobile home/onboarding:**
   - Refactor `HomePage.tsx` to match the welcome screen spec.
   - Use Reanimated for entrance animations (logo, headline, buttons).
   - Reference Neo UI patterns for onboarding flow structure, but keep your existing components.
   - Add haptic feedback via `expo-haptics` (already installed) on button presses.

3. **Shared design tokens:**
   - Update `apps/web/src/app/globals.css` and `tailwind.config` for web colors.
   - Update `apps/mobile/app/lib/theme.ts` for mobile colors.
   - Ensure color roles (primary, secondary, surface, etc.) match across both.

**Priority order:**
1. Colors and typography (foundation)
2. Hero section on web (highest impact)
3. Mobile welcome screen (parallel work)
4. Web features + social proof sections
5. Calculator and final CTA
6. Mobile onboarding flow refinement

---

## 12. Implementation Notes & Integration Points

### 12.1 Web Implementation Hooks

When ready to implement:

- Update **design tokens** in:
  - `apps/web/src/app/globals.css`
  - `apps/web/tailwind.config.js` (or equivalent config file)
- Refactor components in:
  - `apps/web/src/app/landing/landing-page.tsx`
  - Supporting shared components in `apps/web/src/shared/components/ui/`
- Ensure that existing behavior from `Landing_layout.md` and `LANDING_PAGE_STRUCTURE.md` is preserved or improved with:
  - Smooth scroll behavior.
  - Revenue calculator animation.
  - CTA analytics hooks.

### 12.2 Mobile Implementation Hooks

- Update or confirm theme tokens in:
  - `apps/mobile/app/lib/theme.ts`
- Align shared components documented in:
  - `apps/mobile/docs/ui/UI_UPDATE_README.md`
- Apply this spec to:
  - `apps/mobile/app/pages/HomePage.tsx` (welcome/entry experience).
  - Onboarding-related screens (e.g. `BarberOnboardingPage.tsx`).

> Constraint reminder: **Do not modify `TelematicsConnect.jsx`**; any future work must respect this rule.

---

## 13. Checklist for Future Implementation

When a dev/AI implements these guidelines, they should:

1. **Web**
   - [ ] Map color roles in `globals.css` and Tailwind config to Talii palette.
   - [ ] Refine `landing-page.tsx` structure to match hero → value → features → proof → calculator → final CTA → footer flow.
   - [ ] Ensure all sections meet spacing and typography rules herein.
2. **Mobile**
   - [ ] Align `HomePage.tsx` layout with the welcome screen guidance.
   - [ ] Ensure onboarding flows respect progressive onboarding principles.
   - [ ] Update or confirm theme tokens match the web palette and spacing.
3. **Cross-cutting**
   - [ ] Verify contrast ratios and accessibility behaviors.
   - [ ] Test performance (load times, animation smoothness) on realistic devices.

This spec is the **single source of truth** for the new Talii landing experience design. All future changes should either update this document or explicitly reference deviations from it.

---

## 14. Implementation Log & Next Steps

*Track what’s been done to the landing look and what to do next.*

### 14.1 What’s Been Done

**Theme & design tokens**

- **Light theme (white + orange)** in `apps/web/src/app/globals.css`: `--background` white, `--foreground` dark text, `--surface` / `--muted` light grays, `--primary` / `--secondary` / `--accent` set to Talii orange (#EE6D23). Fixed `--accent` typo, aligned `--primary-rgb` / `--secondary-rgb` and `--saffron` to Talii orange; `::selection` uses primary token.

**Logo**

- **Talii_Logo 1.png** copied to `apps/web/public/brand/talii-logo.png` and used as the default nav logo for the light-theme landing.
- **Single logo in nav**: only the logo image is shown (no duplicate “Talii” text). Logo size increased to `h-12 sm:h-14` with `w-auto` and `object-contain`. Mobile sheet uses the same asset at `h-14` with `max-w-[200px]`.
- `apps/web/public/brand/README.md` updated with usage for the light-theme logo.

**Landing layout & rhythm**

- **LandingSection** component added: standard section padding (`py-20 sm:py-24`) and container (`max-w-7xl` or `max-w-4xl`, `px-4 sm:px-6 lg:px-8`). FeatureGrid, TestimonialSection, RevenueCalculator, and CTASection (card variant) use it.
- Hero bottom padding set to `pb-20 sm:pb-24`; footer to `py-16 sm:py-20`.

**Component consistency**

- Primary/secondary **filled CTAs** use `text-primary-foreground` in HeroSection and LandingNavbar (no `text-black`).
- Outline CTAs use `border-border text-foreground hover:bg-muted` consistently.

**Visual polish**

- **Hero**: subtle gradient from `primary/[0.06]` at top fading out; soft orbs in background. Overline badge without an extra divider line.
- **Section titles**: no underlines/dividers under “Everything You Need to Scale” or “Success Stories” (dividers removed per feedback).
- **Features section**: `bg-surface/40` for slight contrast with adjacent sections. Cards use `bg-surface`, `border-border`, `rounded-2xl`, `shadow-xl`.
- **Navbar**: light bottom border removed; `bg-background/95 backdrop-blur-md`; no visible divider.

**Copy & behavior**

- **“Watch Real Results”** hero CTA points to `#testimonials` (Success Stories) instead of `/cuts`.
- **Testimonial avatars**: placeholder PNGs replaced with a **circle showing the first letter** of the person’s name (e.g. “C” for Chance, Caleb). Real `image` URL still used when provided and not a placeholder.

**Hero dashboard preview**

- **Revenue dashboard in hero** replaced the static mock card with the **actual** `EarningsDashboard` component (`apps/web/src/shared/components/payment/earnings-dashboard.tsx`) in **preview mode** with **fake numbers**.
- `EarningsDashboard` now supports:
  - **`preview?: boolean`** – no API or Stripe calls; uses fixed demo data; Stripe setup/dashboard buttons hidden.
  - **`variant?: "default" | "light"`** – `"light"` uses semantic tokens (foreground, surface, muted, border) for the landing.
- Preview data: $12,450 current month, +40% from last month; Service Fees $9,820, Platform Fees $2,630 (all fake).

### 14.2 Next Steps

**Landing & web**

- [ ] **Contrast check**: Confirm Talii orange (#EE6D23) + white text meets WCAG AA on primary CTAs; confirm focus rings are visible on all interactive elements.
- [ ] **Footer**: Optionally add the Talii logo (small) to the footer for brand anchoring; ensure clear space and sizing match §2.3.
- [ ] **Below-fold audit**: Any remaining hardcoded `text-white` / `bg-white/*` / `border-white/*` elsewhere in the app (e.g. auth, dashboard) can be switched to semantic tokens for consistency with the light theme.
- [ ] **App-wide brand**: Optional follow-up to use `talii-logo.png` and Talii orange in `not-found.tsx`, `loading-spinner.tsx`, and authenticated `navbar.tsx` for consistency.

**Mobile**

- [ ] **Theme**: If the same white + orange look is desired on mobile, update `apps/mobile/app/shared/lib/theme.ts` (e.g. background white, foreground dark, primary/secondary Talii orange).
- [ ] **HomePage**: Align `HomePage.tsx` with the landing welcome experience and logo usage per §2.

**Content & assets**

- [ ] Replace testimonial placeholder content with real names, roles, and quotes if available.
- [ ] Consider adding `talii-logo-dark.svg` and `talii-logo-mark.png` to `public/brand/` if needed for dark theme or favicons.

**Performance & QA**

- [ ] Run Lighthouse (target 90+); verify images (including `talii-logo.png`) are appropriately sized/cached.
- [ ] Test landing on small viewports; confirm nav logo and hero dashboard preview remain readable and don’t overflow.

