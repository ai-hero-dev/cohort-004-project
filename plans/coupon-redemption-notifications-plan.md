# Plan: Coupon Redemption Notifications for Team Admins

> Source PRD: plans/coupon-redemption-notifications.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: No migration needed. The `notifications.type` column is text; add `CouponRedemption = "coupon_redemption"` to the `NotificationType` enum.
- **Notification content**: Title is `"Seat Claimed"`. Message format: `"{userName} redeemed a coupon for {courseTitle} ({remainingSeats} of {totalSeats} seats remaining)"`. Link URL: `/team`.
- **Recipients**: All users with `admin` role in `team_members` for the team that owns the redeemed coupon. One notification record per admin.
- **Trigger**: Inside the coupon service's `redeemCoupon` function, after successful redemption (coupon marked redeemed + enrollment created).
- **Seat counts**: Per-course counts for the specific `teamId` + `courseId`. Calculated at notification creation time and baked into the message string.
- **Bell visibility**: Sidebar notification bell shown when `role === Instructor || isTeamAdmin`. Layout loader fetches notification data under the same condition.

---

## Phase 1: Coupon redemption notifications end-to-end

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11

### What to build

When a coupon is successfully redeemed, create a notification for every admin of the owning team. The notification message includes the redeeming user's name, the course title, and how many seats remain out of the total for that course on that team. The notification links to `/team`.

Extend the notification bell's visibility so that team admins (not just instructors) see the bell icon in the sidebar. The layout loader's notification data fetching should also trigger for team admins. This means a team admin who is not an instructor will now see the bell, and a user who is both an instructor and a team admin will see all their notifications (enrollment + coupon redemption) in one unified list.

### Acceptance criteria

- [ ] `NotificationType` enum includes a `CouponRedemption` value
- [ ] Successful coupon redemption creates one notification per team admin with type `coupon_redemption`
- [ ] Notification title is "Seat Claimed"
- [ ] Notification message includes the redeeming user's name, course title, and remaining/total seat counts for that course
- [ ] Notification link URL is `/team`
- [ ] Seat counts are per-course (coupons for `teamId` + `courseId`)
- [ ] Notification bell is visible in the sidebar for team admins (not just instructors)
- [ ] Layout loader fetches notifications and unread count for team admins
- [ ] Existing notification functionality (mark as read, mark all as read) works for the new notification type
- [ ] Service-level tests cover: notification creation on redemption, correct recipients, correct message content, seat count accuracy, no notification on failed redemption
- [ ] A user who is both instructor and team admin sees both notification types in one bell
