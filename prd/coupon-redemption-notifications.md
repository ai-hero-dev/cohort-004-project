# PRD: Coupon Redemption Notifications for Team Admins

## Problem Statement

When a team admin purchases seats and distributes coupon codes to their team members, they have no way of knowing when those coupons are actually redeemed — unless they manually visit the team management page and check coupon statuses. This lack of visibility makes it difficult for admins to track adoption, know when to purchase more seats, or follow up with team members who haven't yet redeemed their coupons.

## Solution

Extend the existing in-app notification system to alert all team admins when a coupon belonging to their team is redeemed. The notification will include who redeemed it, which course it was for, and how many seats remain for that course — giving admins at-a-glance visibility into seat utilization without needing to visit the team management page.

The notification bell (currently only visible to instructors) will also be shown to team admins, so they can receive and interact with these notifications.

## User Stories

1. As a team admin, I want to be notified when someone redeems a coupon from my team, so that I know my team members are claiming their seats.
2. As a team admin, I want the notification to tell me who redeemed the coupon, so that I can track which team members have onboarded.
3. As a team admin, I want the notification to tell me which course the coupon was for, so that I know which course is gaining traction.
4. As a team admin, I want the notification to show how many seats remain for that course, so that I can decide whether to purchase more seats.
5. As a team admin, I want to click the notification to go to the team management page, so that I can see the full picture of coupon usage.
6. As a team admin, I want to see a notification bell in the sidebar, so that I can access my notifications without being an instructor.
7. As a team admin, I want to see an unread count badge on the notification bell, so that I can tell at a glance if there are new redemptions.
8. As a team admin, I want to mark coupon redemption notifications as read, so that I can keep my notification list clean.
9. As a team admin, I want to mark all notifications as read at once, so that I can quickly clear a backlog after checking the team page.
10. As a team admin who is also an instructor, I want to see both enrollment and coupon redemption notifications in the same bell, so that I have a unified notification experience.
11. As a team with multiple admins, I want all admins to receive the redemption notification, so that no admin is left out of the loop.

## Implementation Decisions

### New Notification Type

- Add a `CouponRedemption` value (e.g., `"coupon_redemption"`) to the `NotificationType` enum in the schema.
- No schema migration is needed — the `type` column is already a text field, and the enum is enforced at the application level.

### Notification Content

- **Title:** "Seat Claimed"
- **Message format:** `"{userName} redeemed a coupon for {courseTitle} ({remainingSeats} of {totalSeats} seats remaining)"`
- **Link URL:** `/team` (the team management page)

### Seats Remaining Calculation

- Count unclaimed coupons (where `redeemedByUserId` is null) for the specific `teamId` + `courseId` combination.
- Count total coupons for the same `teamId` + `courseId` combination.
- This calculation happens at notification creation time (the numbers are baked into the message text, not computed dynamically on read).

### Notification Recipients

- All users with the `admin` role in the `team_members` table for the team that owns the redeemed coupon.
- One notification is created per admin (same pattern as enrollment notifications — one record per recipient).

### Trigger Point

- The notification is created inside the `redeemCoupon` function in the coupon service, after a successful redemption (coupon marked as redeemed and enrollment created).
- The trigger needs the redeeming user's name, the course title, the team ID, and the seat counts — some of which require additional lookups.

### Notification Bell Visibility

- Extend the sidebar's notification bell visibility check from `role === Instructor` to `role === Instructor || isTeamAdmin`.
- The `isTeamAdmin` boolean is already computed and passed through the layout loader to the sidebar.
- The layout loader's notification data fetching (currently gated on `isInstructor`) should also be triggered when `isTeamAdmin` is true.

### Existing Patterns Preserved

- Pull-based delivery (loaded in layout loader on page navigation, not real-time).
- Same notification service functions (`createNotification`, `getNotifications`, etc.) are reused.
- Same UI component (`NotificationBell`) handles rendering — no changes needed to the component itself.
- Same mark-as-read API routes work for the new notification type.

## Out of Scope

- Real-time/push notifications (WebSocket, SSE, etc.) — the system remains pull-based.
- Email or external notifications for coupon redemptions.
- Notification preferences or settings (e.g., opting out of certain notification types).
- Filtering notifications by type in the UI.
- Notifications for other coupon lifecycle events (e.g., coupon created, coupon expired).
- Notifications for team membership changes.

## Further Notes

- The seats remaining count is a snapshot at notification creation time. If multiple coupons are redeemed in quick succession, each notification will show the correct remaining count as of that redemption, but earlier notifications won't update retroactively.
- Since the current architecture supports one admin per team in practice (via `getOrCreateTeamForUser`), the "all team admins" recipient logic is forward-compatible but will typically result in one notification per redemption today.
