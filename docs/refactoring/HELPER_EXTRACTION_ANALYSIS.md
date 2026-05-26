# Recommended Helper Methods to Extract from BrowsePage

## Analysis Complete - December 7, 2025

---

## Already Extracted

1. **Location Management** → `useLocationManager.ts` hook

---

## Recommended Extractions

### **HIGH PRIORITY - Should Extract**

#### **1. Geocoding Functions** → `app/shared/lib/geocoding.ts`

**Functions to Extract:**
- `geocodeLocation(locationText: string)` - Convert address to coordinates
- `geocodeBarberLocations(barbers: any[])` - Batch geocode barbers

**Why Extract:**
- Reusable across app (not just BrowsePage)
- Can use in SettingsPage, BarberOnboarding, MapView
- ~80 lines of geocoding logic
- Clear single responsibility

**Benefit:** Could save barber coordinates during onboarding, settings update, etc.

---

#### **2. Data Fetching & Transform** → `app/shared/lib/barberDataService.ts`

**Functions to Extract:**
- `fetchBarbers(page, append, skipNearbyFetch)` - Fetch and transform barbers
- `fetchNearbyBarbers(lat, lon, limit)` - Fetch location-based barbers
- `fetchPosts()` - Fetch cuts/videos
- `processAvatarUrl(url)` - Transform avatar URLs

**Why Extract:**
- Complex business logic (~200 lines)
- Reusable in other components (HomePage, ProfilePage)
- Easier to test in isolation
- Separates data layer from UI layer

**Benefit:** Other pages can fetch barbers without duplicating logic

---

#### **3. Filter & Search Logic** → `app/shared/lib/filterUtils.ts`

**Functions to Extract:**
- `filterBarbersByQuery(barbers, query)` - Search barbers
- `filterBarbersBySpecialties(barbers, specialties)` - Filter by specialty
- `filterPostsByQuery(posts, query)` - Search posts
- `filterPostsBySpecialties(posts, specialties)` - Filter posts

**Why Extract:**
- Pure functions (easy to test)
- Can reuse in SearchPage, FilterModal
- ~60 lines of filter logic
- Clear separation of concerns

**Benefit:** Consistent filtering across the app

---

### **MEDIUM PRIORITY - Consider Extracting**

#### **4. Review Management** → Consider `useReviewManager.ts` hook

**Already exists but could enhance:**
- Current: `useReviews()` hook exists
- Consider: Add review form logic, submission, ratings

**Why Extract:**
- Review logic scattered across BrowsePage
- Could centralize all review CRUD operations
- Better separation of concerns

**Benefit:** Cleaner BrowsePage, reusable review logic

---

#### **5. UI Utility Functions** → `app/shared/utils/uiHelpers.ts`

**Functions to Extract:**
- `renderStarRating(rating, size)` - Star rating component
- `processAvatarUrl(url)` - Already mentioned but could go here

**Why Extract:**
- Reusable UI helpers
- Used in multiple components
- Pure functions

**Benefit:** Consistent UI across app

---

### **LOW PRIORITY - Can Leave in Component**

#### **6. Event Handlers** - Keep in Component
- `handleVideoPress(post)` - Navigation specific to BrowsePage
- `handleImagePress(post)` - Navigation specific to BrowsePage
- `handleBookBarber(post)` - Opens booking form
- `toggleSpecialty(specialty)` - Filter state management
- `clearFilters()` - Simple state reset

**Why Keep:**
- Too specific to BrowsePage
- Tightly coupled to component state
- Not reusable elsewhere
- Simple and clear in component

---

## Impact Analysis

### **Current BrowsePage Size:**
```
Total Lines: 1,499 lines
Location Logic: Already extracted ()
Geocoding: ~80 lines (recommend extract)
Data Fetching: ~200 lines (recommend extract)
Filtering: ~60 lines (recommend extract)
UI Helpers: ~15 lines (consider extract)
Event Handlers: ~50 lines (keep in component)
```

### **After All Extractions:**
```
BrowsePage: ~1,094 lines (26% reduction)
Extracted: ~405 lines into reusable helpers
```

---

## Recommended Extraction Priority

### **Phase 1: High-Impact Extractions (Recommended)**

**1. Geocoding Service**
```typescript
// app/shared/lib/geocoding.ts
export async function geocodeLocation(locationText: string)
export async function geocodeBarberLocations(barbers: any[])
```

**2. Barber Data Service**
```typescript
// app/shared/lib/barberDataService.ts
export async function fetchBarbers(options: FetchOptions)
export async function fetchNearbyBarbers(lat, lon, limit)
export async function transformBarberData(rawData)
```

