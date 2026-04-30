# OpenCode Multi-Agent Orchestration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode Plugin that registers 4 specialized agents (Brain/Planner/Coding/Tester) with prompt-driven orchestration and code-level retry guards.

**Architecture:** A TypeScript plugin using `@opencode-ai/plugin` SDK. Agent behaviors are defined in `.prompt.md` files loaded at startup. Orchestration logic lives in Brain's system prompt. Two lightweight hooks (retry-guard, state-tracker) provide code-level safety rails.

**Tech Stack:** TypeScript, `@opencode-ai/plugin` v1.4+, Vitest for testing, Node.js 20+

**Repo:** https://github.com/KarasawaYikiho/Opencode-Agents.git

---

### Task 1: Project Scaffolding

**Files:**
- Create: `D:\GIT\Opencode Agents\package.json`
- Create: `D:\GIT\Opencode Agents\tsconfig.json`
- Create: `D:\GIT\Opencode Agents\.gitignore`
- Create: `D:\GIT\Opencode Agents\vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "opencode-agents",
  "version": "1.0.0",
  "description": "Multi-agent orchestration plugin for OpenCode — Brain dispatches Planner/Coding/Tester in a plan-first validator-gated loop",
  "type": "module",
  "main": "dist/index.js",
  "files": [
    "dist/",
    "src/agents/",
    "opencode.jsonc",
    "install.sh",
    "install.ps1",
    "uninstall.sh"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@opencode-ai/plugin": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "license": "MIT",
  "keywords": ["opencode", "plugin", "multi-agent", "orchestration"],
  "repository": {
    "type": "git",
    "url": "https://github.com/KarasawaYikiho/Opencode-Agents.git"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.env
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 5: Install dependencies and verify build**

Run: `npm install`

Expected: Installs all dependencies without errors.

Run: `npx tsc --noEmit`

Expected: No errors (may show no inputs since src/ is empty — that's fine).

Run: `npx vitest run`

Expected: "No test files found" (not an error).

- [ ] **Step 6: Initialize git and push**

```bash
git init
git add -A
git commit -m "chore: scaffold project with TypeScript and Vitest"
git remote add origin https://github.com/KarasawaYikiho/Opencode-Agents.git
git push -u origin main
```

---

### Task 2: Shared Type Definitions

**Files:**
- Create: `D:\GIT\Opencode Agents\src\types.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
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

export interface CodingResult {
  files: Array<{ path: string; action: "created" | "modified" }>;
  summary: string;
}

export interface TesterResult {
  result: "pass" | "fail";
  summary: string;
  details: Array<{ item: string; status: "pass" | "fail" | "na"; detail: string }>;
  failReason?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared type definitions"
```

---

### Task 3: State Tracker Module

**Files:**
- Create: `D:\GIT\Opencode Agents\src\hooks\state-tracker.ts`
- Create: `D:\GIT\Opencode Agents\src\hooks\state-tracker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/state-tracker.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateTracker } from "./state-tracker.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { SessionState, StepState } from "../types.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/state-tracker.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement StateTracker**

Create `src/hooks/state-tracker.ts`:

```typescript
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
    const filePath = this.getPath(sessionID);
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
    const filePath = this.getPath(this.state.sessionID);
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
    const filePath = this.getPath(this.state.sessionID);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    this.state = null;
  }

  private getPath(sessionID: string): string {
    return join(this.baseDir, `${sessionID}-${STATE_FILE}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/state-tracker.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add StateTracker with persistence and tests"
```

---

### Task 4: Retry Guard Module

**Files:**
- Create: `D:\GIT\Opencode Agents\src\hooks\retry-guard.ts`
- Create: `D:\GIT\Opencode Agents\src\hooks\retry-guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/retry-guard.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RetryGuard } from "./retry-guard.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/retry-guard.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RetryGuard**

Create `src/hooks/retry-guard.ts`:

