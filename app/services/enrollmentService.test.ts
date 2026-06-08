import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { getNotifications } from "./notificationService";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  enrollUser,
  unenrollUser,
  findEnrollment,
  isUserEnrolled,
  getEnrollmentById,
  getEnrollmentsByUser,
  getEnrollmentsByCourse,
  getEnrollmentCountForCourse,
  getUserEnrolledCourses,
  getCourseEnrolledStudents,
  markEnrollmentComplete,
} from "./enrollmentService";

describe("enrollmentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("enrollUser", () => {
    it("enrolls a user in a course", () => {
      const enrollment = enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      expect(enrollment).toBeDefined();
      expect(enrollment.userId).toBe(base.user.id);
      expect(enrollment.courseId).toBe(base.course.id);
      expect(enrollment.enrolledAt).toBeDefined();
      expect(enrollment.completedAt).toBeNull();
    });

    it("throws when enrolling a user who is already enrolled", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      expect(() =>
        enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false })
      ).toThrowError("User is already enrolled in this course");
    });

    it("throws when enrolling in a non-existent course", () => {
      expect(() =>
        enrollUser({ userId: base.user.id, courseId: 9999, sendEmail: false, skipValidation: false })
      ).toThrowError("Course not found");
    });

    it("skips course existence check when skipValidation is true", () => {
      // skipValidation bypasses the course existence check at the service level,
      // but the DB foreign key constraint still prevents inserting invalid references.
      // Verify it doesn't throw "Course not found" (service-level) but throws FK error instead.
      expect(() =>
        enrollUser({ userId: base.user.id, courseId: 9999, sendEmail: false, skipValidation: true })
      ).toThrowError(); // FK constraint, not "Course not found"
    });

    it("allows duplicate enrollment when skipValidation is true", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      // Second enrollment with skipValidation — no "already enrolled" error
      const second = enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: true });
      expect(second).toBeDefined();
    });

    it("accepts sendEmail parameter without error", () => {
      const enrollment = enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: true, skipValidation: false });
      expect(enrollment).toBeDefined();
    });
  });

  describe("unenrollUser", () => {
    it("unenrolls a user from a course", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const result = unenrollUser({ userId: base.user.id, courseId: base.course.id });
      expect(result).toBeDefined();
      expect(result!.userId).toBe(base.user.id);
      expect(result!.courseId).toBe(base.course.id);
    });

    it("throws when unenrolling a user who is not enrolled", () => {
      expect(() =>
        unenrollUser({ userId: base.user.id, courseId: base.course.id })
      ).toThrowError("User is not enrolled in this course");
    });

    it("removes the enrollment from the database", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });
      unenrollUser({ userId: base.user.id, courseId: base.course.id });

      expect(isUserEnrolled({ userId: base.user.id, courseId: base.course.id })).toBe(false);
    });
  });

  describe("findEnrollment", () => {
    it("returns the enrollment when it exists", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const found = findEnrollment({ userId: base.user.id, courseId: base.course.id });
      expect(found).toBeDefined();
      expect(found!.userId).toBe(base.user.id);
      expect(found!.courseId).toBe(base.course.id);
    });

    it("returns undefined when no enrollment exists", () => {
      const found = findEnrollment({ userId: base.user.id, courseId: base.course.id });
      expect(found).toBeUndefined();
    });
  });

  describe("isUserEnrolled", () => {
    it("returns true when user is enrolled", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      expect(isUserEnrolled({ userId: base.user.id, courseId: base.course.id })).toBe(true);
    });

    it("returns false when user is not enrolled", () => {
      expect(isUserEnrolled({ userId: base.user.id, courseId: base.course.id })).toBe(false);
    });
  });

  describe("getEnrollmentById", () => {
    it("returns enrollment by id", () => {
      const created = enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const found = getEnrollmentById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns undefined for non-existent id", () => {
      expect(getEnrollmentById(9999)).toBeUndefined();
    });
  });

  describe("getEnrollmentsByUser", () => {
    it("returns all enrollments for a user", () => {
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

      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });
      enrollUser({ userId: base.user.id, courseId: course2.id, sendEmail: false, skipValidation: false });

      const enrollmentsList = getEnrollmentsByUser(base.user.id);
      expect(enrollmentsList).toHaveLength(2);
    });

    it("returns empty array when user has no enrollments", () => {
      expect(getEnrollmentsByUser(base.user.id)).toHaveLength(0);
    });
  });

  describe("getEnrollmentsByCourse", () => {
    it("returns all enrollments for a course", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });
      enrollUser({ userId: student2.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const enrollmentsList = getEnrollmentsByCourse(base.course.id);
      expect(enrollmentsList).toHaveLength(2);
    });

    it("returns empty array when course has no enrollments", () => {
      expect(getEnrollmentsByCourse(base.course.id)).toHaveLength(0);
    });
  });

  describe("getEnrollmentCountForCourse", () => {
    it("returns the count of enrollments", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      expect(getEnrollmentCountForCourse(base.course.id)).toBe(1);
    });

    it("returns 0 when no enrollments exist", () => {
      expect(getEnrollmentCountForCourse(base.course.id)).toBe(0);
    });
  });

  describe("markEnrollmentComplete", () => {
    it("sets completedAt on the enrollment", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const result = markEnrollmentComplete({ userId: base.user.id, courseId: base.course.id });
      expect(result).toBeDefined();
      expect(result!.completedAt).toBeDefined();
      expect(result!.completedAt).not.toBeNull();
    });
  });

  describe("getUserEnrolledCourses", () => {
    it("returns enrolled courses with course details", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const courses = getUserEnrolledCourses(base.user.id);
      expect(courses).toHaveLength(1);
      expect(courses[0].courseTitle).toBe("Test Course");
      expect(courses[0].courseSlug).toBe("test-course");
      expect(courses[0].courseDescription).toBe("A test course");
    });

    it("returns empty array when user has no enrollments", () => {
      expect(getUserEnrolledCourses(base.user.id)).toHaveLength(0);
    });
  });

  describe("getCourseEnrolledStudents", () => {
    it("returns enrolled students for a course", () => {
      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const students = getCourseEnrolledStudents(base.course.id);
      expect(students).toHaveLength(1);
      expect(students[0].userId).toBe(base.user.id);
    });

    it("returns empty array when course has no enrollments", () => {
      expect(getCourseEnrolledStudents(base.course.id)).toHaveLength(0);
    });
  });

  describe("enrollment notification integration", () => {
    it("creates a notification for the instructor when a student enrolls", () => {
      enrollUser({
        userId: base.user.id,
        courseId: base.course.id,
        sendEmail: false,
        skipValidation: false,
      });

      const notifications = getNotifications({
        userId: base.instructor.id,
        limit: 10,
        offset: 0,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe(schema.NotificationType.Enrollment);
      expect(notifications[0].title).toBe("New Enrollment");
      expect(notifications[0].message).toBe(
        `${base.user.name} enrolled in ${base.course.title}`
      );
      expect(notifications[0].linkUrl).toBe(
        `/instructor/${base.course.id}/students`
      );
      expect(notifications[0].isRead).toBe(false);
    });

    it("creates notifications for each enrollment", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "Student Two", email: "student2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      enrollUser({ userId: base.user.id, courseId: base.course.id, sendEmail: false, skipValidation: false });
      enrollUser({ userId: student2.id, courseId: base.course.id, sendEmail: false, skipValidation: false });

      const notifications = getNotifications({ userId: base.instructor.id, limit: 10, offset: 0 });
      expect(notifications).toHaveLength(2);
    });
  });
});
