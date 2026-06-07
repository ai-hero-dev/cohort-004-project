import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users, type UserRole } from "~/db/schema";

// ─── User Service ───
// Handles user CRUD operations and role management.

export function getAllUsers() {
  return db.select().from(users).all();
}

export function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export function getUsersByRole(role: UserRole) {
  return db.select().from(users).where(eq(users.role, role)).all();
}

export function createUser(opts: {
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}) {
  return db
    .insert(users)
    .values({ name: opts.name, email: opts.email, role: opts.role, avatarUrl: opts.avatarUrl })
    .returning()
    .get();
}

export function updateUser(opts: {
  id: number;
  name: string;
  email: string;
  bio: string | null;
}) {
  return db
    .update(users)
    .set({ name: opts.name, email: opts.email, bio: opts.bio })
    .where(eq(users.id, opts.id))
    .returning()
    .get();
}

export function updateUserRole(id: number, role: UserRole) {
  return db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning()
    .get();
}
