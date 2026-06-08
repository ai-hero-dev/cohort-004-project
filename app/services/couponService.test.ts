import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  generateCoupons,
  getCouponByCode,
  getCouponsForTeam,
  redeemCoupon,
} from "./couponService";

// Helper: create a team with admin and a purchase for coupon generation
function setupTeamAndPurchase(country: string | null = "US") {
  const team = testDb.insert(schema.teams).values({}).returning().get();

  testDb
    .insert(schema.teamMembers)
    .values({
      teamId: team.id,
      userId: base.user.id,
      role: schema.TeamMemberRole.Admin,
    })
    .run();

  const purchase = testDb
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
      pricePaid: 10000,
      country,
    })
    .returning()
    .get();

  return { team, purchase };
}

// Helper: create a second user (the redeemer)
function createRedeemer() {
  return testDb
    .insert(schema.users)
    .values({
      name: "Redeemer",
      email: "redeemer@example.com",
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
}

describe("couponService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("generateCoupons", () => {
    it("generates the requested number of coupons", () => {
      const { team, purchase } = setupTeamAndPurchase();

      const result = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 5 });

      expect(result).toHaveLength(5);
    });

    it("generates unique codes for each coupon", () => {
      const { team, purchase } = setupTeamAndPurchase();

      const result = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 10 });
      const codes = result.map((c) => c.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });

    it("associates coupons with the correct team, course, and purchase", () => {
      const { team, purchase } = setupTeamAndPurchase();

      const result = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });

      expect(result[0].teamId).toBe(team.id);
      expect(result[0].courseId).toBe(base.course.id);
      expect(result[0].purchaseId).toBe(purchase.id);
      expect(result[0].redeemedByUserId).toBeNull();
      expect(result[0].redeemedAt).toBeNull();
    });
  });

  describe("getCouponByCode", () => {
    it("returns a coupon by its code", () => {
      const { team, purchase } = setupTeamAndPurchase();
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });

      const found = getCouponByCode(coupon.code);

      expect(found).toBeDefined();
      expect(found!.id).toBe(coupon.id);
    });

    it("returns undefined for a nonexistent code", () => {
      const found = getCouponByCode("nonexistent-code");

      expect(found).toBeUndefined();
    });
  });

  describe("getCouponsForTeam", () => {
    it("returns all coupons for a team", () => {
      const { team, purchase } = setupTeamAndPurchase();
      generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 3 });

      const result = getCouponsForTeam({ teamId: team.id });

      expect(result).toHaveLength(3);
    });

    it("filters coupons by course when courseId is provided", () => {
      const { team, purchase } = setupTeamAndPurchase();

      // Create a second course
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const purchase2 = testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: course2.id,
          pricePaid: 5000,
          country: "US",
        })
        .returning()
        .get();

      generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 3 });
      generateCoupons({ teamId: team.id, courseId: course2.id, purchaseId: purchase2.id, quantity: 2 });

      const filtered = getCouponsForTeam({ teamId: team.id, courseId: base.course.id });
      expect(filtered).toHaveLength(3);

      const filtered2 = getCouponsForTeam({ teamId: team.id, courseId: course2.id });
      expect(filtered2).toHaveLength(2);

      const all = getCouponsForTeam({ teamId: team.id });
      expect(all).toHaveLength(5);
    });
  });

  describe("redeemCoupon", () => {
    it("redeems a valid coupon and enrolls the user", () => {
      const { team, purchase } = setupTeamAndPurchase();
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });
      const redeemer = createRedeemer();

      const result = redeemCoupon({ code: coupon.code, userId: redeemer.id, userCountry: "US" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.enrollment.userId).toBe(redeemer.id);
        expect(result.enrollment.courseId).toBe(base.course.id);
      }

      // Verify coupon is marked as redeemed
      const updated = getCouponByCode(coupon.code);
      expect(updated!.redeemedByUserId).toBe(redeemer.id);
      expect(updated!.redeemedAt).toBeDefined();
    });

    it("rejects redemption of a nonexistent code", () => {
      const result = redeemCoupon({ code: "nonexistent-code", userId: 999, userCountry: "US" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Coupon not found");
      }
    });

    it("rejects redemption of an already-consumed coupon", () => {
      const { team, purchase } = setupTeamAndPurchase();
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });
      const redeemer = createRedeemer();

      // First redemption succeeds
      redeemCoupon({ code: coupon.code, userId: redeemer.id, userCountry: "US" });

      // Second redemption (different user) fails
      const anotherUser = testDb
        .insert(schema.users)
        .values({
          name: "Another User",
          email: "another@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const result = redeemCoupon({ code: coupon.code, userId: anotherUser.id, userCountry: "US" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Coupon has already been redeemed");
      }
    });

    it("rejects redemption when user is already enrolled (coupon stays unconsumed)", () => {
      const { team, purchase } = setupTeamAndPurchase();
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });
      const redeemer = createRedeemer();

      // Enroll the user first (outside the coupon flow)
      testDb
        .insert(schema.enrollments)
        .values({ userId: redeemer.id, courseId: base.course.id })
        .run();

      const result = redeemCoupon({ code: coupon.code, userId: redeemer.id, userCountry: "US" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("You are already enrolled in this course");
      }

      // Verify coupon is NOT consumed
      const unchanged = getCouponByCode(coupon.code);
      expect(unchanged!.redeemedByUserId).toBeNull();
    });

    it("rejects redemption from a different country", () => {
      const { team, purchase } = setupTeamAndPurchase("US");
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });
      const redeemer = createRedeemer();

      const result = redeemCoupon({ code: coupon.code, userId: redeemer.id, userCountry: "PL" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          "This coupon can only be redeemed from the same country as the purchaser"
        );
      }

      // Verify coupon is NOT consumed
      const unchanged = getCouponByCode(coupon.code);
      expect(unchanged!.redeemedByUserId).toBeNull();
    });

    it("allows redemption when purchase has no country set", () => {
      const { team, purchase } = setupTeamAndPurchase(null);
      const [coupon] = generateCoupons({ teamId: team.id, courseId: base.course.id, purchaseId: purchase.id, quantity: 1 });
      const redeemer = createRedeemer();

      const result = redeemCoupon({ code: coupon.code, userId: redeemer.id, userCountry: "PL" });

      expect(result.ok).toBe(true);
    });
  });
});
