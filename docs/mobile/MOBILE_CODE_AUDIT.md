# Mobile Code Audit (Components + Theme)

This audit focuses on `apps/mobile/app` components, routed pages, and the shared theme.

## Scope Reviewed
- Components: `apps/mobile/app/shared/components`, `apps/mobile/app/shared/components/ui`, `apps/mobile/app/components`
- Pages/Screens: `apps/mobile/app/pages`, `apps/mobile/app/screens`
- Navigation: `apps/mobile/app/navigation/AppNavigator.tsx`
- Theme: `apps/mobile/app/shared/lib/theme.ts`

## Findings

### 1) Unused or Legacy Components

#### UI components with no usage outside exports
These are exported in `apps/mobile/app/shared/components/ui/index.ts`, but not referenced elsewhere in `apps/mobile/app`:
- `Accordion` (`shared/components/ui/accordion.tsx`)
- `AlertDialog` (`shared/components/ui/alert-dialog.tsx`)
- `DropdownMenu` (`shared/components/ui/dropdown-menu.tsx`)
- `HoverCard` (`shared/components/ui/hover-card.tsx`)
- `Menubar` (`shared/components/ui/menubar.tsx`)
- `NavigationMenu` (`shared/components/ui/navigation-menu.tsx`)
- `ScrollArea` (`shared/components/ui/scroll-area.tsx`)
- `Slider` (`shared/components/ui/slider.tsx`)
- `ToggleGroup` (`shared/components/ui/toggle-group.tsx`)
- `Calendar` (`shared/components/ui/calendar.tsx`)
- `Skeleton` (`shared/components/ui/skeleton.tsx`)

#### UI helpers not wired into the app
No in-app usage found:
- `LoadingProvider` (`shared/components/ui/LoadingProvider.tsx`)
- `ErrorBoundary` (`shared/components/ui/ErrorBoundary.tsx`)
- `ErrorState` (`shared/components/ui/ErrorState.tsx`)
- `LoadingState` (`shared/components/ui/LoadingState.tsx`)

#### Components only used in the legacy test screen
These appear only in `apps/mobile/app/pages/UIComponentsTestPage.tsx`, which is not routed:
- `Form`, `FormField`, `FormMessage` (`shared/components/ui/form.tsx`)
- `Textarea` (`shared/components/ui/textarea.tsx`)
- `RadioGroup` (`shared/components/ui/radio-group.tsx`)
- `Progress` (`shared/components/ui/progress.tsx`)
- `Separator` (`shared/components/ui/separator.tsx`)
- `Toast`, `Toaster`, `useToast` (`shared/components/ui/toast.tsx`, `toaster.tsx`, `use-toast.ts`)

Note: `useToast` is used in hooks (`shared/hooks/useCuts.tsx`, `shared/hooks/useData.tsx`, `shared/helpers/accountDeletionHelper.ts`), but there is no global `Toaster` mount in the app, so toast UI never renders.

#### Shared components with no usage
No in-app usage found:
- `SocialProof` (`shared/components/SocialProof.tsx`)
- `TimePicker` (`shared/components/TimePicker.tsx`)
- `LayoutWrapper` (`shared/components/layout/LayoutWrapper.tsx`)
- `PageHeader` (and `ProfileHeader`, `BrowseHeader`, `BookingHeader`) (`shared/components/layout/PageHeader.tsx`)

#### Legacy/test screens not registered in navigation
Not referenced in `AppNavigator`, so these are currently unreachable:
- `UIComponentsTestPage` (`pages/UIComponentsTestPage.tsx`)
- `NotificationTestPage` (`pages/NotificationTestPage.tsx`)
- `OptimizedFeedScreen` (`screens/OptimizedFeedScreen.tsx`)

### 2) Main Pages with Inline UI (Component Extraction Targets)

#### `pages/BrowsePage.tsx`
Inline components that should be extracted into shared components for reuse and maintainability:
- `BarberRating` (rating + likes UI)
- `ReviewsList` (modal list + actions)
- `BarberCard` (the main barber list card with cover, avatar, stats, and CTA buttons)
- Filter chips, search header, and location status banner

Suggested components:
- `BarberCard`, `RatingStars`, `ReviewList`, `FilterChip`, `LocationStatusBanner`

