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

export class AlbumBuffer<T> {
  private groups = new Map<string, Entry<T>>();

  constructor(
    private flushMs: number,
    private onFlush: (key: string, parts: T[]) => void,
  ) {}

  add(key: string, part: T): void {
    const existing = this.groups.get(key);
    if (existing) {
      existing.parts.push(part);
      clearTimeout(existing.timer);
      existing.timer = this.arm(key);
      return;
    }
    this.groups.set(key, { parts: [part], timer: this.arm(key) });
  }

  private arm(key: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      const entry = this.groups.get(key);
      this.groups.delete(key);
      if (entry) this.onFlush(key, entry.parts);
    }, this.flushMs);
  }
}