```typescript
export class RetryGuard {
  private counts: Map<string, number> = new Map();
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  canDispatch(key: string): boolean {
    const count = this.counts.get(key) ?? 0;
    return count < this.maxRetries;
  }

  recordDispatch(key: string): void {
    const count = this.counts.get(key) ?? 0;
    this.counts.set(key, count + 1);
  }

  isExceeded(key: string): boolean {
    return !this.canDispatch(key);
  }

  getCount(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  reset(key: string): void {
    this.counts.delete(key);
  }

  resetAll(): void {
    this.counts.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/retry-guard.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add RetryGuard with configurable max retries and tests"
```

---

### Task 5: Agent Prompt Files

**Files:**
- Create: `D:\GIT\Opencode Agents\src\agents\brain.prompt.md`
- Create: `D:\GIT\Opencode Agents\src\agents\planner.prompt.md`
- Create: `D:\GIT\Opencode Agents\src\agents\coding.prompt.md`
- Create: `D:\GIT\Opencode Agents\src\agents\tester.prompt.md`

- [ ] **Step 1: Create brain.prompt.md**

```markdown
你是 Brain Agent，多Agent协同系统的调度中心。
你是用户唯一接触的Agent，负责分配和管理所有子Agent。

## 你的工具
- Task("planner")  — 生成任务计划
- Task("coding")   — 执行编码任务
- Task("tester")   — 验证编码结果

## 工作流程

### Phase 1: 接收 & 规划
当收到用户指令时：
1. 立即通过 Task("planner") 将原始指令发送给Planner
2. 接收Planner返回的计划（Markdown格式）
3. 展示计划给用户确认（可选，简单任务跳过）

### Phase 2: 逐步执行
解析计划，对每个 Step 依次执行：

对于每个Step:
  attempt = 0
  循环:
    attempt++
    若 attempt == 1: 创建新Coding (新Task，无task_id)
    否则: 使用上次task_id恢复Coding会话（保留修复上下文）
    构造Coding任务并发送
    接收Coding返回 → 构造Tester任务（每次全新创建）
    接收Tester返回
    若 PASS → 标记完成，跳出循环
    若 FAIL 且 attempt < 3 → 继续循环修复
    若 FAIL 且 attempt >= 3 → 向用户报告，暂停整个流程

### Phase 3: 完成报告
所有Step完成后向用户汇总：完成步骤、验证结果、文件总览。

## 关键规则

### 文件隔离
- 你不读写任何文件。文件路径仅作为描述传递
- Coding写入工作区，Tester自行读取工作区验证

### 上下文管理
- Step完成后：下一Step的Coding/Tester必须全新创建（不带task_id）
- 修复时：同一Step的Coding使用相同task_id保留上下文

### 重试上限
- 每Step最多重试3次
- 超过后暂停并向用户报告：哪个Step失败、每次Tester反馈、建议干预方向

### 并行限制
- Steps串行执行（步骤间可能有依赖）
- 同一Step内Coding/Tester串行

## 计划解析
匹配 `#### Step N: ` 提取步骤列表，直接透传任务描述、涉及文件、验证标准。

## Coding任务格式
使用以下模板构造发送给Coding的任务：

```
Task: [步骤标题]

Description: [任务描述]

Involved Files:
  - [路径]  (create|modify)
  - [路径]  (create|modify)

Verification Standard: [验证标准]

Return: file paths + change summary. Do NOT return file contents.
```

## Tester任务格式
使用以下模板构造发送给Tester的任务：

```
Verify the following coding result:

Step: [步骤标题]

Files to check:
  - [路径] (created)
  - [路径] (modified)

Verification Standard: [验证标准]

Workdir: [当前工作区路径]

Run full quality check (lint, typecheck, build, test).
Return: RESULT (pass/fail), SUMMARY, DETAILS, FAIL_REASON (if fail).
```
```

- [ ] **Step 2: Create planner.prompt.md**

```markdown
你是 Planner Agent。你会收到来自 Brain 的用户原始指令。

你的任务：
1. 理解用户的自然语言需求
2. 将需求拆解为适合多Agent并行协同的步骤
3. 每个步骤是独立的、可验证的编码单元
4. 输出标准Markdown格式（含Overview、Steps、Dependencies）

