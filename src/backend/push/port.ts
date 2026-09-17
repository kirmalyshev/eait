// Delivering a notification to a device, as a port.
//
// Same reason `llm/port.ts` and `mail/port.ts` exist: the sweep that composes the 20:30 line is
// where this product's own bugs live, and a test of it must not need Expo, a device, or a network.
//
// TWO METHODS, because Expo's push API has two phases and the second one is not optional. `send`
// returns a TICKET per message — accepted, or refused outright. Minutes later a RECEIPT says what
// actually happened at Apple, and `DeviceNotRegistered` usually arrives THERE rather than in the
// ticket: the app was deleted, Apple told Expo, and until we read that receipt this server keeps a
// row it will try to push to every night forever.

/** One notification, addressed to one device. */
export interface PushMessage {
  /** The device's Expo push token. */
  to: string;
  title: string;
  body: string;
}

/**
 * Why a message did not arrive.
 *
 * `device-not-registered` is the only one that means anything here: the token is dead and must be
 * dropped. The rest are logged and the token is kept — a message rate that was exceeded tonight is
 * not a device that has gone away, and dropping on it would unsubscribe somebody for being popular.
 */
export type PushError =
  | "device-not-registered"
  | "message-too-big"
  | "message-rate-exceeded"
  | "mismatched-credentials"
  | "other";

/** What `send` says about one message. `id` is the receipt id, absent when it was refused outright. */
export interface PushTicket {
  token: string;
  id: string | null;
  error: PushError | null;
}

export interface PushPort {
  /** Deliver a batch. Chunking, retries and transport errors are the implementation's problem. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  /**
   * The second phase: what actually happened to the tickets, by receipt id.
   *
   * A receipt id that is not ready yet is simply absent from the result — not an error, and not a
   * reason to drop anything. The map's value is null for a delivery that succeeded.
   */
  receipts(ids: string[]): Promise<Map<string, PushError | null>>;
}
