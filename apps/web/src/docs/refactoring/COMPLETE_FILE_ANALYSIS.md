# Complete File Size Analysis & Refactoring Plan

## 📊 ALL FILES - Sorted by Size

### 🔴 **CRITICAL: Files > 800 Lines (Must Split)**

| File | Lines | Status | Priority |
|------|-------|--------|----------|
| **CalendarPage.tsx** | 1,896 | 🔴 Massive | P0 - Critical |
| **BrowsePage.tsx** | 1,498 | 🔴 Massive | P0 - Critical |
| **BarberOnboardingPage.tsx** | 1,440 | 🔴 Massive | P0 - Critical |
| **BookingForm.tsx** | 1,285 | 🔴 Massive | P0 - Critical |
| **ProfilePortfolio.tsx** | 953 | 🔴 Too Large | P1 - High |

**Total:** 5 files, 7,072 lines → Target: ~2,000 lines (65% reduction)

---

### 🟠 **HIGH PRIORITY: Files 600-800 Lines (Should Split)**

| File | Lines | Status | Priority |
|------|-------|--------|----------|
| **SignUpPage.tsx** | 785 | 🟠 Large | P1 - High |
| **ProfilePreview.tsx** | 736 | 🟠 Large | P1 - High |
| **LoginPage.tsx** | 679 | 🟠 Large | P2 - Medium |
| **NotificationTestPage.tsx** | 647 | 🟠 Large | P3 - Low (test page) |
| **ProfileSettings.tsx** | 641 | 🟠 Large | P2 - Medium |
| **EarningsDashboard.tsx** | 638 | 🟠 Large | P2 - Medium |

**Total:** 6 files, 4,126 lines → Target: ~1,800 lines (56% reduction)

---

### 🟡 **MEDIUM PRIORITY: Files 400-600 Lines (Consider Splitting)**

| File | Lines | Status | Priority |
|------|-------|--------|----------|
| **ServicesSettings.tsx** | 508 | 🟡 Medium | P3 - Low |
| **AddonsSettings.tsx** | 429 | 🟡 Medium | P3 - Low |
| **TimePicker.tsx** | 402 | 🟡 Medium | P3 - Low |
| **FindBarberPage.tsx** | 389 | 🟡 Medium | P3 - Low |
| **AvailabilityManager.tsx** | 361 | 🟡 Medium | P3 - Low |
| **SettingsPage.tsx** | 349 | 🟡 Medium | P4 - Optional |

**Total:** 6 files, 2,438 lines → Target: ~1,800 lines (26% reduction)

---

### ✅ **ACCEPTABLE: Files < 400 Lines (No Action Needed)**

| File | Lines | Status |
|------|-------|--------|
| ShareSettings.tsx | 296 | ✅ Good |
| TermsPage.tsx | 251 | ✅ Good |
| AnimatedBackground.tsx | 224 | ✅ Good |
| ActionButton.tsx | 220 | ✅ Good |
| StaircaseGrid.tsx | 217 | ✅ Good |
| UIComponentsTestPage.tsx | 178 | ✅ Good |
| PageHeader.tsx | 176 | ✅ Good |
| HomePage.tsx | 162 | ✅ Good |
| EmailConfirmationScreen.tsx | 162 | ✅ Good |
| ReviewForm.tsx | 159 | ✅ Good |
| AnimatedLogo.tsx | 153 | ✅ Good |
| VideoPreview.tsx | 147 | ✅ Good |
| ReviewCard.tsx | 126 | ✅ Good |
| BookingCalendarPage.tsx | 122 | ✅ Good |
| AnimatedText.tsx | 117 | ✅ Good |
| AuthGuard.tsx | 109 | ✅ Good |
| BookingSuccessPage.tsx | 73 | ✅ Good |
| CutsPage.tsx | 32 | ✅ Good |

**Total:** 18 files, 2,844 lines → No changes needed ✅

---

## 🎯 Complete Feature-Based Architecture

### **ALL Features Mapped:**