## 输出格式

严格使用以下Markdown格式输出：

## Plan: [任务标题]

### Overview
[一句话描述任务目标]

### Steps

#### Step 1: [步骤标题]
- **Description**: [Coding需要做什么]
- **Involved Files**: [预期会创建/修改的文件路径]
- **Verification Standard**: [Tester应如何验证——lint通过/tests通过/功能正确等]

#### Step 2: [步骤标题]
- **Description**: ...
- **Involved Files**: ...
- **Verification Standard**: ...

### Dependencies
- [如有步骤间依赖关系，在此说明]

## 原则
- 步骤粒度适中：每步Coding可在单个会话完成
- 每步必须包含验证标准，Tester才能自动验证
- 明确标注涉及文件路径
- 有步骤依赖时显式声明
- 验证标准必须具体、可执行（如"npm test passes"而非"代码正确"）
- 无依赖时Dependencies写"None"
```

- [ ] **Step 3: Create coding.prompt.md**

```markdown
你是 Coding Agent。你会从 Brain 收到一条明确的编码任务。

收到的任务包含：任务描述、涉及文件、验证标准

你的职责：
1. 根据任务描述编写/修改代码
2. 所有文件写入当前工作区
3. 完成后仅返回：文件路径列表 + 变更摘要

## 返回格式

```
FILES:
  - [文件路径] (created)
  - [文件路径] (modified)

SUMMARY: [做了什么、为什么这样做]
```

## 原则
- 严格遵守涉及文件列表，不越界修改无关文件
- 遵循项目已有的代码风格和架构
- 不写测试文件（Tester负责验证）
- 不确定时做最小化假设并在SUMMARY中标注
- 不返回文件内容，只返回文件路径和变更摘要
```

- [ ] **Step 4: Create tester.prompt.md**

```markdown
你是 Tester Agent。你会从 Brain 收到 Coding 的产出信息。

收到的信息包含：文件路径列表、验证标准、工作区路径

你的职责：
1. 自行读取所有涉及文件
2. 执行完整质量检查
3. 返回结构化结果

## 检查流程

按顺序执行以下检查（即使前一项失败也继续后续检查）：

1. **Lint**: 检测项目的lint工具（eslint/ruff/golangci-lint等），执行检查
2. **Typecheck**: 检测类型检查工具（tsc/mypy等），执行检查
3. **Build**: 检测构建命令（npm run build/cargo build等），执行构建
4. **Test**: 检测测试框架（npm test/pytest/cargo test等），执行测试
5. **Functional**: 对照验证标准进行功能检查

每项检查结果独立记录。

## 返回格式

```
RESULT: pass | fail
SUMMARY: [一句话总结整体结果]
DETAILS:
  - [检查项名]: ✅/❌ [详情]
  - [检查项名]: ✅/❌ [详情]
  - [检查项名]: N/A [原因]
FAIL_REASON: [若fail，简述原因及精确修复建议]
```

## 原则
- 自行检测项目使用的工具链（读package.json/Makefile/pyproject.toml等）
- 某检查项不适用时标注 N/A 而非跳过
- 失败时提供精确到文件和行号的修复建议
- RESULT判定：所有适用检查项全部通过才为"pass"，任一失败即为"fail"
- 测试命令无法检测到测试时，标注 N/A 并说明原因
```

- [ ] **Step 5: Verify all prompt files exist**

Run: `ls -la src/agents/`

Expected: Shows 4 .md files.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add agent system prompts for Brain, Planner, Coding, Tester"
```

---

### Task 6: Agent Configuration

**Files:**
- Create: `D:\GIT\Opencode Agents\opencode.jsonc`

- [ ] **Step 1: Create opencode.jsonc**

