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
  createTeam,
  addTeamMember,
  getTeamForAdmin,
  getOrCreateTeamForUser,
  isTeamAdmin,
  getTeamMembers,
} from "./teamService";

describe("teamService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createTeam", () => {
    it("creates a team and returns it", () => {
      const team = createTeam();

      expect(team).toBeDefined();
      expect(team.id).toBeDefined();
      expect(team.createdAt).toBeDefined();
    });
  });

  describe("addTeamMember", () => {
    it("adds a user as an admin", () => {
      const team = createTeam();
      const member = addTeamMember({
        teamId: team.id,
        userId: base.user.id,
        role: schema.TeamMemberRole.Admin,
      });

      expect(member).toBeDefined();
      expect(member.teamId).toBe(team.id);
      expect(member.userId).toBe(base.user.id);
      expect(member.role).toBe(schema.TeamMemberRole.Admin);
    });

    it("adds a user as a member", () => {
      const team = createTeam();
      const member = addTeamMember({
        teamId: team.id,
        userId: base.user.id,
        role: schema.TeamMemberRole.Member,
      });

      expect(member.role).toBe(schema.TeamMemberRole.Member);
    });
  });

  describe("getTeamForAdmin", () => {
    it("returns the team when user is an admin", () => {
      const team = createTeam();
      addTeamMember({ teamId: team.id, userId: base.user.id, role: schema.TeamMemberRole.Admin });

      const found = getTeamForAdmin(base.user.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(team.id);
    });

    it("returns undefined when user is a member but not admin", () => {
      const team = createTeam();
      addTeamMember({ teamId: team.id, userId: base.user.id, role: schema.TeamMemberRole.Member });

      const found = getTeamForAdmin(base.user.id);
      expect(found).toBeUndefined();
    });

    it("returns undefined when user has no team", () => {
      const found = getTeamForAdmin(base.user.id);
      expect(found).toBeUndefined();
    });
  });

  describe("getOrCreateTeamForUser", () => {
    it("creates a new team and makes user admin", () => {
      const team = getOrCreateTeamForUser(base.user.id);

      expect(team).toBeDefined();
      expect(team.id).toBeDefined();

      // Verify user is admin of the team
      const members = getTeamMembers(team.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(base.user.id);
      expect(members[0].role).toBe(schema.TeamMemberRole.Admin);
    });

    it("returns existing team on subsequent calls (team is reused)", () => {
      const team1 = getOrCreateTeamForUser(base.user.id);
      const team2 = getOrCreateTeamForUser(base.user.id);

      expect(team1.id).toBe(team2.id);

      // Verify only one membership exists (not duplicated)
      const members = getTeamMembers(team1.id);
      expect(members).toHaveLength(1);
    });
  });

  describe("isTeamAdmin", () => {
    it("returns true when user is a team admin", () => {
      getOrCreateTeamForUser(base.user.id);

      expect(isTeamAdmin(base.user.id)).toBe(true);
    });

    it("returns false when user is a regular member", () => {
      const team = createTeam();
      addTeamMember({ teamId: team.id, userId: base.user.id, role: schema.TeamMemberRole.Member });

      expect(isTeamAdmin(base.user.id)).toBe(false);
    });

    it("returns false when user has no team", () => {
      expect(isTeamAdmin(base.user.id)).toBe(false);
    });
  });

  describe("getTeamMembers", () => {
    it("returns all members of a team", () => {
      const team = createTeam();
      addTeamMember({ teamId: team.id, userId: base.user.id, role: schema.TeamMemberRole.Admin });
      addTeamMember({ teamId: team.id, userId: base.instructor.id, role: schema.TeamMemberRole.Member });

      const members = getTeamMembers(team.id);
      expect(members).toHaveLength(2);
    });

    it("returns empty array for a team with no members", () => {
      const team = createTeam();

      const members = getTeamMembers(team.id);
      expect(members).toHaveLength(0);
    });
  });
});
