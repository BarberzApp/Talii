# File Organization & Architecture Templates

## 📊 Your Current Structure Analysis

### **Current Organization (Hybrid Type-Based):**

```
apps/mobile/app/
├── pages/              ← 🔴 Problem: 18 pages, some 1,500+ lines
├── shared/
│   ├── components/     ← Type-based
│   │   ├── ui/         ← Generic UI components
│   │   ├── settings/   ← Feature-based subfolder ✅
│   │   └── auth/       ← Feature-based subfolder ✅
│   ├── hooks/          ← Type-based
│   ├── lib/            ← Type-based
│   ├── services/       ← Type-based
│   ├── contexts/       ← Type-based
│   ├── types/          ← Type-based
│   └── utils/          ← Type-based
```

**Issues:**
- 🔴 Large monolithic pages (1,500-1,900 lines)
- 🔴 Hard to find calendar-specific components
- 🔴 Hard to find booking-specific logic
- 🟡 Mixing generic and feature-specific in same folders

---

## 🏗️ Industry-Standard Architecture Templates

### **Template 1: Feature-Based (Netflix, Airbnb) ⭐ RECOMMENDED**

**Best for:** Large apps, multiple features

```
apps/mobile/app/
├── features/
│   ├── calendar/
│   │   ├── components/
│   │   │   ├── CalendarGrid.tsx         (300 lines)
│   │   │   ├── EventList.tsx            (200 lines)
│   │   │   ├── EventDetailsModal.tsx    (250 lines)
│   │   │   ├── ManualAppointmentForm.tsx(200 lines)
│   │   │   ├── CalendarHeader.tsx       (150 lines)
│   │   │   └── CalendarStatsBar.tsx     (100 lines)
│   │   ├── hooks/
│   │   │   ├── useCalendarState.ts      (100 lines)
│   │   │   ├── useCalendarData.ts       (150 lines)
│   │   │   └── useCalendarEvents.ts     (100 lines)
│   │   ├── services/
│   │   │   ├── calendarDataService.ts   (250 lines)
│   │   │   └── calendarUtils.ts         (150 lines)
│   │   ├── types/
│   │   │   └── calendar.types.ts        (50 lines)
│   │   └── CalendarPage.tsx             (300 lines) ← Main page
│   │
│   ├── browse/
│   │   ├── components/
│   │   │   ├── BarberGrid.tsx           (300 lines)
│   │   │   ├── PostsGrid.tsx            (250 lines)
│   │   │   ├── FilterPanel.tsx          (150 lines)
│   │   │   └── SearchBar.tsx            (50 lines)
│   │   ├── hooks/
│   │   │   ├── useBrowseData.ts         (200 lines)
│   │   │   └── useFilters.ts            (100 lines)
│   │   ├── services/
│   │   │   ├── barberDataService.ts     (250 lines)
│   │   │   └── filterUtils.ts           (100 lines)
│   │   └── BrowsePage.tsx               (350 lines) ← Main page
│   │
│   ├── booking/
│   │   ├── components/
│   │   │   ├── BookingForm.tsx          (400 lines)
│   │   │   ├── ServiceSelector.tsx      (150 lines)
│   │   │   └── PaymentStep.tsx          (200 lines)
│   │   ├── hooks/
│   │   │   ├── useBookingFlow.ts        (150 lines)
│   │   │   └── useBookingValidation.ts  (100 lines)
│   │   ├── services/
│   │   │   └── bookingService.ts        (250 lines)
│   │   └── types/
│   │       └── booking.types.ts         (50 lines)
│   │
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignUpForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.tsx
│   │   ├── services/
│   │   │   └── authService.ts
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       └── SignUpPage.tsx
│   │
│   └── settings/
│       ├── components/
│       │   ├── ProfileSettings.tsx
│       │   ├── ServicesSettings.tsx
│       │   └── ...
│       ├── hooks/
│       │   └── useSettings.ts
│       └── SettingsPage.tsx
│
├── shared/              ← Generic, cross-feature code
│   ├── components/
│   │   └── ui/          ← Generic UI components only
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       └── ...
│   ├── hooks/
│   │   ├── useLocationManager.ts
│   │   ├── useErrorRecovery.ts
│   │   └── ...
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── logger.ts
│   │   ├── errorRecovery.ts
│   │   └── ...
│   └── types/
│       └── common.types.ts
│
└── navigation/
    └── AppNavigator.tsx
```

**Benefits:**
- ✅ Everything related to calendar is in `features/calendar/`
- ✅ Easy to find calendar components
- ✅ Easy to test entire feature
- ✅ Can move features to separate packages later
- ✅ Clear separation: feature code vs shared code
- ✅ Scalable: Add new features without affecting others

---

### **Template 2: Atomic Design (Storybook, Design Systems)**

**Best for:** Component libraries, design-focused apps