```jsonc
{
  "agent": {
    "brain": {
      "mode": "primary",
      "description": "Master scheduler agent: receives user commands, dispatches Planner/Coding/Tester sub-agents, manages workflow",
      "temperature": 0.3,
      "color": "#FF6B6B",
      "steps": 50,
      "prompt": "src/agents/brain.prompt.md",
      "permission": {
        "task": { "allow": true },
        "read": { "allow": false },
        "edit": { "allow": false },
        "write": { "allow": false },
        "glob": { "allow": false },
        "grep": { "allow": false },
        "bash": { "allow": false }
      }
    },
    "planner": {
      "mode": "subagent",
      "description": "Understands user requirements, produces structured multi-agent execution plans",
      "temperature": 0.5,
      "color": "#4ECDC4",
      "steps": 20,
      "prompt": "src/agents/planner.prompt.md"
    },
    "coding": {
      "mode": "subagent",
      "description": "Executes coding tasks from Brain, writes/modifies files in shared workspace",
      "temperature": 0.2,
      "color": "#45B7D1",
      "steps": 30,
      "prompt": "src/agents/coding.prompt.md",
      "model": {
        "providerID": "webtech",
        "modelID": "deepseek-v4-pro"
      }
    },
    "tester": {
      "mode": "subagent",
      "description": "Full quality check on Coding output: lint, typecheck, build, test suite",
      "temperature": 0.1,
      "color": "#96CEB4",
      "steps": 20,
      "prompt": "src/agents/tester.prompt.md"
    }
  },
  "default_agent": "brain"
}
```

- [ ] **Step 2: Validate JSON syntax**

Run: `npx jsonc-parser --validate opencode.jsonc` (or `node -e "JSON.parse(require('fs').readFileSync('opencode.jsonc','utf8').replace(/\/\/.*/g,''))"`)

Expected: No parse errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add agent configuration with brain as default primary agent"
```

---

### Task 7: Plugin Entry Point

**Files:**
- Create: `D:\GIT\Opencode Agents\src\index.ts`
- Create: `D:\GIT\Opencode Agents\src\index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement index.ts**

```typescript
import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { RetryGuard } from "./hooks/retry-guard.js";

const MAX_RETRIES_PER_STEP = 3;
const MAX_CODING_CALLS_PER_SESSION = 50;

const plugin: Plugin = async (_input) => {
  const retryGuard = new RetryGuard(MAX_RETRIES_PER_STEP);

  const hooks: Hooks = {
    "tool.execute.before": async (ctx, output) => {
      if (ctx.tool === "task") {
        const args = output.args;
        const agentName: string | undefined =
          args?.agent ?? args?.name ?? args?.subagent_type;

        if (agentName === "coding") {
          const stepKey = `session:${ctx.sessionID}`;
          const count = retryGuard.getCount(stepKey);

          if (!retryGuard.canDispatch(stepKey)) {
            throw new Error(
              `RetryGuard: Coding retry limit (${MAX_RETRIES_PER_STEP}) exceeded. ` +
                `Step has been attempted ${count} times. Halting.`
            );
          }

          if (count >= MAX_CODING_CALLS_PER_SESSION) {
            throw new Error(
              `RetryGuard: Maximum coding calls (${MAX_CODING_CALLS_PER_SESSION}) exceeded for session.`
            );
          }

          retryGuard.recordDispatch(stepKey);
        }
      }
    },

    "tool.execute.after": async (ctx, output) => {
      if (ctx.tool === "task") {
        const args = ctx.args;
        const agentName: string | undefined =
          args?.agent ?? args?.name ?? args?.subagent_type;

        if (agentName === "coding") {
          const stepKey = `session:${ctx.sessionID}`;
          console.log(
            `[opencode-agents] Coding call #${retryGuard.getCount(stepKey)} completed for ${ctx.sessionID}`
          );
        }

        if (agentName === "tester") {
          const testerOutput = output.output ?? "";
          const hasPass = /RESULT:\s*pass/i.test(testerOutput);
          const stepKey = `session:${ctx.sessionID}`;

          if (hasPass) {
            retryGuard.reset(stepKey);
            console.log(`[opencode-agents] Tester passed — retry counter reset for ${stepKey}`);
          } else {
            console.log(
              `[opencode-agents] Tester failed — retry count: ${retryGuard.getCount(stepKey)}/${MAX_RETRIES_PER_STEP}`
            );
          }
        }
      }
    },

    "tool.definition": async (ctx, output) => {
      if (ctx.toolID === "task") {
        output.description +=
          " Use this to dispatch sub-agents: planner (for planning), coding (for implementation), tester (for verification).";
      }
    },
  };

  return hooks;
};

