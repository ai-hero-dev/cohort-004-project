import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { Reply, Trash2 } from "lucide-react";
import { UserRole } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/user-avatar";

export type CommentData = {
  id: number;
  lessonId: number;
  userId: number;
  parentId: number | null;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: UserRole;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CommentSection({
  comments,
  currentUserId,
  currentUserRole,
  lessonId,
}: {
  comments: CommentData[];
  currentUserId: number | null;
  currentUserRole: UserRole | null;
  lessonId: number;
}) {
  const topLevel = comments.filter((c) => c.parentId === null);
  const replies = comments.filter((c) => c.parentId !== null);
  const canModerate =
    currentUserRole === UserRole.Instructor ||
    currentUserRole === UserRole.Admin;

  return (
    <div className="mt-10 border-t pt-8">
      <h2 className="mb-6 text-xl font-semibold">
        Discussion ({topLevel.length})
      </h2>

      {currentUserId && (
        <CommentForm
          lessonId={lessonId}
          parentId={null}
          placeholder="Ask a question or leave a comment..."
        />
      )}

      {topLevel.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No comments yet. Be the first to ask a question.
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={replies.filter((r) => r.parentId === comment.id)}
              currentUserId={currentUserId}
              canModerate={canModerate}
              lessonId={lessonId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentThread({
  comment,
  replies,
  currentUserId,
  canModerate,
  lessonId,
}: {
  comment: CommentData;
  replies: CommentData[];
  currentUserId: number | null;
  canModerate: boolean;
  lessonId: number;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <li>
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        canModerate={canModerate}
        onReply={currentUserId ? () => setShowReplyForm((v) => !v) : undefined}
        showingReply={showReplyForm}
      />

      {replies.length > 0 && (
        <ul className="ml-10 mt-3 space-y-4 border-l pl-4">
          {replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem
                comment={reply}
                currentUserId={currentUserId}
                canModerate={canModerate}
              />
            </li>
          ))}
        </ul>
      )}

      {showReplyForm && currentUserId && (
        <div className="ml-10 mt-3 border-l pl-4">
          <CommentForm
            lessonId={lessonId}
            parentId={comment.id}
            placeholder="Write a reply..."
            onSubmitted={() => setShowReplyForm(false)}
            compact
          />
        </div>
      )}
    </li>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canModerate,
  onReply,
  showingReply,
}: {
  comment: CommentData;
  currentUserId: number | null;
  canModerate: boolean;
  onReply?: () => void;
  showingReply?: boolean;
}) {
  const deleteFetcher = useFetcher({ key: `delete-comment-${comment.id}` });
  const canDelete = currentUserId === comment.userId || canModerate;
  const isDeleted = !!comment.deletedAt;

  return (
    <div className="flex gap-3">
      <UserAvatar
        name={comment.authorName}
        avatarUrl={comment.authorAvatarUrl}
        className="size-8 shrink-0"
      />
      <div className="flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{comment.authorName}</span>
          {comment.authorRole === UserRole.Instructor && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Instructor
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(comment.createdAt)}
          </span>
        </div>

        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">[comment deleted]</p>
        ) : (
          <p className="text-sm">{comment.body}</p>
        )}

        {!isDeleted && (
          <div className="mt-2 flex items-center gap-4">
            {onReply && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="size-3.5" />
                {showingReply ? "Cancel" : "Reply"}
              </button>
            )}
            {canDelete && currentUserId && (
              <deleteFetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-comment" />
                <input type="hidden" name="commentId" value={comment.id} />
                <button
                  type="submit"
                  disabled={deleteFetcher.state !== "idle"}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              </deleteFetcher.Form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentForm({
  lessonId,
  parentId,
  placeholder,
  onSubmitted,
  compact,
}: {
  lessonId: number;
  parentId: number | null;
  placeholder?: string;
  onSubmitted?: () => void;
  compact?: boolean;
}) {
  const fetcher = useFetcher({
    key: `comment-form-${lessonId}-${parentId ?? "root"}`,
  });
  const isSubmitting = fetcher.state !== "idle";
  const [body, setBody] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setBody("");
      onSubmitted?.();
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="post-comment" />
      <input type="hidden" name="lessonId" value={lessonId} />
      {parentId !== null && (
        <input type="hidden" name="parentId" value={parentId} />
      )}
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? "Leave a comment..."}
        maxLength={1000}
        rows={compact ? 2 : 3}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        required
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{body.length}/1000</span>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || body.trim().length === 0}
        >
          {isSubmitting ? "Posting..." : "Post"}
        </Button>
      </div>
    </fetcher.Form>
  );
}
