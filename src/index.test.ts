import { describe, it, expect } from "vitest";

describe("Plugin entry", () => {
  it("should export a plugin function", async () => {
    const mod = await import("./index.js");
    expect(typeof mod.default).toBe("function");
  });

  it("should return hooks object when invoked", async () => {
    const mod = await import("./index.js");
    const plugin = mod.default;
    const hooks = await plugin({
      client: {} as any,
      project: { name: "test", directory: "/tmp/test" } as any,
      directory: "/tmp/test",
      worktree: "/tmp/test",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as any,
    });
    expect(hooks).toBeDefined();
    expect(typeof hooks).toBe("object");
  });

  it("should export retry guard hook", async () => {
    const mod = await import("./index.js");
    const plugin = mod.default;
    const hooks = await plugin({
      client: {} as any,
      project: { name: "test", directory: "/tmp/test" } as any,
      directory: "/tmp/test",
      worktree: "/tmp/test",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as any,
    });
    expect(hooks["tool.execute.before"]).toBeDefined();
  });
});
