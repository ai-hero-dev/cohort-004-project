# Instructor Analytics Dashboard

**Status:** Ready for agent  
**Author:** Ben Seymour  
**Last updated:** 2026-06-12  
**GitHub Issue:** https://github.com/bseymour/AI-hero-cohort-004-project-fork/issues/1

---

## Problem Statement

Instructors on Cadence have no way to understand how their courses are performing financially or in terms of student engagement. The existing instructor area shows only a raw enrollment count and lesson count per course — there is no revenue visibility, no trend data, and no way to identify which courses are thriving or struggling. Instructors are flying blind on decisions like whether to update content, adjust pricing, or invest in a new course.

## Solution

A dedicated analytics dashboard at `/instructor/analytics` that gives instructors a clear view of their business performance. The page shows a top-level summary row (total revenue, total students, average rating, completion rate, progress rate), a date-range filter, and a per-course breakdown table that can be expanded inline to reveal deeper metrics including revenue trend charts, enrollment over time, lesson-level completion, quiz pass rates, and average rating.

Admins can view any instructor's analytics by passing an `instructorId` query parameter.

## User Stories

1. As an instructor, I want to see my total revenue across all courses for a selected date range, so that I can understand how my business is performing financially.
2. As an instructor, I want to see the total number of students enrolled across all my courses, so that I can understand my overall reach.
3. As an instructor, I want to see my average course rating across all courses, so that I can gauge the overall quality perception of my content.
4. As an instructor, I want to see the overall course completion rate across all my courses, so that I can understand how many students are finishing what they start.
5. As an instructor, I want to see the overall course progress rate across all my courses, so that I can understand how many students are actively working through content.
6. As an instructor, I want to filter all analytics by a date range (7 days, 30 days, 90 days, 12 months, all time), so that I can see trends and compare performance across periods.
7. As an instructor, I want the date range to default to the last 30 days, so that I see recent performance without having to configure anything.
8. As an instructor, I want to see a per-course breakdown table showing revenue, students, average rating, and completion rate for each course, so that I can identify which courses are my top performers.
9. As an instructor, I want to expand a course row inline to see deeper metrics, so that I can investigate a specific course without navigating away.
10. As an instructor, I want the expanded course view to show a line chart of revenue over the selected date range, so that I can see whether revenue is growing or declining.
11. As an instructor, I want the expanded course view to show a bar chart of revenue grouped by month, so that I can identify my strongest months.
12. As an instructor, I want the expanded course view to show enrollments over time, so that I can see when student acquisition peaked or dropped.
13. As an instructor, I want the expanded course view to show a lesson-level completion breakdown, so that I can identify which lessons students are dropping off at.
14. As an instructor, I want the expanded course view to show the quiz pass rate for each quiz, so that I can identify content that students are struggling with.
15. As an instructor, I want the expanded course view to show the average rating, so that I can quickly assess student satisfaction for that course.
16. As an instructor, I want to navigate to the analytics dashboard from a top-level link in the instructor sidebar, so that I can access it quickly from anywhere in the instructor area.
17. As an admin, I want to view any instructor's analytics by passing an `instructorId` query parameter, so that I can support instructors and monitor platform performance.
18. As an instructor, I want revenue figures to reflect the actual price paid (inclusive of any PPP discounts), so that I see accurate earnings rather than list prices.
19. As an instructor with no data yet, I want to see a meaningful empty state for each metric, so that the page doesn't appear broken when I'm just getting started.
20. As an instructor, I want the date range filter to apply globally to all metrics on the page, so that I'm always comparing like-for-like across sections.

## Implementation Decisions

- A new `analyticsService` will be created to own all aggregation queries. No existing service will be modified for analytics purposes — cross-cutting queries (revenue + enrollments + ratings together) do not belong in single-domain services.
- The service will expose three functions:
  - `getInstructorSummary(instructorId, dateRange)` → total revenue, total students, average rating, completion rate, progress rate
  - `getCourseSummaries(instructorId, dateRange)` → per-course row data (revenue, students, avg rating, completion rate)
  - `getCourseDetail(courseId, dateRange)` → expanded metrics: revenue time series, monthly revenue bars, enrollments over time, lesson completion breakdown, quiz pass rates, avg rating
- Revenue is calculated as `SUM(pricePaid)` from the `purchases` table, filtered by `purchases.createdAt` within the date range. Actual `pricePaid` is used directly — no PPP adjustment.
- Completion rate = enrolled students with `enrollments.completedAt` set ÷ total enrolled students, within the date range.
- Progress rate = enrolled students with at least one `lessonProgress` record with status `in_progress` or `completed` ÷ total enrolled students.
- The date range filter is passed as query parameters (`from` and `to` ISO date strings). The route defaults to last 30 days when absent. Presets: 7 days, 30 days, 90 days, 12 months, all time.
- A new route `instructor.analytics.tsx` is added. Admins access other instructors' data via `?instructorId=X` — the loader resolves the target instructor from this param when the current user is an admin, otherwise falls back to the session user.
- No schema changes are required. All data is derivable from existing tables.
- Charts are rendered client-side. Charting library selection is left to the implementer, consistent with any existing chart usage in the codebase.

## Testing Decisions

- Good tests in this codebase test service functions directly against an in-memory SQLite database. They do not test route loaders or UI rendering. They assert on return values, not implementation details.
- `analyticsService.test.ts` will be created alongside `analyticsService.ts`, following the same pattern as `purchaseService.test.ts`, `enrollmentService.test.ts`, and `progressService.test.ts`.
- Tests will use `createTestDb()` and `seedBaseData()` from `app/test/setup.ts`, extended with seeded `purchases`, `enrollments`, `lessonProgress`, `courseRatings`, and `quizAttempts` records as needed.
- Key behaviours to cover: revenue totals respect date range boundaries; completion rate and progress rate are calculated correctly for edge cases (zero enrollments, partial progress); per-course summaries include only courses belonging to the target instructor; the admin path returns data for the specified `instructorId` rather than the requesting user.

## Out of Scope

- **Referral tracking.** A proper referral system (instructor-specific referral links, referral attribution) is planned as a future phase and will have its own PRD.
- **PPP revenue breakdown.** Revenue is shown as actual `pricePaid` only. The `pppEnabled` flag and `country` field are available for a future phase.
- **Video watch drop-off analytics.** The `videoWatchEvents` table exists but this data is not surfaced in this phase.
- **Comment activity analytics.**
- **Email notifications or data exports.**
- **Real-time analytics.** All data is fetched on page load.

## Further Notes

- The referral system flagged during design should track instructor-specific referral links separately from the existing coupon/team system when it is built.
- The instructor sidebar (`app/components/sidebar.tsx`) will need an "Analytics" nav entry added alongside "My Courses".
