import { useState } from "react";
import { useFetcher } from "react-router";
import { Trash2, MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { UserRole } from "~/db/schema";
import { cn } from "~/lib/utils";

type Comment = {
  id: number;
  body: string;
  bodyHtml: string;
  createdAt: string;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  userRole: string;
};

export function LessonComments({
  comments,
  currentUserId,
  isInstructor,
  lessonId,
}: {
  comments: Comment[];
  currentUserId: number | null;
  isInstructor: boolean;
  lessonId: number;
}) {
  const addFetcher = useFetcher({ key: `add-comment-${lessonId}` });
  const deleteFetcher = useFetcher({ key: `delete-comment-${lessonId}` });
  const [body, setBody] = useState("");

  const isSubmitting = addFetcher.state !== "idle";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    addFetcher.submit(
      { intent: "add-comment", body },
      { method: "post" }
    );
    setBody("");
  }

  const deletingId =
    deleteFetcher.state !== "idle"
      ? Number(deleteFetcher.formData?.get("commentId"))
      : null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="size-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">
          {comments.length === 0
            ? "Discussion"
            : `Discussion (${comments.length})`}
        </h2>
      </div>

      {/* Comment list */}
      {comments.length > 0 ? (
        <div className="mb-6 space-y-4">
          {comments.map((comment) => {
            const canDelete =
              currentUserId !== null &&
              (comment.userId === currentUserId || isInstructor);
            const isDeleting = deletingId === comment.id;

            return (
              <div
                key={comment.id}
                className={cn(
                  "rounded-lg border p-4 transition-opacity",
                  isDeleting && "opacity-40"
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={comment.userName}
                      avatarUrl={comment.userAvatarUrl}
                      className="size-7"
                    />
                    <span className="text-sm font-medium">
                      {comment.userName}
                    </span>
                    {comment.userRole === UserRole.Instructor && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Instructor
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>

                  {canDelete && (
                    <deleteFetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete-comment" />
                      <input
                        type="hidden"
                        name="commentId"
                        value={comment.id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={isDeleting}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </deleteFetcher.Form>
                  )}
                </div>

                <div
                  className="prose prose-neutral dark:prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          No comments yet. Be the first to start the discussion.
        </p>
      )}

      {/* New comment form */}
      {currentUserId !== null && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment… Markdown is supported."
            rows={4}
            maxLength={5000}
            className="resize-y font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {body.length}/5000 · Markdown supported
            </p>
            <Button
              type="submit"
              disabled={!body.trim() || isSubmitting}
              size="sm"
            >
              {isSubmitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
