export interface PlanStep {
  /** Step number (1-indexed) */
  index: number;
  /** Step title extracted from "#### Step N: Title" */
  title: string;
  /** Task description for Coding */
  description: string;
  /** Expected file paths */
  involvedFiles: string[];
  /** Verification criteria for Tester */
  verificationStandard: string;
}

export interface Plan {
  /** Task title */
  title: string;
  /** One-sentence overview */
  overview: string;
  /** Ordered execution steps */
  steps: PlanStep[];
  /** Inter-step dependency notes */
  dependencies: string;
}

export interface StepState {
  /** Which step in the plan (1-indexed) */
  stepIndex: number;
  /** task_id for the current Coding subagent (undefined if not started) */
  codingTaskId?: string;
  /** Number of retry attempts (reset on step completion) */
  attempt: number;
  /** Whether this step passed validation */
  completed: boolean;
}

export interface SessionState {
  /** Unique session identifier */
  sessionID: string;
  /** The plan being executed */
  plan?: Plan;
  /** Current step being worked on */
  currentStep: StepState;
  /** All completed steps */
  completedSteps: StepState[];
  /** When this state was last updated (ISO string) */
  lastUpdated: string;
}
