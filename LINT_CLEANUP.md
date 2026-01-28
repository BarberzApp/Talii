summary:
This lint pass is driven by `npm run lint` from the repo root, which
currently targets the web app (`apps/web`) via workspaces.
Primary error buckets are: unused vars/imports, `any` typing,
hook dependency issues, conditional hook usage, unescaped entities,
`<img>` usage, and prefer-const.
High-impact areas include route pages under `apps/web/src/app`,
feature components under `apps/web/src/features`, and shared UI
components under `apps/web/src/shared`.
We will remove dead code only after confirming no other file uses it.
Hook fixes must be done carefully to avoid behavior changes.
Any replacements should be specific (interfaces/types) rather than
`any`, and should match the data contract being used.
API route lint errors that come from `require` or `any` need to be
converted to ES import and typed inputs/outputs.
Where `next/image` is appropriate, `<img>` should be swapped to `<Image>`
with valid `width`/`height` or `fill`, and local assets moved to `public`
if needed.
This cleanup should not touch `TelematicsConnect.jsx`.

checklist:
- [ ] Re-run `npm run lint` to refresh the error list and ensure it still
      matches the snapshot from the last run.
- [ ] Remove unused imports/vars in key route pages:
      `apps/web/src/app/(routes)/login/page.tsx`,
      `apps/web/src/app/(routes)/register/page.tsx`,
      `apps/web/src/app/book/[username]/page.tsx`,
      `apps/web/src/app/calendar/page.tsx`,
      `apps/web/src/app/cuts/page.tsx`,
      `apps/web/src/app/landing/landing-page.tsx`.
- [ ] Remove unused imports/vars in high-churn features:
      `apps/web/src/features/settings/components/profile-portfolio.tsx`,
      `apps/web/src/features/settings/components/profile-settings.tsx`,
      `apps/web/src/features/settings/components/enhanced-barber-profile-settings.tsx`,
      `apps/web/src/features/calendar/components/page.tsx`.
- [ ] Fix conditional hook usage and missing dependencies:
      `apps/web/src/app/book/[username]/page.tsx`,
      `apps/web/src/features/auth/components/register/page.tsx`,
      `apps/web/src/features/auth/hooks/use-auth.tsx`,
      `apps/web/src/features/booking/components/page.tsx`.
- [ ] Replace `any` with specific types in API routes:
      `apps/web/src/app/api/connect/*/route.ts`,
      `apps/web/src/app/api/webhooks/stripe/route.ts`,
      `apps/web/src/app/api/create-checkout-session/route.ts`,
      `apps/web/src/app/api/mobile/*/route.ts`.
- [ ] Convert `require` to ES imports in:
      `apps/web/src/app/api/bookings/check-reminders/route.js`,
      `apps/web/src/app/api/bookings/send-sms/route.js`.
- [ ] Replace `<img>` with Next `<Image />` in:
      `apps/web/src/app/book/[username]/page.tsx`,
      `apps/web/src/app/landing/landing-page.tsx`,
      `apps/web/src/shared/components/admin/UserProfileManager.tsx`,
      `apps/web/src/features/settings/components/profile-portfolio.tsx`.
- [ ] Fix unescaped entities in pages and shared components:
      `apps/web/src/app/landing/landing-page.tsx`,
      `apps/web/src/app/booking/success/page.tsx`,
      `apps/web/src/shared/components/admin/AdminRouteGuard.tsx`.
- [ ] Apply prefer-const where lint reports it:
      `apps/web/src/app/barber/onboarding/page.tsx`,
      `apps/web/src/features/settings/components/enhanced-barber-profile-settings.tsx`.

results and sanity check:
Run `npm run lint` from the repo root and confirm zero errors.
Spot-check core flows in the web app:
- Login and Register (routes under `/login` and `/register`).
- Booking flow (public booking page and booking success/cancel).
- Barber onboarding and settings pages.
- Calendar and browse pages render without console errors.
If any hook change alters behavior, revert the hook dependency change
and refactor the logic with `useCallback`/`useMemo` to stabilize deps.
Document any remaining lint warnings that are intentionally deferred.