```
apps/mobile/app/
├── features/
│   ├── calendar/                      ← CalendarPage (1,896 lines)
│   │   ├── CalendarPage.tsx           (300 lines)
│   │   ├── components/
│   │   │   ├── CalendarGrid.tsx       (300 lines)
│   │   │   ├── EventList.tsx          (200 lines)
│   │   │   ├── EventDetailsModal.tsx  (250 lines)
│   │   │   ├── ManualAppointmentForm.tsx (200 lines)
│   │   │   ├── CalendarHeader.tsx     (150 lines)
│   │   │   ├── CalendarStatsBar.tsx   (100 lines)
│   │   │   └── TimePicker.tsx         (402 lines - moved from shared)
│   │   ├── hooks/
│   │   │   ├── useCalendarState.ts    (100 lines)
│   │   │   ├── useCalendarData.ts     (150 lines)
│   │   │   └── useCalendarEvents.ts   (100 lines)
│   │   ├── services/
│   │   │   ├── calendarDataService.ts (250 lines)
│   │   │   └── calendarUtils.ts       (150 lines)
│   │   └── types/
│   │       └── calendar.types.ts      (100 lines)
│   │
│   ├── browse/                        ← BrowsePage (1,498 lines)
│   │   ├── BrowsePage.tsx             (350 lines)
│   │   ├── components/
│   │   │   ├── BarberGrid.tsx         (300 lines)
│   │   │   ├── PostsGrid.tsx          (250 lines)
│   │   │   ├── FilterPanel.tsx        (150 lines)
│   │   │   ├── SearchBar.tsx          (50 lines)
│   │   │   └── StaircaseGrid.tsx      (217 lines - moved from shared)
│   │   ├── hooks/
│   │   │   ├── useBrowseData.ts       (200 lines)
│   │   │   ├── useFilters.ts          (100 lines)
│   │   │   └── useLocationManager.ts  (moved from shared)
│   │   ├── services/
│   │   │   ├── barberDataService.ts   (250 lines)
│   │   │   ├── filterUtils.ts         (100 lines)
│   │   │   └── geocoding.ts           (80 lines)
│   │   └── types/
│   │       └── browse.types.ts        (50 lines)
│   │
│   ├── booking/                       ← BookingForm (1,285 lines)
│   │   ├── components/
│   │   │   ├── BookingForm.tsx        (300 lines - main coordinator)
│   │   │   ├── ServiceSelector.tsx    (150 lines)
│   │   │   ├── DateTimePicker.tsx     (200 lines)
│   │   │   ├── AddonSelector.tsx      (150 lines)
│   │   │   ├── GuestInfoForm.tsx      (100 lines)
│   │   │   ├── BookingReview.tsx      (150 lines)
│   │   │   ├── PaymentStep.tsx        (200 lines)
│   │   │   └── BookingSuccessPage.tsx (73 lines - moved from pages)
│   │   ├── hooks/
│   │   │   ├── useBookingFlow.ts      (150 lines)
│   │   │   ├── useBookingValidation.ts (100 lines)
│   │   │   └── usePaymentFlow.ts      (150 lines)
│   │   ├── services/
│   │   │   ├── bookingService.ts      (250 lines)
│   │   │   └── bookingValidation.ts   (100 lines)
│   │   ├── pages/
│   │   │   ├── BookingCalendarPage.tsx (122 lines - moved from pages)
│   │   │   └── FindBarberPage.tsx     (389 lines - moved from pages)
│   │   └── types/
│   │       └── booking.types.ts       (100 lines)
│   │
│   ├── onboarding/                    ← BarberOnboardingPage (1,440 lines)
│   │   ├── BarberOnboardingPage.tsx   (300 lines - main coordinator)
│   │   ├── components/
│   │   │   ├── WelcomeStep.tsx        (150 lines)
│   │   │   ├── ProfileInfoStep.tsx    (200 lines)
│   │   │   ├── ServicesStep.tsx       (200 lines)
│   │   │   ├── AvailabilityStep.tsx   (200 lines)
│   │   │   ├── PortfolioStep.tsx      (200 lines)
│   │   │   ├── ReviewStep.tsx         (150 lines)
│   │   │   └── OnboardingProgress.tsx (100 lines)
│   │   ├── hooks/
│   │   │   ├── useOnboardingFlow.ts   (150 lines)
│   │   │   └── useOnboardingValidation.ts (100 lines)
│   │   └── services/
│   │       └── onboardingService.ts   (200 lines)
│   │
│   ├── profile/                       ← ProfilePortfolio (953), ProfilePreview (736)
│   │   ├── pages/
│   │   │   ├── ProfilePortfolio.tsx   (300 lines)
│   │   │   └── ProfilePreview.tsx     (250 lines)
│   │   ├── components/
│   │   │   ├── ProfileHeader.tsx      (150 lines)
│   │   │   ├── ProfileStats.tsx       (100 lines)
│   │   │   ├── PortfolioGrid.tsx      (200 lines)
│   │   │   ├── ReviewsSection.tsx     (150 lines)
│   │   │   ├── ServicesSection.tsx    (150 lines)
│   │   │   ├── AboutSection.tsx       (100 lines)
│   │   │   ├── VideoPreview.tsx       (147 lines - moved from shared)
│   │   │   └── ReviewCard.tsx         (126 lines - moved from shared)
│   │   ├── hooks/
│   │   │   ├── useProfileData.ts      (150 lines)
│   │   │   └── usePortfolio.ts        (100 lines)
│   │   └── services/
│   │       └── profileService.ts      (200 lines)
│   │
│   ├── auth/                          ← LoginPage (679), SignUpPage (785)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx          (250 lines)
│   │   │   ├── SignUpPage.tsx         (300 lines)
│   │   │   └── EmailConfirmationScreen.tsx (162 lines - moved from pages)
│   │   ├── components/
│   │   │   ├── LoginForm.tsx          (200 lines)
│   │   │   ├── SignUpForm.tsx         (250 lines)
│   │   │   ├── SocialAuth.tsx         (100 lines)
│   │   │   ├── RoleSelector.tsx       (100 lines)
│   │   │   └── AuthGuard.tsx          (109 lines - moved from shared)
│   │   ├── hooks/
│   │   │   └── useAuth.tsx            (moved from shared)
│   │   └── services/
│   │       └── authService.ts         (200 lines)
│   │
│   ├── settings/                      ← SettingsPage (349) + all settings components
│   │   ├── SettingsPage.tsx           (300 lines)
│   │   ├── components/
│   │   │   ├── ProfileSettings.tsx    (300 lines - split from 641)
│   │   │   ├── ProfileBasicInfo.tsx   (200 lines)
│   │   │   ├── ProfileSocial.tsx      (150 lines)
│   │   │   ├── ServicesSettings.tsx   (300 lines - split from 508)
│   │   │   ├── ServicesList.tsx       (200 lines)
│   │   │   ├── AddonsSettings.tsx     (300 lines - split from 429)
│   │   │   ├── AddonsList.tsx         (150 lines)
│   │   │   ├── AvailabilityManager.tsx (300 lines - split from 361)
│   │   │   ├── WeeklySchedule.tsx     (200 lines)
│   │   │   ├── EarningsDashboard.tsx  (300 lines - split from 638)
│   │   │   ├── EarningsChart.tsx      (200 lines)
│   │   │   ├── EarningsStats.tsx      (150 lines)
│   │   │   └── ShareSettings.tsx      (296 lines - moved from shared)
│   │   ├── hooks/
│   │   │   ├── useSettings.ts         (150 lines)
│   │   │   ├── useServices.ts         (100 lines)
│   │   │   ├── useAddons.ts           (100 lines)
│   │   │   └── useEarnings.ts         (150 lines)
│   │   └── services/
│   │       ├── settingsService.ts     (200 lines)
│   │       └── earningsService.ts     (150 lines)
│   │
│   ├── notifications/                 ← NotificationTestPage (647)
│   │   ├── NotificationTestPage.tsx   (300 lines)
│   │   ├── components/
│   │   │   ├── NotificationList.tsx   (150 lines)
│   │   │   ├── NotificationCard.tsx   (100 lines)
│   │   │   └── NotificationFilters.tsx (100 lines)
│   │   └── hooks/
│   │       └── useNotifications.tsx   (moved from shared)
│   │
│   ├── home/                          ← HomePage (162)
│   │   ├── HomePage.tsx               (162 lines - already good size ✅)
│   │   └── components/
│   │       ├── HomeHeader.tsx         (50 lines)
│   │       └── QuickActions.tsx       (50 lines)
│   │
│   ├── cuts/                          ← CutsPage (32)
│   │   ├── CutsPage.tsx               (32 lines - already good size ✅)
│   │   └── components/
│   │       └── CutsGrid.tsx           (100 lines - to be built)
│   │
│   └── legal/                         ← TermsPage (251)
│       └── TermsPage.tsx              (251 lines - already good size ✅)
│
├── shared/                            ← ONLY truly generic components
│   ├── components/
│   │   ├── ui/                        ← Design system (40+ components)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   └── ... (all existing UI components)
│   │   ├── layout/
│   │   │   ├── PageHeader.tsx         (176 lines)
│   │   │   └── LayoutWrapper.tsx      (24 lines)
│   │   ├── AnimatedBackground.tsx     (224 lines)
│   │   ├── AnimatedLogo.tsx           (153 lines)
│   │   ├── AnimatedText.tsx           (117 lines)
│   │   ├── ActionButton.tsx           (220 lines)
│   │   └── ReviewForm.tsx             (159 lines)
│   ├── hooks/
│   │   ├── useErrorRecovery.ts
│   │   ├── useMobileSecurity.ts
│   │   ├── useSafeNavigation.ts
│   │   ├── useCuts.tsx
│   │   ├── useData.tsx
│   │   ├── usePayment.tsx
│   │   └── useReviews.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── logger.ts
│   │   ├── errorRecovery.ts
│   │   ├── theme.ts
│   │   ├── locationUtils.ts
│   │   ├── locationPreferences.ts
│   │   ├── bookingConflictCheck.ts
│   │   ├── mobile-security.ts
│   │   ├── notifications.ts
│   │   └── stripePaymentService.ts
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   ├── common.types.ts
│   │   └── settings.types.ts
│   └── utils/
│       ├── index.ts
│       └── settings.utils.ts
│
└── navigation/
    └── AppNavigator.tsx
```