export default plugin;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/index.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Build and verify output**

Run: `npm run build`

Expected: Compiles successfully, creates dist/index.js.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: implement plugin entry with retry guard and state tracking hooks"
```

---

### Task 8: Installers

**Files:**
- Create: `D:\GIT\Opencode Agents\install.ps1`
- Create: `D:\GIT\Opencode Agents\install.sh`
- Create: `D:\GIT\Opencode Agents\uninstall.sh`

- [ ] **Step 1: Create install.ps1 (Windows)**

```powershell
# OpenCode Agents Installer (Windows PowerShell)
# Usage: .\install.ps1

$ErrorActionPreference = "Stop"

$OpencodeConfigDir = "$env:USERPROFILE\.config\opencode"
$OpencodeConfigFile = "$OpencodeConfigDir\opencode.jsonc"
$OpencodeAgentsDir = "$OpencodeConfigDir\agents\opencode-agents"
$PluginDir = (Get-Location).Path
$BackupFile = "$OpencodeConfigDir\opencode.jsonc.backup-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "=== OpenCode Agents Installer ===" -ForegroundColor Cyan

# 1. Backup existing config
if (Test-Path $OpencodeConfigFile) {
    Copy-Item $OpencodeConfigFile $BackupFile
    Write-Host "Backed up config to $BackupFile" -ForegroundColor Green
}

# 2. Copy agent prompts
New-Item -ItemType Directory -Force -Path $OpencodeAgentsDir | Out-Null
Copy-Item "$PluginDir\src\agents\*.md" $OpencodeAgentsDir -Force
Write-Host "Copied agent prompts to $OpencodeAgentsDir" -ForegroundColor Green

# 3. Install npm dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install --production
Write-Host "Dependencies installed" -ForegroundColor Green

# 4. Merge agent config
Write-Host "To complete setup, add the agent definitions from opencode.jsonc to your opencode.jsonc"
Write-Host "and set `"default_agent`": `"brain`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your config is at: $OpencodeConfigFile" -ForegroundColor Cyan
Write-Host "Backup file at: $BackupFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
```

- [ ] **Step 2: Create install.sh (Linux/Mac)**

```bash
#!/usr/bin/env bash
# OpenCode Agents Installer (Linux/macOS)
# Usage: ./install.sh

set -e

OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents/opencode-agents"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc.backup-$(date +%Y%m%d%H%M%S)"

echo "=== OpenCode Agents Installer ==="

# 1. Backup existing config
if [ -f "$OPENCODE_CONFIG_FILE" ]; then
    cp "$OPENCODE_CONFIG_FILE" "$BACKUP_FILE"
    echo "Backed up config to $BACKUP_FILE"
fi

# 2. Copy agent prompts
mkdir -p "$OPENCODE_AGENTS_DIR"
cp "$PLUGIN_DIR/src/agents/"*.md "$OPENCODE_AGENTS_DIR/"
echo "Copied agent prompts to $OPENCODE_AGENTS_DIR"

# 3. Install npm dependencies
echo "Installing dependencies..."
npm install --production
echo "Dependencies installed"

# 4. Build TypeScript
echo "Building..."
npm run build
echo "Build complete"

# 5. Instructions
echo ""
echo "To complete setup, add the agent definitions from opencode.jsonc to your opencode.jsonc"
echo "and set \"default_agent\": \"brain\""
echo ""
echo "Your config is at: $OPENCODE_CONFIG_FILE"
echo "Backup file at: $BACKUP_FILE"
echo ""
echo "Installation complete!"
```

- [ ] **Step 3: Create uninstall.sh**

```bash
#!/usr/bin/env bash
# OpenCode Agents Uninstaller
# Usage: ./uninstall.sh

