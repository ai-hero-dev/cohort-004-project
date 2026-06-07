import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { purchases } from "~/db/schema";
import { getOrCreateTeamForUser } from "./teamService";
import { generateCoupons } from "./couponService";

// ─── Purchase Service ───
// Handles purchase records (transaction log separate from enrollments).

export function createPurchase(opts: {
  userId: number;
  courseId: number;
  pricePaid: number;
  country: string | null;
}) {
  return db
    .insert(purchases)
    .values({ userId: opts.userId, courseId: opts.courseId, pricePaid: opts.pricePaid, country: opts.country })
    .returning()
    .get();
}

export function findPurchase(opts: {
  userId: number;
  courseId: number;
}) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, opts.userId), eq(purchases.courseId, opts.courseId)))
    .get();
}

export function getPurchasesByUser(userId: number) {
  return db.select().from(purchases).where(eq(purchases.userId, userId)).all();
}

export function getPurchasesByCourse(courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(eq(purchases.courseId, courseId))
    .all();
}

// ─── Team Purchase ───

export function createTeamPurchase(opts: {
  userId: number;
  courseId: number;
  pricePaid: number;
  country: string | null;
  quantity: number;
}) {
  const purchase = createPurchase({ userId: opts.userId, courseId: opts.courseId, pricePaid: opts.pricePaid, country: opts.country });
  const team = getOrCreateTeamForUser(opts.userId);
  const coupons = generateCoupons({ teamId: team.id, courseId: opts.courseId, purchaseId: purchase.id, quantity: opts.quantity });
  return { purchase, team, coupons };
}
