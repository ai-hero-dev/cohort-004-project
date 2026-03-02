# Implementation Plan: Instructor Revenue Analytics Dashboard

Source PRD: `prd/instructor-analytics-dashboard.md`

---

## Phase 1: Analytics Service + Tests

Build the core data layer behind a simple, testable interface. No UI work yet.

### Steps

1. **Create `app/services/analyticsService.ts`** with a single main function:
   - `getInstructorAnalytics(opts: { instructorId: number; period: "7d" | "30d" | "12m" | "all" })` → returns `{ summary, timeSeries, courses }`
   - `summary`: `{ totalRevenue: number; totalEnrollments: number; averageRating: number | null; ratingCount: number }`
   - `timeSeries`: `Array<{ date: string; revenue: number }>` — daily buckets for 7d/30d, monthly buckets for 12m/all
   - `courses`: `Array<{ courseId: number; title: string; listPrice: number; revenue: number; salesCount: number; enrollmentCount: number; averageRating: number | null; ratingCount: number }>`

2. **Query logic inside the service:**
   - Join `courses` (filtered by `instructorId`) with `purchases`, `enrollments`, and `courseRatings`
   - Filter each by the time window derived from `period` (compute a `startDate` ISO string, or no filter for "all")
   - Revenue = `SUM(pricePaid)` from `purchases` — includes individual and team purchases
   - Enrollments = `COUNT(*)` from `enrollments`
   - Ratings = `AVG(rating)` and `COUNT(*)` from `courseRatings`
   - Time series: group purchases by day or month depending on period, fill gaps with `$0`
   - Per-course table: aggregate per `courseId`

3. **Create `app/services/analyticsService.test.ts`** following existing test patterns:
   - Mock `~/db`, use `createTestDb()` + `seedBaseData()` in `beforeEach`
   - Test scenarios:
     - Summary totals correct for a single course with multiple purchases
     - Summary totals correct across multiple courses
     - Time period filtering includes/excludes boundary data
     - Daily granularity for 7d/30d periods
     - Monthly granularity for 12m/all periods
     - Zero-revenue periods appear as `$0` data points (no gaps)
     - Instructor isolation — other instructors' course data excluded
     - Empty state — instructor with no courses returns zeroed summary and empty arrays
     - Courses with no purchases return `0` revenue and `0` salesCount
     - Courses with no ratings return `null` averageRating and `0` ratingCount

### Acceptance Criteria

- All tests pass
- Service returns correctly shaped data for all period values
- No direct SQL strings — all queries via Drizzle ORM

---

## Phase 2: Shared Dashboard Component + Recharts

Build the presentational layer that both routes will share.

### Steps

1. **Install recharts:** `pnpm add recharts`

2. **Create `app/components/analytics-dashboard.tsx`** — a presentational component that receives analytics data as props:
   - **Period selector tabs** — four buttons (7d / 30d / 12mo / All) rendered as links with `?period=` search params. Highlight the active period. Use React Router's `useSearchParams` or `<Link>` with search params.
   - **Three summary cards** using shadcn `Card`:
     - Total Revenue — formatted with `formatPrice()`
     - Total Enrollments — plain number
     - Average Rating — e.g. "4.3 / 5 (12 ratings)" or "No ratings yet"
   - **Revenue line chart** using recharts `<LineChart>`:
     - X-axis: date labels (auto-formatted)
     - Y-axis: revenue in dollars
     - Tooltip showing formatted dollar value
     - Responsive container
   - **Per-course table** with columns: Course Title, List Price, Revenue, Sales, Enrollments, Avg Rating, Rating Count
     - Client-side sorting by clicking column headers (ascending/descending toggle)
     - Default sort: revenue descending
     - Prices formatted with `formatPrice()`
   - **Empty state** — friendly message when no courses or no data

3. **Define the component's props type** to match the analytics service return type exactly (import or re-export).

### Acceptance Criteria

- Component renders all sections from props data
- Period selector links produce correct `?period=` URLs
- Table sorting works client-side with visual sort indicators
- Empty state displays when data is empty
- All prices formatted via `formatPrice()`

---

## Phase 3: Instructor Analytics Route

Wire up the instructor-facing route.

### Steps

1. **Create route file `app/routes/instructor.analytics.tsx`** (maps to `/instructor/analytics`):
   - **Loader:**
     - `getCurrentUserId(request)` → redirect to `/login` if null
     - `getUserById(userId)` → 403 if not `UserRole.Instructor`
     - Read `period` from URL search params, default to `"30d"`, validate against allowed values
     - Call `getInstructorAnalytics({ instructorId: userId, period })`
     - Return analytics data + period
   - **Component:**
     - `useLoaderData()` to get data
     - Render `<AnalyticsDashboard>` with the data

2. **Add "Analytics" to the instructor sidebar navigation** in `app/components/sidebar.tsx`:
   - Add entry: `{ label: "Analytics", to: "/instructor/analytics", roles: [UserRole.Instructor] }`
   - Place it after "My Courses"

### Acceptance Criteria

- `/instructor/analytics` loads and displays the dashboard for the logged-in instructor
- Default period is 30d
- Changing period via tabs reloads the page with correct data
- Period is stored in URL (`?period=7d`)
- Students get 403, unauthenticated users redirect to login
- "Analytics" link visible in sidebar for instructors only

---

## Phase 4: Admin Analytics Route + Users Page Link

Wire up admin access to any instructor's dashboard.

### Steps

1. **Create route file `app/routes/admin.instructor.$instructorId.analytics.tsx`** (maps to `/admin/instructor/:instructorId/analytics`):
   - **Loader:**
     - `getCurrentUserId(request)` → redirect to `/login` if null
     - `getUserById(userId)` → 403 if not `UserRole.Admin`
     - `parseParams(params, schema)` to extract and validate `instructorId`
     - Read `period` from URL search params, default to `"30d"`
     - Call `getInstructorAnalytics({ instructorId, period })`
     - Return analytics data + period + instructor info (name, for the page heading)
   - **Component:**
     - Render `<AnalyticsDashboard>` with the data
     - Show instructor name in a heading above the dashboard

2. **Modify `app/routes/admin.users.tsx`** to add a "View Analytics" link:
   - Next to each user with `role === "instructor"`, add a link to `/admin/instructor/:id/analytics`
   - Use a small icon/link (e.g. lucide `BarChart3` icon or text link)

### Acceptance Criteria

- `/admin/instructor/5/analytics` loads that instructor's dashboard for admins
- Non-admin users get 403
- Invalid instructor ID returns 404 or appropriate error
- Admin users page shows "View Analytics" link only for instructor-role users
- Link navigates to the correct admin analytics route
