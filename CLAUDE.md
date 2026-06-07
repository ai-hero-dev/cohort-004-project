# Cadence — Project Knowledge

## Purpose

A mini course platform (think a scaled-down Udemy) used as the exercise repo for the
_"AI Coding for Real Engineers with Claude Code"_ cohort by AI Hero. Students use
Claude Code to explore, extend, and refactor this codebase across 6 days of content.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Router v7 (full-stack SSR, formerly Remix-style) |
| Language | TypeScript |
| Build tool | Vite + `@react-router/dev` plugin |
| Database | SQLite via `better-sqlite3` (`data.db` in repo root) |
| ORM | Drizzle ORM — schema at `app/db/schema.ts`, migrations in `drizzle/` |
| Styling | Tailwind CSS v4 (Vite plugin) + shadcn/ui (Radix UI primitives) |
| Icons | Lucide React |
| Editor | Monaco Editor (embedded VS Code editor) |
| Syntax highlighting | Shiki |
| Toasts | Sonner |
| Drag-and-drop | @hello-pangea/dnd |
| Validation | Zod |
| Markdown | marked |
| Testing | Vitest |
| Package manager | pnpm (via Corepack) |

`~/` imports resolve to `app/` via `vite-tsconfig-paths`.

---

## React Router Setup

- **SSR enabled** — `react-router.config.ts` sets `ssr: true`
- **Routes defined in code** — `app/routes.ts` uses `index`, `route`, `layout` helpers
  (not file-system convention)
- **Route file naming** — dot notation (`courses.$slug.lessons.$lessonId.tsx`) is
  cosmetic; actual URL structure is in `routes.ts`
- **Per-route types** — RR v7 generates `app/routes/+types/<route>.ts`; each route
  imports `type Route from "./+types/<route-name>"`
- **Shared layout** — `routes/layout.app.tsx` wraps all authenticated app routes;
  its loader runs on every child route and provides current user, sidebar data, PPP
  country info, and team admin status
- **Root** — `app/root.tsx` wraps everything in `<html>`, injects a dark-mode
  script synchronously (before hydration), renders a navigation loading bar via
  `useNavigation()`, and has a global `ErrorBoundary`
- **API-only routes** — `api/logout`, `api/video-tracking`, `api/switch-user`,
  `api/set-dev-country` (no UI component, loader/action only)

### Route tree summary

```
/                           routes/home.tsx          (outside layout)
layout.app.tsx              (sidebar + DevUI shell)
  /dashboard
  /courses
  /courses/:slug
  /courses/:slug/:moduleId
  /courses/:slug/purchase
  /courses/:slug/welcome
  /courses/:slug/lessons/:lessonId
  /instructor
  /instructor/new
  /instructor/:courseId
  /instructor/:courseId/lessons/:lessonId
  /instructor/:courseId/lessons/:lessonId/quiz
  /instructor/:courseId/modules/:moduleId
  /instructor/:courseId/students
  /admin/users
  /admin/courses
  /admin/categories
  /settings
  /team
  /redeem/:code
/signup                     (outside layout — full-page auth screen)
/login
/api/switch-user
/api/logout
/api/video-tracking
/api/set-dev-country
```

---

## Authentication & Authorization

### Authentication

- **No passwords** — login is email-only (dev/learning app)
- **Session** — `app/lib/session.ts`; React Router `createCookieSessionStorage`;
  cookie name `cadence_session`; stores only `userId` (integer); role is never
  cached in the cookie
- **Login** — `app/routes/login.tsx`; looks up user by email, calls
  `setCurrentUserId()`, redirects; supports `?redirectTo=` param
- **Signup** — `app/routes/signup.tsx`; new users get `UserRole.Student` hardcoded;
  if email already exists it silently logs in
- **Logout** — `app/routes/api.logout.ts`; calls `destroySession()`, redirects to `/`

### Authorization

- **No centralized middleware** — every protected route does its own check in its
  `loader` and `action`
- **Pattern**: get userId from session → fetch user from DB → check role → throw
  `data("...", { status: 403 })` on failure
- **Ownership + admin override** (instructor routes): `course.instructorId ===
  currentUserId || user.role === UserRole.Admin`
- **Enrollment** is a soft gate — unenrolled users see a prompt, not a 403

### User roles (`app/db/schema.ts`)

| Role | Access |
|---|---|
| `student` | Browse, purchase, enroll, view lessons, take quizzes |
| `instructor` | Create and manage own courses/modules/lessons/quizzes; view own student progress |
| `admin` | Everything instructor can do + manage any course + manage all users/categories + change roles |

