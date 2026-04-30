import { describe, it, expect, beforeEach } from "vitest";
import { RetryGuard } from "./RetryGuard.js";

describe("RetryGuard", () => {
  let guard: RetryGuard;

  beforeEach(() => {
    guard = new RetryGuard(3);
  });

  it("should allow up to maxRetries calls", () => {
    expect(guard.canDispatch("step-1")).toBe(true);
    guard.recordDispatch("step-1");
    expect(guard.canDispatch("step-1")).toBe(true);
    guard.recordDispatch("step-1");
    expect(guard.canDispatch("step-1")).toBe(true);
    guard.recordDispatch("step-1");
    expect(guard.canDispatch("step-1")).toBe(false);
  });

  it("should allow dispatch when under limit", () => {
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    expect(guard.canDispatch("step-1")).toBe(true);
  });

  it("should track different steps independently", () => {
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    expect(guard.canDispatch("step-1")).toBe(false);
    expect(guard.canDispatch("step-2")).toBe(true);
  });

  it("should reset step counter", () => {
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    guard.reset("step-1");
    expect(guard.canDispatch("step-1")).toBe(true);
    expect(guard.getCount("step-1")).toBe(0);
  });

  it("should report if exceeded", () => {
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    guard.recordDispatch("step-1");
    expect(guard.isExceeded("step-1")).toBe(true);
    expect(guard.isExceeded("step-2")).toBe(false);
  });

  it("should return count for a key", () => {
    expect(guard.getCount("step-x")).toBe(0);
    guard.recordDispatch("step-x");
    expect(guard.getCount("step-x")).toBe(1);
  });
});
