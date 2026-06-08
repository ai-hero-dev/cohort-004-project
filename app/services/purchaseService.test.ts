import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createPurchase,
  createTeamPurchase,
  findPurchase,
  getPurchasesByUser,
  getPurchasesByCourse,
} from "./purchaseService";

describe("purchaseService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── Create Purchase ───

  describe("createPurchase", () => {
    it("creates a purchase record", () => {
      const purchase = createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" });
      expect(purchase).toBeDefined();
      expect(purchase.userId).toBe(base.user.id);
      expect(purchase.courseId).toBe(base.course.id);
      expect(purchase.pricePaid).toBe(4999);
      expect(purchase.country).toBe("US");
    });

    it("creates a purchase with null country", () => {
      const purchase = createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null });
      expect(purchase.country).toBeNull();
    });

    it("stores discounted price correctly", () => {
      const purchase = createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 2500, country: "IN" });
      expect(purchase.pricePaid).toBe(2500);
      expect(purchase.country).toBe("IN");
    });
  });

  // ─── Find Purchase ───

  describe("findPurchase", () => {
    it("returns purchase for user+course", () => {
      createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" });
      const found = findPurchase({ userId: base.user.id, courseId: base.course.id });
      expect(found).toBeDefined();
      expect(found!.pricePaid).toBe(4999);
    });

    it("returns undefined when no purchase exists", () => {
      expect(findPurchase({ userId: base.user.id, courseId: base.course.id })).toBeUndefined();
    });
  });

  // ─── Get By User ───

  describe("getPurchasesByUser", () => {
    it("returns all purchases for a user", () => {
      createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" });
      const purchases = getPurchasesByUser(base.user.id);
      expect(purchases).toHaveLength(1);
    });

    it("returns empty array when user has no purchases", () => {
      expect(getPurchasesByUser(base.user.id)).toHaveLength(0);
    });
  });

  // ─── Get By Course ───

  describe("getPurchasesByCourse", () => {
    it("returns all purchases for a course", () => {
      createPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" });
      createPurchase({ userId: base.instructor.id, courseId: base.course.id, pricePaid: 4999, country: "GB" });
      const purchases = getPurchasesByCourse(base.course.id);
      expect(purchases).toHaveLength(2);
    });
  });

  // ─── Team Purchase ───

  describe("createTeamPurchase", () => {
    it("creates a purchase, team, and coupons", () => {
      const result = createTeamPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 10000,
        country: "US",
        quantity: 3,
      });

      expect(result.purchase).toBeDefined();
      expect(result.purchase.userId).toBe(base.user.id);
      expect(result.purchase.courseId).toBe(base.course.id);
      expect(result.purchase.pricePaid).toBe(10000);
      expect(result.team).toBeDefined();
      expect(result.coupons).toHaveLength(3);
    });

    it("generates coupons linked to the correct team and purchase", () => {
      const result = createTeamPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 10000,
        country: "US",
        quantity: 2,
      });

      for (const coupon of result.coupons) {
        expect(coupon.teamId).toBe(result.team.id);
        expect(coupon.courseId).toBe(base.course.id);
        expect(coupon.purchaseId).toBe(result.purchase.id);
        expect(coupon.redeemedByUserId).toBeNull();
      }
    });

    it("generates unique coupon codes", () => {
      const result = createTeamPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 10000,
        country: "US",
        quantity: 5,
      });

      const codes = new Set(result.coupons.map((c) => c.code));
      expect(codes.size).toBe(5);
    });

    it("reuses the same team across multiple team purchases", () => {
      const first = createTeamPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 10000,
        country: "US",
        quantity: 2,
      });

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

      const second = createTeamPurchase({
        userId: base.user.id,
        courseId: course2.id,
        pricePaid: 5000,
        country: "US",
        quantity: 3,
      });

      expect(second.team.id).toBe(first.team.id);
      expect(second.coupons).toHaveLength(3);
    });

    it("makes the purchaser a team admin", () => {
      createTeamPurchase({ userId: base.user.id, courseId: base.course.id, pricePaid: 10000, country: "US", quantity: 1 });

      const membership = testDb
        .select()
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.userId, base.user.id))
        .get();

      expect(membership).toBeDefined();
      expect(membership!.role).toBe(schema.TeamMemberRole.Admin);
    });
  });
});
