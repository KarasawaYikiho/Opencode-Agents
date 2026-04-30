import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { SessionState, StepState } from "../types.js";

const STATE_FILE = "state.json";

export class StateTracker {
  private state: SessionState | null = null;
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  init(sessionID: string): SessionState {
    this.state = {
      sessionID,
      currentStep: { stepIndex: 0, attempt: 0, completed: false },
      completedSteps: [],
      lastUpdated: new Date().toISOString(),
    };
    return this.state;
  }

  load(sessionID: string): SessionState | null {
    const filePath = this.getPath();
    if (!existsSync(filePath)) return null;
    try {
      const raw = readFileSync(filePath, "utf-8");
      this.state = JSON.parse(raw) as SessionState;
      return this.state;
    } catch {
      return null;
    }
  }

  save(): void {
    if (!this.state) return;
    this.state.lastUpdated = new Date().toISOString();
    const filePath = this.getPath();
    writeFileSync(filePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  getState(): SessionState {
    if (!this.state) throw new Error("State not initialized. Call init() or load() first.");
    return this.state;
  }

  setCurrentStep(step: StepState): void {
    const s = this.getState();
    s.currentStep = step;
  }

  incrementAttempt(): void {
    const s = this.getState();
    s.currentStep.attempt++;
  }

  completeStep(): void {
    const s = this.getState();
    s.currentStep.completed = true;
    s.completedSteps.push({ ...s.currentStep });
    s.currentStep = { stepIndex: 0, attempt: 0, completed: false };
  }

  clear(): void {
    if (!this.state) return;
    const filePath = this.getPath();
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    this.state = null;
  }

  private getPath(): string {
    return join(this.baseDir, STATE_FILE);
  }
}