---

## 📊 Impact Analysis

### **Files to Refactor:**

| Priority | Count | Current Lines | Target Lines | Reduction |
|----------|-------|---------------|--------------|-----------|
| **P0 - Critical** | 5 | 7,072 | 2,000 | -71% |
| **P1 - High** | 4 | 2,803 | 1,200 | -57% |
| **P2 - Medium** | 3 | 1,958 | 900 | -54% |
| **P3 - Low** | 5 | 2,089 | 1,500 | -28% |
| **Total** | 17 | 13,922 | 5,600 | -60% |

### **Files Already Good:**

| Status | Count | Lines |
|--------|-------|-------|
| ✅ No changes needed | 18 | 2,844 |

---

## 🎯 Refactoring Priority Order

### **Phase 1: Critical (P0) - Week 1**

1. **CalendarPage.tsx** (1,896 → 300 lines)
   - Extract: 7 components, 3 hooks, 2 services
   - Time: 4-5 hours

2. **BrowsePage.tsx** (1,498 → 350 lines)
   - Extract: 4 components, 2 hooks, 3 services
   - Time: 3-4 hours

3. **BarberOnboardingPage.tsx** (1,440 → 300 lines)
   - Extract: 7 step components, 2 hooks, 1 service
   - Time: 4-5 hours

