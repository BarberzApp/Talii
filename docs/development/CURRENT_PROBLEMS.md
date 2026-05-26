# Current Problems Log

This document tracks active compilation errors, linter violations, TypeScript warnings, and unverified changes across the workspaces. Historical entries in this log will serve as legacy documentation for refactoring tracking.

---

## 1. Web App Workspace (apps/web)

### Problem A: Conditional React Hook Call
* **File**: `apps/web/src/app/book/[username]/page.tsx` (Lines 268, 283)
* **Error**: React Hook useEffect is called conditionally. React Hooks must be called in the exact same order in every component render.
* **Proposed Resolution**: Remove conditional logic wrapping the useEffect hook calls. Move the conditional checks inside the hooks or pull them up to parent components.

### Problem B: Unescaped Quote Characters in JSX Templates
* **Files**: 
  - `apps/web/src/app/(routes)/privacy/page.tsx`
  - `apps/web/src/app/(routes)/terms/page.tsx`
  - `apps/web/src/app/barber/connect/return/page.tsx`
  - `apps/web/src/app/booking/success/page.tsx`
  - `apps/web/src/features/settings/components/addons-settings.tsx`
* **Error**: Quote character (e.g., `'` or `"`) must be escaped with HTML entities like `&apos;` or `&quot;`.
* **Proposed Resolution**: Run an automated script to find and replace unescaped quotes with standard HTML entities or wrap the text sections in string expressions.

### Problem C: Unused Variables and Imports
* **Files**: Over 50 files across components, route handlers, and hooks (e.g., `super-admin/page.tsx`, `settings/barber-profile/page.tsx`).
* **Error**: Variable or component is defined/imported but never used (eslint `@typescript-eslint/no-unused-vars`).
* **Proposed Resolution**: Conduct an automated cleanup using compiler options or manually prune unused imports and variables during localized file modifications.

### Problem D: Omitted useEffect Dependency Arrays
* **Files**: Multiple components in route flows and settings pages (e.g., `browse/page.tsx`, `auth/use-auth.tsx`).
* **Error**: React Hook useEffect has missing dependencies.
* **Proposed Resolution**: Review the hooks to include dependencies or wrap callbacks in useCallback/useMemo to prevent unwanted re-renders.

---

## 2. Mobile App Workspace (apps/mobile)

### Problem E: Forbidden require() Imports
* **Files**:
  - `apps/mobile/app/pages/BookingCalendarPage.tsx`
  - `apps/mobile/app/pages/BookingSuccessPage.tsx`
  - `apps/mobile/app/pages/FindBarberPage.tsx`
  - `apps/mobile/app/shared/components/BookingForm.tsx`
* **Error**: A require() style import is forbidden.
* **Proposed Resolution**: Refactor image and file assets loading to use ES6 import statements or dynamic imports where appropriate.

### Problem F: Array Generic Typing Violation
* **Files**:
  - `apps/mobile/app/pages/BarberOnboardingPage.tsx` (Line 93)
  - `apps/mobile/app/pages/ProfilePortfolio.tsx` (Lines 74, 81)
  - `apps/mobile/app/pages/ProfilePreview.tsx` (Line 71)
* **Error**: Array type using 'Array<T>' is forbidden. Use 'T[]' instead.
* **Proposed Resolution**: Rewrite types using brackets (e.g. `User[]`) to satisfy rule configurations.

---

## 3. General Status & Unverified Changes

### Problem G: Unverified API and Code Modifications
* **Scope**: Codebase modifications relating to the API gateways, booking routes, and layout structures have not been fully verified via runtime integration testing.
* **Status**: Local domain unit tests (`npm run test:shared`) pass successfully, but overall system workflows are currently unverified in staging or browser contexts.
* **Proposed Resolution**: Deploy the codebase changes to the local development environment, verify payments using the Stripe CLI webhooks listener, and run the complete booking flow manually or via browser automation.

---

## 4. Subagent Scanned Git Status Issues (Reverted on Disk)

### Problem H: ENOENT on Empty Waitlist Queries
* **File**: `apps/web/src/app/api/waitlist-list/route.ts`
* **Error**: Querying the waitlist file before any entries are written throws an unhandled ENOENT exception, resulting in HTTP 500.
* **Proposed Resolution**: Wrap the file read function in a try/catch and return an empty array `[]` with status 200 if the file does not exist.

### Problem I: Next.js API & Shared Helper Issues
* **Files**:
  - `apps/web/src/shared/components/landing/HeroSection.tsx`: Unused `Link` import.
  - `apps/web/src/shared/components/ui/enhanced-error-boundary.tsx`: Unused `useAuth` hook and custom imports.
  - `apps/web/src/shared/components/ui/sms-permission-popup.tsx`: Unused dialog/icon imports, unescaped quotes, improper checkbox/input event handler typings, and unused state hook variables.
  - `apps/web/src/shared/hooks/use-data.ts`: Unused state setter `_setBookings`.
  - `apps/web/src/shared/hooks/useAdminAuth.tsx`: Unused destructured error objects from Supabase database operations.
  - `apps/web/src/shared/lib/background-sync.ts`: Unused method arguments (`_direction`).
  - `apps/web/src/shared/lib/sync-service.ts`, `apps/web/src/shared/utils/error-reporter.ts`, and `apps/web/src/app/(routes)/confirm/page.tsx`: Unused catch `error` variable bindings.
  - `apps/web/src/shared/lib/google-calendar-api.ts`: Type incompatibility on `credentials.expiry_date` missing check.
  - `apps/web/src/shared/components/ui/separator.tsx` & `apps/web/src/shared/components/ui/sidebar.tsx`: Unnecessary `as any` reference casts on React elements.
* **Proposed Resolution**: Clean up unused imports/variables, escape quote characters, resolve event type definitions, use optional catch bindings, check expiry date fields, and restore standard typed forward refs.
