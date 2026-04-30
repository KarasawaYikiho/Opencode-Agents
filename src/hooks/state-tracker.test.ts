import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateTracker } from "./state-tracker.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { StepState } from "../types.js";

let tracker: StateTracker;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "opencode-agents-test-"));
  tracker = new StateTracker(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("StateTracker", () => {
  it("should create initial session state", () => {
    const state = tracker.init("session-1");
    expect(state.sessionID).toBe("session-1");
    expect(state.currentStep.stepIndex).toBe(0);
    expect(state.currentStep.attempt).toBe(0);
    expect(state.currentStep.completed).toBe(false);
  });

  it("should persist state to disk", () => {
    tracker.init("session-1");
    tracker.save();
    const statePath = join(tmpDir, "state.json");
    expect(existsSync(statePath)).toBe(true);
    const raw = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(raw.sessionID).toBe("session-1");
  });

  it("should load persisted state", () => {
    tracker.init("session-1");
    tracker.save();

    const tracker2 = new StateTracker(tmpDir);
    const loaded = tracker2.load("session-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionID).toBe("session-1");
  });

  it("should return null for nonexistent session", () => {
    const loaded = tracker.load("nonexistent");
    expect(loaded).toBeNull();
  });

  it("should update current step", () => {
    tracker.init("session-1");
    const step: StepState = {
      stepIndex: 1,
      codingTaskId: "task-abc",
      attempt: 1,
      completed: false,
    };
    tracker.setCurrentStep(step);
    tracker.save();

    const loaded = tracker.load("session-1")!;
    expect(loaded.currentStep.stepIndex).toBe(1);
    expect(loaded.currentStep.codingTaskId).toBe("task-abc");
  });

  it("should increment attempt count", () => {
    tracker.init("session-1");
    tracker.setCurrentStep({
      stepIndex: 2,
      codingTaskId: "task-def",
      attempt: 1,
      completed: false,
    });
    tracker.incrementAttempt();
    expect(tracker.getState().currentStep.attempt).toBe(2);
  });

  it("should mark step as complete and archive it", () => {
    tracker.init("session-1");
    tracker.setCurrentStep({
      stepIndex: 1,
      codingTaskId: "task-abc",
      attempt: 1,
      completed: false,
    });
    tracker.completeStep();

    const state = tracker.getState();
    expect(state.currentStep.completed).toBe(false);
    expect(state.currentStep.stepIndex).toBe(0);
    expect(state.completedSteps.length).toBe(1);
    expect(state.completedSteps[0].completed).toBe(true);
  });

  it("should clear state", () => {
    tracker.init("session-1");
    tracker.save();
    tracker.clear();
    const loaded = tracker.load("session-1");
    expect(loaded).toBeNull();
  });
});