4. **BookingForm.tsx** (1,285 → 300 lines)
   - Extract: 6 components, 3 hooks, 2 services
   - Time: 3-4 hours

5. **ProfilePortfolio.tsx** (953 → 300 lines)
   - Extract: 6 components, 2 hooks, 1 service
   - Time: 2-3 hours

**Phase 1 Total:** 16-21 hours

---

### **Phase 2: High Priority (P1) - Week 2**

6. **SignUpPage.tsx** (785 → 300 lines)
   - Extract: 3 components, 1 hook
   - Time: 2 hours

7. **ProfilePreview.tsx** (736 → 250 lines)
   - Extract: 4 components, 1 hook
   - Time: 2 hours

8. **LoginPage.tsx** (679 → 250 lines)
   - Extract: 2 components, 1 hook
   - Time: 1.5 hours

9. **ProfileSettings.tsx** (641 → 300 lines)
   - Extract: 2 components
   - Time: 1.5 hours

**Phase 2 Total:** 7 hours

---

### **Phase 3: Medium Priority (P2) - Week 3**

10. **EarningsDashboard.tsx** (638 → 300 lines)
    - Extract: 2 components
    - Time: 1.5 hours

11. **ServicesSettings.tsx** (508 → 300 lines)
    - Extract: 1 component
    - Time: 1 hour