### Team roles (secondary system)

| Role | Access |
|---|---|
| `TeamMemberRole.Admin` | Manage team seat coupons |
| `TeamMemberRole.Member` | Member of a team (receives coupon access) |

Orthogonal to `UserRole` — a `student` can also be a team admin.

---

## Database Schema

SQLite, Drizzle ORM. Schema: `app/db/schema.ts`. Migrations: `drizzle/`. DB file: `data.db`.

### Enums (stored as text)

- `UserRole`: `student` | `instructor` | `admin`
- `CourseStatus`: `draft` | `published` | `archived`
- `LessonProgressStatus`: `not_started` | `in_progress` | `completed`
- `QuestionType`: `multiple_choice` | `true_false`
- `TeamMemberRole`: `admin` | `member`

### Tables

**Core content**
- `users` — id, name, email (unique), role, avatarUrl, bio, createdAt
- `categories` — id, name, slug (unique)
- `courses` — id, title, slug, description, salesCopy, instructorId→users, categoryId→categories, status, coverImageUrl, price (integer cents), pppEnabled (boolean, default true), createdAt, updatedAt
- `modules` — id, courseId→courses, title, position, createdAt
- `lessons` — id, moduleId→modules, title, content, videoUrl, githubRepoUrl, position, durationMinutes, createdAt

**Progress**
- `enrollments` — id, userId→users, courseId→courses, enrolledAt, completedAt
- `lesson_progress` — id, userId→users, lessonId→lessons, status, completedAt
- `video_watch_events` — id, userId, lessonId, eventType, positionSeconds, createdAt (append-only event log)

**Quiz system**
- `quizzes` — id, lessonId→lessons (1:1), title, passingScore (real)
- `quiz_questions` — id, quizId→quizzes, questionText, questionType, position
- `quiz_options` — id, questionId→quizQuestions, optionText, isCorrect (boolean)
- `quiz_attempts` — id, userId→users, quizId→quizzes, score (real), passed (boolean), attemptedAt
- `quiz_answers` — id, attemptId→quizAttempts, questionId→quizQuestions, selectedOptionId→quizOptions

**Commerce**
- `purchases` — id, userId→users, courseId→courses, pricePaid (integer), country (text, for PPP enforcement), createdAt
- `teams` — id, createdAt
- `team_members` — id, teamId→teams, userId→users, role (TeamMemberRole), createdAt
- `coupons` — id, teamId→teams, courseId→courses, code (unique), purchaseId→purchases, redeemedByUserId→users (nullable), redeemedAt (nullable), createdAt

### Relationship map

```
categories ──< courses >── users (instructor)
                 │
              modules
                 │
             lessons ──── quizzes ── quiz_questions ── quiz_options
                │                         │
        lesson_progress           quiz_attempts ── quiz_answers
        video_watch_events

users ──< enrollments  >── courses
users ──< purchases    >── courses
users ──< team_members >── teams ──< coupons >── courses
```

---

## Purchasing Power Parity (PPP)

**Core logic**: `app/lib/ppp.ts`  
**Tests**: `app/lib/ppp.test.ts`

Four discount tiers keyed by country code:
- Tier 1: 0% off (US, UK, DE, …)
- Tier 2: 30% off (BR, PL, AR, …)
- Tier 3: 50% off (IN, PH, VN, …)
- Tier 4: 70% off (NG, PK, BD, …)

Key functions: `getDiscountForCountry()`, `calculatePppPrice()`, `checkPppAccess()`

- Country is detected server-side via `resolveCountry()` (geo-IP / headers)
- PPP price is shown on course listing and detail pages before purchase
- At checkout the discounted price and country code are stored on `purchases.country`
- On lesson access, the server checks if the user's current country matches their
  purchase country — mismatch blocks access (geo-enforcement)
- Instructors can toggle PPP per course via `ppp_enabled` on the `courses` table
- DevUI (`app/components/dev-ui.tsx`) allows manual country override for testing

---

## Dev Tooling

- `pnpm dev` — start dev server (localhost:5173)
- `pnpm db:migrate` — run Drizzle migrations
- `pnpm db:seed` — seed from `scripts/seed.ts`
- `pnpm test` / `pnpm test:watch` — Vitest
- `pnpm typecheck` — `react-router typegen && tsc`
- `pnpm reset <commit>` / `pnpm cherry-pick <commit>` — lesson checkpoint navigation
- **DevUI** — floating panel (bottom of layout) for switching users and overriding
  PPP country without needing a real account or VPN
