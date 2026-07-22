// Remembers the bot's "that doesn't look like food" reply ids so a follow-up reply to one can
// get a specific explanation instead of a generic answer. In-memory and bounded by design:
// nothing photo-derived may be persisted (ephemeral-image guarantee), and after a restart such
// replies degrade gracefully to the free-text router, which honestly has nothing on the photo.

const MAX_PER_USER = 20;

export class RejectionLog {
  private byUser = new Map<number, number[]>();

  add(userId: number, messageId: number): void {
    const ids = this.byUser.get(userId) ?? [];
    ids.push(messageId);
    if (ids.length > MAX_PER_USER) ids.shift();
    this.byUser.set(userId, ids);
  }

  has(userId: number, messageId: number): boolean {
    return this.byUser.get(userId)?.includes(messageId) ?? false;
  }
}
