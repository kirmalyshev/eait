import { describe, expect, test } from "bun:test";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { MockLanguageModelV4 } from "ai/test";

describe("mastra dependency surface", () => {
  test("every export this engine depends on resolves", () => {
    expect(typeof Agent).toBe("function");
    expect(typeof createTool).toBe("function");
    expect(typeof RequestContext).toBe("function");
    expect(typeof Memory).toBe("function");
    expect(typeof PostgresStore).toBe("function");
    expect(typeof MockLanguageModelV4).toBe("function");
  });
});
