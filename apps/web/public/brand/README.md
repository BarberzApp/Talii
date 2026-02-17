# Talii Brand Assets

This directory contains Talii logo assets for use across the application.

## Required Assets

Place the following logo files in this directory:

- `talii-logo.png` - Primary logo for **light-theme** landing and nav (white/light backgrounds). Used by default in the landing navbar and can be used in the footer.
- `talii-logo-dark.svg` - Logo optimized for light or mid-tone backgrounds (dark logo)
- `talii-logo-light.svg` - Logo optimized for dark backgrounds (light logo)
- `talii-logo-mark.png` - Icon-only variant for favicons, app icons, and tight spaces

## Usage

- **Light-theme landing (current)**: Use `talii-logo.png` in the nav and optionally in the footer.
- **Web navigation (dark background)**: Use `talii-logo-light.svg`
- **Hero sections (dark)**: Use `talii-logo-light.svg` on dark backgrounds
- **Light backgrounds (SVG variant)**: Use `talii-logo-dark.svg`
- **Favicons/app icons**: Use `talii-logo-mark.png`

If you add a dark theme later, switch the landing nav default to `talii-logo-light.svg` for dark backgrounds.

## Logo Specifications

- **Clear space**: Maintain at least 1× logo height of empty space around the logo
- **Minimum size**: 24px height for navigation, 72px+ for hero sections
- **Do not**: Skew, stretch, recolor, or add hard drop shadows

See `docs/talii-landing-ui-spec.md` section 2 for complete logo usage guidelines.
