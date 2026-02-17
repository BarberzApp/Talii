# Landing Spacing Reference

Landing spacing is controlled by CSS custom properties in `apps/web/src/app/globals.css` (`:root`). All landing components use these tokens so rhythm can be tuned in one place. Current values match the **BOCM React landing** (py-16 sm:py-20 sections, pt-24 sm:pt-32 hero, etc.).

## Talii landing tokens (BOCM values)

| Variable | Default | @ sm+ | Purpose |
|----------|---------|-------|---------|
| `--landing-section-py` | 4rem (64px) | — | Section vertical padding (py-16) |
| `--landing-section-py-sm` | — | 5rem (80px) | Section vertical @ sm+ (py-20) |
| `--landing-hero-pt` | 6rem (96px) | — | Hero top (pt-24) |
| `--landing-hero-pt-sm` | — | 8rem (128px) | Hero top @ sm+ (pt-32) |
| `--landing-hero-pb` | 4rem (64px) | — | Hero bottom (pb-16) |
| `--landing-hero-pb-sm` | — | 6rem (96px) | Hero bottom @ sm+ (pb-24) |
| `--landing-hero-gap` | 3rem (48px) | — | Hero content ↔ visual (gap-12) |
| `--landing-hero-gap-lg` | — | 4rem (64px) | Hero gap @ lg+ (gap-16) |
| `--landing-block-mb` | 3rem (48px) | — | Margin below section titles (mb-12) |
| `--landing-block-mb-sm` | — | 4rem (64px) | Section title margin @ sm+ (mb-16) |
| `--landing-block-mb-compact` | 2rem (32px) | — | Calculator section header (mb-8) |
| `--landing-block-mb-compact-sm` | — | 3rem (48px) | Calculator header @ sm+ (mb-12) |
| `--landing-grid-gap` | 1.5rem (24px) | — | Feature/testimonial grid (gap-6) |
| `--landing-grid-gap-sm` | — | 2rem (32px) | Grid gap @ sm+ (gap-8) |
| `--landing-cta-inner-py` | 2rem (32px) | — | CTA card inner vertical (p-8) |
| `--landing-cta-inner-py-sm` | — | 3rem (48px) | CTA inner @ sm+ (p-12) |

## Components using these tokens

- **LandingSection**: `--landing-section-py`, `--landing-section-py-sm`
- **HeroSection**: hero pt/pb and grid gap variables
- **FeatureGrid**: `--landing-block-mb`, `--landing-block-mb-sm`, `--landing-grid-gap`, `--landing-grid-gap-sm`
- **TestimonialSection**: same block-mb and grid-gap (via LandingSection for section padding)
- **RevenueCalculator**: `--landing-block-mb-compact`, `--landing-block-mb-compact-sm` (calculator header only)
- **CTASection**: section padding (band variant); `--landing-cta-inner-py` / `-sm` for band inner and card variant

## BOCM source (reference)

Values above match the BOCM React landing snippet: hero `pt-24 sm:pt-32 pb-16 sm:pb-24`, sections `py-16 sm:py-20`, calculator header `mb-8 sm:mb-12`, features/testimonials header `mb-12 sm:mb-16`, feature grid `gap-6 sm:gap-8`, CTA card `p-8 sm:p-12`. Adjust variables in `globals.css` to change spacing site-wide.
