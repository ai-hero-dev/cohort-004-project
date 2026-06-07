import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { teams, teamMembers, TeamMemberRole } from "~/db/schema";

// ─── Team Service ───
// Handles team creation, admin assignment, and team lookup by user.
// One team per user (auto-created on first team purchase).

export function createTeam() {
  return db.insert(teams).values({}).returning().get();
}

export function addTeamMember(opts: {
  teamId: number;
  userId: number;
  role: TeamMemberRole;
}) {
  return db
    .insert(teamMembers)
    .values({ teamId: opts.teamId, userId: opts.userId, role: opts.role })
    .returning()
    .get();
}

export function getTeamForAdmin(userId: number) {
  const membership = db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .get();

  if (!membership) return undefined;

  return db.select().from(teams).where(eq(teams.id, membership.teamId)).get();
}

export function getOrCreateTeamForUser(userId: number) {
  const existingTeam = getTeamForAdmin(userId);
  if (existingTeam) return existingTeam;

  const team = createTeam();
  addTeamMember({ teamId: team.id, userId, role: TeamMemberRole.Admin });
  return team;
}

export function isTeamAdmin(userId: number) {
  return !!getTeamForAdmin(userId);
}

export function getTeamMembers(teamId: number) {
  return db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .all();
}