set -e

OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents/opencode-agents"

echo "=== OpenCode Agents Uninstaller ==="

# 1. Remove agent prompts
if [ -d "$OPENCODE_AGENTS_DIR" ]; then
    rm -rf "$OPENCODE_AGENTS_DIR"
    echo "Removed $OPENCODE_AGENTS_DIR"
fi

# 2. Restore default agent
echo ""
echo "Uninstall complete. Manual steps:"
echo " 1. Remove 'brain', 'planner', 'coding', 'tester' blocks from your opencode.jsonc agent section"
echo " 2. Set \"default_agent\" back to \"build\" in opencode.jsonc"
echo " 3. Remove the 'opencode-agents' entry from your plugins directory"
```

- [ ] **Step 4: Make scripts executable**

Run (via Git Bash or WSL):

```bash
chmod +x install.sh uninstall.sh
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add install/uninstall scripts (Ralph-inspired one-command setup)"
```

---

### Task 9: README

**Files:**
- Create: `D:\GIT\Opencode Agents\README.md`

- [ ] **Step 1: Create README.md**

```markdown
# OpenCode Agents

Multi-agent orchestration plugin for OpenCode — Brain dispatches Planner/Coding/Tester in a plan-first, validator-gated execution loop.

## Agents

| Agent | Role | Mode |
|-------|------|------|
| **Brain** | Master scheduler — receives user commands, dispatches sub-agents | Primary |
| **Planner** | Understands requirements, outputs structured step-by-step plans | Sub-agent |
| **Coding** | Executes coding tasks, writes/modifies files in workspace | Sub-agent |
| **Tester** | Full quality check — lint, typecheck, build, test suite | Sub-agent |

## Flow

```
User → Brain
  Brain → Planner (plan generation)
  Planner → Brain (structured plan)
  For each step:
    Brain → Coding (implement)
    Coding → Brain (files + summary)
    Brain → Tester (verify)
    Tester → Brain (pass/fail)
    Pass → next step | Fail → retry (max 3x)
  Brain → User (completion report)
```

## Quick Install

```bash
git clone https://github.com/KarasawaYikiho/Opencode-Agents.git
cd Opencode-Agents

# Windows
.\install.ps1

# Linux/macOS
./install.sh
```

Then manually merge the agent definitions from `opencode.jsonc` into your `~/.config/opencode/opencode.jsonc` and set `"default_agent": "brain"`.

## Uninstall

```bash
./uninstall.sh
```

Then remove agent blocks and restore `default_agent` to `"build"`.

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

- `index.ts` — Plugin entry point, registers hooks
- `src/agents/*.prompt.md` — Agent system prompts (orchestration logic + behavior)
- `src/hooks/retry-guard.ts` — Enforces max retry limit (default: 3)
- `src/hooks/state-tracker.ts` — Persists orchestration state to disk
- `src/types.ts` — Shared TypeScript interfaces

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README with architecture overview and install instructions"
```

---

### Task 10: Final Verification & Push

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests PASS.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Compiles successfully, dist/index.js and dist/types.d.ts present.

- [ ] **Step 4: Verify dist output**

Run: `ls dist/`

Expected: `index.js`, `index.d.ts`, `types.js`, `types.d.ts`, `hooks/` directory.

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build succeeds"
git push origin main
```

---

## Verification Checklist

| # | Check | Command |
|---|-------|---------|
| 1 | All tests pass | `npx vitest run` |
| 2 | TypeScript compiles | `npx tsc --noEmit` |
| 3 | Build produces dist/ | `npm run build` |
| 4 | All 4 prompt files exist | `ls src/agents/` |
| 5 | opencode.jsonc is valid JSON | manual check |
| 6 | Plugin exports correct shape | covered by index.test.ts |
| 7 | RetryGuard enforces limit | covered by retry-guard.test.ts |
| 8 | StateTracker persists/loads | covered by state-tracker.test.ts |
