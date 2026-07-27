import { describe, expect, test } from "bun:test";
import { pgConnectionString } from "./pgConnection.ts";

describe("pgConnectionString", () => {
  test("builds a postgres:// URL from PgConfig fields", () => {
    const url = pgConnectionString({
      host: "127.0.0.1",
      port: 5439,
      user: "eait",
      password: "eait",
      database: "eait_test",
    });
    expect(url).toBe("postgres://eait:eait@127.0.0.1:5439/eait_test");
  });

  test("percent-encodes special characters in user/password", () => {
    const url = pgConnectionString({
      host: "127.0.0.1",
      port: 5439,
      user: "ei@it",
      password: "p@ss:word",
      database: "eait_test",
    });
    expect(url).toBe("postgres://ei%40it:p%40ss%3Aword@127.0.0.1:5439/eait_test");
  });
});