#### `pages/LoginPage.tsx` and `pages/SignUpPage.tsx`
Both pages have hand-built text inputs, password fields, and CTA buttons instead of the shared input and button components:
- Extract `AuthHeader`, `AuthTextField`, `PasswordField`, and `AuthActions`
- Standardize on `ActionButton` or shared `Button` variants for CTAs

#### `pages/CalendarPage.tsx`
The calendar and modal UIs are built inline. This is a prime candidate for extraction:
- `CalendarHeader` (month controls and filters)
- `CalendarGrid` and `DayCell`
- `EventCard` (viewing and status actions)
- `ManualAppointmentForm`

Note: The unused `shared/components/ui/calendar.tsx` could be reused or removed to avoid duplication.

#### `pages/BookingCalendarPage.tsx`
The header and "quick info" section are inline:
- Extract `BookingIntroHeader` and `BookingQuickInfoList`
- Consider shared CTA button component usage

#### `pages/ProfilePreview.tsx` and `pages/ProfilePortfolio.tsx`
Large duplicated sections that could be shared between the two screens:
- `ProfileHero` (cover + avatar + header)
- `ProfileStatsRow` (likes, views, followers)
- `PortfolioGrid` (video/photo grid)
- `ServicesList` or `ServiceCard`

### 3) Theme and Global Colors Audit

#### Used `theme.colors` keys (by grep)
`accent`, `background`, `border`, `card`, `cardForeground`, `destructive`, `destructiveForeground`, `foreground`, `input`, `lightGrey`, `muted`, `mutedForeground`, `popover`, `popoverForeground`, `primary`, `primaryForeground`, `ring`, `saffronBrown`, `secondary`, `secondaryForeground`, `success`, `warning`

#### Unused color tokens (candidate removals or re-alignment)
Defined in `shared/lib/theme.ts` but not referenced in `apps/mobile/app`:
- `grey`
- `coffeeBrown`
- `beige`
- `darkGrey`
- `bookingHighlight`
- `socialInstagram`, `socialTwitter`, `socialTiktok`, `socialFacebook`
- `premium`
- `glass`, `glassBorder`

#### Redundant color tokens
These are the same hex value and can be consolidated:
- `secondary` and `saffronBrown` (`#c78e3f`)
- `background` and `grey` (both `#272a2f`) but `grey` is unused

#### Gradient usage
Only `theme.gradients.background` and `theme.gradients.button` are used.
Unused gradients:
- `primary`, `glass`, `logo`, `text`, `glow`

## Checklist of Fixes

### 1) Components and Screens
- [x] Remove or relocate unused UI components (Accordion, AlertDialog, DropdownMenu, HoverCard, Menubar, NavigationMenu, ScrollArea, Slider, ToggleGroup, Calendar, Skeleton).
- [x] Decide whether to delete legacy screens or put behind a dev-only route: `UIComponentsTestPage`, `NotificationTestPage`, `OptimizedFeedScreen`.
- [x] Wire `Toaster` into the app root (e.g., `App.tsx`) if `useToast` is intended to show UI.
- [x] Remove or implement `LoadingProvider`, `LoadingState`, `ErrorBoundary`, `ErrorState` depending on the desired error/loading strategy.
- [x] Remove or integrate unused shared components: `SocialProof`, `TimePicker`, `LayoutWrapper`, `PageHeader`.

### 2) Page-level Componentization
- [ ] Extract `BarberCard`, `BarberRating`, and `ReviewsList` from `BrowsePage` into shared components.
- [ ] Create shared `AuthTextField` and `PasswordField` components and refactor `LoginPage` and `SignUpPage`.
- [ ] Break `CalendarPage` into `CalendarHeader`, `CalendarGrid`, `EventCard`, and `ManualAppointmentForm` components.
- [ ] Extract `BookingIntroHeader` and `BookingQuickInfoList` from `BookingCalendarPage`.
- [ ] Extract `ProfileHero`, `ProfileStatsRow`, and `PortfolioGrid` for `ProfilePreview` + `ProfilePortfolio`.

### 3) Theme Cleanup
- [ ] Remove or repurpose unused colors in `theme.ts` (see list above).
- [ ] Consolidate `secondary` and `saffronBrown` into a single token.
- [ ] Remove or rehome unused gradients (`primary`, `glass`, `logo`, `text`, `glow`).