**3. Filter Utilities**
```typescript
// app/shared/lib/filterUtils.ts
export function filterBarbersByQuery(barbers, query)
export function filterBarbersBySpecialties(barbers, specialties)
export function filterPostsByQuery(posts, query)
```

**Estimated Time:** 2-3 hours
**Benefit:** Cleaner code, better reusability, easier testing

---

### **Phase 2: Nice-to-Have Extractions (Optional)**

**4. UI Helpers**
```typescript
// app/shared/utils/uiHelpers.ts
export function renderStarRating(rating, size)
export function processAvatarUrl(url)
```

**5. Review Management**
- Enhance `useReviews()` hook
- Add review submission logic

**Estimated Time:** 1-2 hours
**Benefit:** Slightly cleaner code

---

## Detailed Extraction Plan

### **1. Create Geocoding Service** (Recommended)

**New File:** `app/shared/lib/geocoding.ts`

**Extract from BrowsePage:**
- Lines 548-567: `geocodeLocation()` function
- Lines 570-599: `geocodeBarberLocations()` function

**Benefits:**
- Reuse in BarberOnboarding (geocode during registration)
- Reuse in SettingsPage (geocode when updating location)
- Can add caching to reduce API calls
- Easier to mock in tests

---

### **2. Create Barber Data Service** (Highly Recommended)

**New File:** `app/shared/lib/barberDataService.ts`

**Extract from BrowsePage:**
- Lines 382-544: `fetchBarbers()` function
- Lines 605-673: `fetchNearbyBarbers()` function
- Lines 692-775: `fetchPosts()` function
- Lines 909-924: `processAvatarUrl()` function

**Benefits:**
- Reuse in HomePage, SearchPage, MapView
- Single source of truth for barber data fetching
- Easier to add caching, pagination
- Can add retry logic at service level
- Testable in isolation

**Structure:**
```typescript
export class BarberDataService {
 async fetchBarbers(options: FetchOptions): Promise<Barber[]>
 async fetchNearbyBarbers(lat: number, lon: number, limit?: number): Promise<Barber[]>
 async fetchPosts(limit?: number): Promise<Post[]>
 transformBarberData(rawData: any[]): Barber[]
 processAvatarUrl(url?: string): string | undefined
}

export const barberDataService = new BarberDataService();
```

---

### **3. Create Filter Utilities** (Recommended)

**New File:** `app/shared/lib/filterUtils.ts`

**Extract from BrowsePage:**
- Lines 808-855: Filter logic from useEffect hooks

**Benefits:**
- Pure functions (easy to test)
- Reusable in SearchPage, FilterModal
- Consistent filtering logic
- Can add more sophisticated filtering later

**Structure:**
```typescript
export function filterBarbersByQuery(
 barbers: Barber[],
 query: string
): Barber[]

export function filterBarbersBySpecialties(
 barbers: Barber[],
 specialties: string[]
): Barber[]

export function filterPostsByQuery(
 posts: Post[],
 query: string
): Post[]

export function combineFilters(
 items: any[],
 filters: FilterConfig
): any[]
```

---

## Quick Win: Geocoding Service

Want to start small? Extract geocoding first (easiest win):

**Benefits:**
- Only ~80 lines
- Clear responsibility
- No state dependencies
- Immediate reusability

**Time:** 15-20 minutes

Would you like me to extract the geocoding service first?

---

## ROI Analysis

| Extraction | Lines | Time | Reusability | Testing Ease | Recommend? |
|------------|-------|------|-------------|--------------|------------|
| **Geocoding** | 80 | 20min | High | Easy | YES |
| **Data Service** | 200 | 1-2hr | Very High | Medium | YES |
| **Filter Utils** | 60 | 30min | High | Very Easy | YES |
| **UI Helpers** | 15 | 10min | Medium | Easy | Maybe |
| **Event Handlers** | 50 | N/A | Low | Hard | NO |

---

## Recommendation

### **Extract These 3:**

1. **Geocoding Service** (20 min) - Quick win
2. **Barber Data Service** (1-2 hours) - Biggest impact
3. **Filter Utilities** (30 min) - Easy & useful

**Total Time:** ~2-3 hours
**Total Impact:** ~340 lines extracted
**BrowsePage:** 1,499 → ~1,159 lines (23% reduction)
**Reusability:** All 3 services usable across app

---

### **My Suggestion:**

Start with **Geocoding Service** (quick win), then decide if you want to do the others. The app is already production-ready, so these are **quality improvements**, not blockers.

Would you like me to:
1. Extract all 3 services now?
2. Start with geocoding only?
3. Skip for now (ship the app)?

Let me know!