```
app/
├── pages/              ← Pages only (thin, compose atoms/molecules)
│   ├── CalendarPage.tsx       (150 lines)
│   ├── BrowsePage.tsx         (150 lines)
│   └── ...
│
├── components/
│   ├── atoms/          ← Smallest, single-purpose
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   │
│   ├── molecules/      ← Combinations of atoms
│   │   ├── SearchBar.tsx
│   │   ├── EventCard.tsx
│   │   ├── BarberCard.tsx
│   │   └── ...
│   │
│   ├── organisms/      ← Complex components
│   │   ├── CalendarGrid.tsx
│   │   ├── EventList.tsx
│   │   ├── BookingForm.tsx
│   │   └── ...
│   │
│   └── templates/      ← Page layouts
│       ├── CalendarTemplate.tsx
│       └── BrowseTemplate.tsx
│
├── hooks/
├── services/
└── lib/
```

**Benefits:**
- ✅ Very organized by complexity
- ✅ Great for design systems
- ✅ Clear component hierarchy

**Drawbacks:**
- ❌ Can be hard to find feature-specific components
- ❌ More folders to navigate

---

### **Template 3: Screaming Architecture (Uncle Bob) ⭐⭐**

**Best for:** Business-focused apps

```
app/
├── calendar/           ← "Screams" what the app does
│   ├── CalendarPage.tsx
│   ├── CalendarGrid.tsx
│   ├── EventList.tsx
│   ├── calendarService.ts
│   └── useCalendar.ts
│
├── booking/
│   ├── BookingPage.tsx
│   ├── BookingForm.tsx
│   ├── bookingService.ts
│   └── useBooking.ts
│
├── browse/
│   ├── BrowsePage.tsx
│   ├── BarberGrid.tsx
│   ├── browseService.ts
│   └── useBrowse.ts
│
├── profile/
├── auth/
├── settings/
│
└── shared/             ← Generic utilities
    ├── ui/
    ├── hooks/
    └── lib/
```

**Benefits:**
- ✅ Immediately see what features exist
- ✅ Easy to navigate by business capability
- ✅ Flat structure (less nesting)

**Drawbacks:**
- ❌ Components mixed with services
- ❌ Less type-based organization

---

### **Template 4: Domain-Driven Design (Enterprise)**

**Best for:** Very large apps, multiple teams

```
app/
├── domains/
│   ├── scheduling/     ← Calendar, booking, availability
│   │   ├── calendar/
│   │   ├── booking/
│   │   └── availability/
│   │
│   ├── marketplace/    ← Browse, search, profiles
│   │   ├── browse/
│   │   ├── search/
│   │   └── profiles/
│   │
│   ├── payments/
│   │   ├── checkout/
│   │   └── earnings/
│   │
│   └── identity/       ← Auth, profiles, settings
│       ├── auth/
│       └── settings/
│
└── shared/
```

**Benefits:**
- ✅ Groups related features by business domain
- ✅ Very scalable
- ✅ Team-friendly (each team owns a domain)

**Drawbacks:**
- ❌ May be overkill for small teams
- ❌ More complex structure

---

## 🎯 MY RECOMMENDATION FOR YOUR APP

### **Use Feature-Based Architecture (Template 1)** ⭐

**Why?**
- ✅ Best balance of organization and simplicity
- ✅ Used by Netflix, Airbnb, Uber
- ✅ Perfect for your app size
- ✅ Easy to find calendar, booking, browse code
- ✅ Can extract features to separate packages later
- ✅ Scales well as app grows

---

## 📐 Recommended File Sizes

### **By File Type:**

| File Type | Target | Max | Example |
|-----------|--------|-----|---------|
| **Page/Screen** | 200-300 lines | 400 | CalendarPage.tsx: 300 lines |
| **Component** | 150-250 lines | 350 | CalendarGrid.tsx: 300 lines |
| **Hook** | 100-200 lines | 300 | useCalendarData.ts: 150 lines |
| **Service** | 150-300 lines | 400 | calendarDataService.ts: 250 lines |
| **Utility** | 50-150 lines | 200 | calendarUtils.ts: 150 lines |
| **Types** | 30-100 lines | 150 | calendar.types.ts: 100 lines |

### **JSX Splitting Rules:**

**If your JSX is >200 lines, split into components:**

```tsx
// ❌ BAD: 700 lines of JSX in one file
return (
  <View>
    {/* 200 lines of header */}
    {/* 300 lines of calendar grid */}
    {/* 200 lines of event list */}
  </View>
);

// ✅ GOOD: Split into components
return (
  <View>
    <CalendarHeader {...props} />        {/* 50 lines JSX in its own file */}
    <CalendarGrid {...props} />          {/* 100 lines JSX in its own file */}
    <EventList events={events} />        {/* 80 lines JSX in its own file */}
  </View>
);
```

---

## 🎯 Proposed New Structure for the Mobile App (`apps/mobile`)

### **Complete Feature-Based Architecture:**