12. **AddonsSettings.tsx** (429 → 300 lines)
    - Extract: 1 component
    - Time: 1 hour

**Phase 3 Total:** 3.5 hours

---

### **Phase 4: Low Priority (P3) - Week 4**

13. **NotificationTestPage.tsx** (647 → 300 lines)
14. **FindBarberPage.tsx** (389 → move to booking feature)
15. **AvailabilityManager.tsx** (361 → 300 lines)
16. **TimePicker.tsx** (402 → move to calendar feature)
17. **SettingsPage.tsx** (349 → already acceptable)

**Phase 4 Total:** 4 hours

---

## 📈 Complete Timeline

| Week | Phase | Files | Hours | Result |
|------|-------|-------|-------|--------|
| **Week 1** | P0 Critical | 5 | 16-21 | 7,072 → 2,000 lines |
| **Week 2** | P1 High | 4 | 7 | 2,803 → 1,200 lines |
| **Week 3** | P2 Medium | 3 | 3.5 | 1,958 → 900 lines |
| **Week 4** | P3 Low | 5 | 4 | 2,089 → 1,500 lines |
| **Total** | All | 17 | 30-35 | 13,922 → 5,600 lines |

---

## 🎯 Recommended Approach

### **Option 1: Full Refactor (Recommended)** ⭐

**Do all 17 files over 4 weeks**
- Time: 30-35 hours
- Result: Professional architecture
- All files < 350 lines
- Feature-based organization

### **Option 2: Critical Only (Quick Win)**

**Do only P0 files (5 files)**
- Time: 16-21 hours
- Result: 60% reduction in largest files
- Still have some large files

### **Option 3: Phased Approach (Balanced)**

**Do P0 + P1 (9 files) over 2 weeks**
- Time: 23-28 hours
- Result: 70% of the problem solved
- Most critical files fixed

---

## 🚀 My Recommendation

**Start with Phase 1 (P0 Critical Files):**

1. CalendarPage (1,896 lines) - Biggest offender
2. BrowsePage (1,498 lines) - Second biggest
3. BarberOnboardingPage (1,440 lines) - Complex flow
4. BookingForm (1,285 lines) - Core business logic
5. ProfilePortfolio (953 lines) - User-facing

**These 5 files represent 50% of your total problem.**

After Phase 1, we can reassess and continue with Phase 2.

---

## 🎬 Ready to Start?

I can begin with **Phase 1** and refactor all 5 critical files:

✅ Create feature-based structure  
✅ Extract components, hooks, services  
✅ Update all imports  
✅ Keep tests passing  
✅ Ensure no breaking changes  

**Shall I proceed with Phase 1?** This will take 16-21 hours but will dramatically improve your codebase! 🚀

