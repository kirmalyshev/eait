// Telegram delivers a multi-photo message ("album") as N separate photo updates sharing
// media_group_id. This buffer collects parts per key and flushes the whole group after a
// quiet period, so the bot analyzes one album as ONE meal in ONE model call.
//
// In-memory by design: a crash between parts costs at most one partial analysis. The flush
// callback runs outside any grammy handler — callers capture everything they need (byte
// thunks, send, react) in the part payload.

interface Entry<T> {
  parts: T[];
  timer: ReturnType<typeof setTimeout>;
}

/** Telegram caps a media group at 10 items — a full group can flush without waiting. */
const MAX_PARTS = 10;

export class AlbumBuffer<T> {
  private groups = new Map<string, Entry<T>>();

  /**
   * The flush callback runs from a timer, outside any handler chain — errors it throws or
   * rejects with are caught and logged HERE, because nothing above this class can see them
   * (a sync throw in a bare setTimeout is a process-killing uncaughtException).
   */
  constructor(
    private flushMs: number,
    private onFlush: (key: string, parts: T[]) => void | Promise<void>,
  ) {}

  add(key: string, part: T): void {
    const existing = this.groups.get(key);
    if (!existing) {
      this.groups.set(key, { parts: [part], timer: this.arm(key) });
      return;
    }
    existing.parts.push(part);
    clearTimeout(existing.timer);
    if (existing.parts.length >= MAX_PARTS) {
      this.groups.delete(key);
      this.flush(key, existing.parts);
      return;
    }
    existing.timer = this.arm(key);
  }

  private arm(key: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      const entry = this.groups.get(key);
      this.groups.delete(key);
      if (entry) this.flush(key, entry.parts);
    }, this.flushMs);
  }

  private flush(key: string, parts: T[]): void {
    try {
      void Promise.resolve(this.onFlush(key, parts)).catch((e) =>
        console.error(`[eait] album flush rejected key=${key}: ${(e as Error)?.message ?? e}`),
      );
    } catch (e) {
      console.error(`[eait] album flush threw key=${key}: ${(e as Error)?.message ?? e}`);
    }
  }
}