```
apps/mobile/app/
├── features/                      ← NEW: Feature modules
│   ├── calendar/
│   │   ├── CalendarPage.tsx                   (300 lines)
│   │   ├── components/
│   │   │   ├── CalendarGrid.tsx               (300 lines)
│   │   │   ├── EventList.tsx                  (200 lines)
│   │   │   ├── EventDetailsModal.tsx          (250 lines)
│   │   │   ├── ManualAppointmentForm.tsx      (200 lines)
│   │   │   ├── CalendarHeader.tsx             (150 lines)
│   │   │   └── CalendarStatsBar.tsx           (100 lines)
│   │   ├── hooks/
│   │   │   ├── useCalendarState.ts            (100 lines)
│   │   │   ├── useCalendarData.ts             (150 lines)
│   │   │   └── useCalendarEvents.ts           (100 lines)
│   │   ├── services/
│   │   │   ├── calendarDataService.ts         (250 lines)
│   │   │   └── calendarUtils.ts               (150 lines)
│   │   └── types/
│   │       └── calendar.types.ts              (100 lines)
│   │
│   ├── browse/
│   │   ├── BrowsePage.tsx                     (350 lines)
│   │   ├── components/
│   │   │   ├── BarberGrid.tsx                 (300 lines)
│   │   │   ├── PostsGrid.tsx                  (250 lines)
│   │   │   ├── FilterPanel.tsx                (150 lines)
│   │   │   └── SearchBar.tsx                  (50 lines)
│   │   ├── hooks/
│   │   │   ├── useBrowseData.ts               (200 lines)
│   │   │   └── useFilters.ts                  (100 lines)
│   │   ├── services/
│   │   │   ├── barberDataService.ts           (250 lines)
│   │   │   ├── filterUtils.ts                 (100 lines)
│   │   │   └── geocoding.ts                   (80 lines)
│   │   └── types/
│   │       └── browse.types.ts                (50 lines)
│   │
│   └── booking/
│       ├── components/
│       │   ├── BookingForm.tsx                (300 lines)
│       │   ├── ServiceSelector.tsx            (150 lines)
│       │   ├── DateTimePicker.tsx             (200 lines)
│       │   ├── GuestInfoForm.tsx              (100 lines)
│       │   ├── BookingReview.tsx              (150 lines)
│       │   └── PaymentStep.tsx                (200 lines)
│       ├── hooks/
│       │   ├── useBookingFlow.ts              (150 lines)
│       │   └── useBookingValidation.ts        (100 lines)
│       └── services/
│           └── bookingService.ts              (250 lines)
│
├── shared/                        ← ONLY generic code
│   ├── components/ui/             ← Design system
│   ├── hooks/                     ← Generic hooks
│   ├── lib/                       ← Generic utilities
│   └── types/                     ← Common types
│
└── navigation/
    └── AppNavigator.tsx
```

---

## 🚀 Implementation Strategy

### **Phase 1: Services (Backend Layer) - 2 hours**

Extract all data fetching and business logic:

1. `features/calendar/services/calendarDataService.ts`
2. `features/browse/services/barberDataService.ts`
3. `features/booking/services/bookingService.ts`

**Why first?** Services are easiest - no JSX, clear boundaries

---

### **Phase 2: Utilities & Hooks - 1 hour**

Extract pure functions and state management:

1. `features/calendar/services/calendarUtils.ts`
2. `features/calendar/hooks/useCalendarState.ts`
3. `features/browse/services/filterUtils.ts`

**Why second?** Sets up foundation for components

---

### **Phase 3: Components (UI Layer) - 3-4 hours**

Split large JSX into focused components:

1. `features/calendar/components/CalendarGrid.tsx`
2. `features/calendar/components/EventList.tsx`
3. `features/calendar/components/EventDetailsModal.tsx`
4. `features/browse/components/BarberGrid.tsx`
5. `features/browse/components/PostsGrid.tsx`

**Why last?** Components depend on services and hooks

---

## 📊 Before vs After Comparison

### **Before (Current):**
```
app/pages/
├── CalendarPage.tsx (1,897 lines) 🔴
├── BrowsePage.tsx (1,499 lines) 🔴
└── BookingForm.tsx (~800 lines) 🔴

Problems:
  - Hard to find calendar-specific code
  - Massive files
  - Mixed concerns
```

### **After (Feature-Based):**
```
app/features/
├── calendar/ (11 files)
│   ├── CalendarPage.tsx (300 lines) ✅
│   └── components/ (7 files, avg 200 lines) ✅
│
├── browse/ (9 files)
│   ├── BrowsePage.tsx (350 lines) ✅
│   └── components/ (4 files, avg 200 lines) ✅
│
└── booking/ (9 files)
    └── components/ (6 files, avg 180 lines) ✅

Benefits:
  - Every file < 350 lines ✅
  - Easy to navigate ✅
  - Easy to test ✅
  - Scalable ✅
```

---

## 🎬 My Recommendation

**Implement Feature-Based Architecture:**

1. Create `features/` folder structure
2. Extract services first (2 hours)
3. Extract components (3-4 hours)
4. Extract hooks (1 hour)
5. Update imports (30 min)

**Total Time:** 6-8 hours  
**Result:** CalendarPage (1,897 → 300 lines), BrowsePage (1,499 → 350 lines)

**Ready to start?** This will dramatically improve your codebase! 🚀

