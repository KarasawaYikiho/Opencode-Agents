# Multi-Agent Orchestration System for OpenCode — Design Spec

**Date:** 2026-04-30  
**Status:** Approved  
**Implementation:** OpenCode Plugin (Approach 1 — Plugin + Prompt-Driven Orchestration)  

---

## 1. Overview

A multi-agent collaborative system integrated into OpenCode. Users interact with a single primary agent (**Brain**) which dispatches work to specialized sub-agents (**Planner**, **Coding**, **Tester**). The system follows a plan-first, validator-gated execution loop with automatic retry and context management.

**Ralph Integration:** Design patterns borrowed from [Ralph](https://github.com/BearstOzawa/ralph) (plan-first orchestration, validator-gated completion, one-command installation). Installation mechanism follows Ralph's setup script pattern.

---

## 2. Agents

### 2.1 Brain (Primary Agent)
- **Role:** Master scheduler. Receives user commands, dispatches sub-agents, manages workflow.
- **Mode:** `primary` (set as `default_agent`)
- **Temperature:** 0.3
- **Permissions:** `task` (required to spawn sub-agents). No file read/write permissions.
- **Key Rule:** Never reads or writes files. File paths passed as descriptions between agents.
- **Prompt:** `src/agents/brain.prompt.md`

### 2.2 Planner (Sub-agent)
- **Role:** Understands user's natural language commands, produces structured multi-agent execution plans.
- **Mode:** `subagent`
- **Temperature:** 0.5
- **Prompt:** `src/agents/planner.prompt.md`

### 2.3 Coding (Sub-agent)
- **Role:** Executes coding tasks received from Brain. Writes/modifies files in shared workspace.
- **Mode:** `subagent`
- **Temperature:** 0.2
- **Prompt:** `src/agents/coding.prompt.md`

### 2.4 Tester (Sub-agent)
- **Role:** Full quality check on Coding's output: lint, typecheck, build, test suite.
- **Mode:** `subagent`
- **Temperature:** 0.1
- **Prompt:** `src/agents/tester.prompt.md`

---

## 3. Orchestration Flow

```
User → Brain (primary agent)
  │
  ├─[Phase 1: Plan]─────────────────────────────────────
  │ Brain ──Task("planner")──→ Planner
  │ Planner → Brain [structured Markdown plan]
  │
  ├─[Phase 2: Execute (loop per step)]─────────────────
  │ For each step in plan:
  │   attempt = 0
  │   ┌─ LOOP ────────────────────────────────────
  │   │ attempt++
  │   │
  │   │ IF attempt == 1:
  │   │   Brain ──Task("coding")──→ Coding (NEW session)
  │   │ ELSE:
  │   │   Brain ──Task("coding", task_id)──→ Coding (RESUME session)
  │   │
  │   │ Coding → Brain [file paths + change summary]
  │   │
  │   │ Brain ──Task("tester")──→ Tester (ALWAYS new session)
  │   │ Tester → Brain [PASS | FAIL + details]
  │   │
  │   │ IF PASS → step complete, BREAK LOOP
  │   │ IF FAIL + attempt < 3 → continue LOOP (same task_id)
  │   │ IF FAIL + attempt >= 3 → report to user, HALT
  │   └──────────────────────────────────────────
  │
  ├─[Phase 3: Done]────────────────────────────────────
  └─ Brain reports completion summary to user
```

### Context Management
- **New step:** Coding and Tester are created fresh (no task_id) — clears context.
- **Retry (same step):** Coding uses the same `task_id` to resume session — preserves fix context.
- **Tester:** Always created fresh for each verification — no stale state.

### Retry Limit
- Maximum 3 retries per step.
- On 3rd failure, Brain halts the entire workflow and reports to user:
  - Which step failed
  - Each attempt's Tester feedback
  - Suggested direction for human intervention

---

## 4. Plan Format (Planner Output)

Planner outputs Markdown in the following structure. Brain parses and directly forwards to Coding/Tester without transformation.

```markdown
## Plan: [Task Title]

### Overview
[One-sentence task objective]

### Steps

#### Step 1: [Step Title]
- **Description**: [What Coding needs to do]
- **Involved Files**: [Expected file paths to create/modify]
- **Verification Standard**: [How Tester should verify — lint/tests/functional]

#### Step 2: [Step Title]
- **Description**: ...
- **Involved Files**: ...
- **Verification Standard**: ...

### Dependencies
- [Inter-step dependencies if any]
```

---

## 5. Communication Protocol

### Brain → Coding (Task prompt template)

```
Task: [Step Title]

Description: [Task description from plan]

Involved Files:
  - [path]  (create|modify)
  - [path]  (create|modify)

Verification Standard: [from plan]

Return: file paths + change summary. Do NOT return file contents.
```

### Brain → Tester (Task prompt template)

```
Verify the following coding result:

Step: [Step Title]

Files to check:
  - [path] (created)
  - [path] (modified)

Verification Standard: [from plan]

Workdir: [current workspace path]

Run full quality check (lint, typecheck, build, test).
Return: RESULT (pass/fail), SUMMARY, DETAILS, FAIL_REASON (if fail).
```

### Coding → Brain (Response format)
```
FILES:
  - src/foo.ts (created)
  - src/bar.ts (modified)

SUMMARY: [What was done and why]
```

### Tester → Brain (Response format)
```
RESULT: pass | fail
SUMMARY: [One-sentence result]
DETAILS:
  - [check item]: ✅/❌ [detail]
  - [check item]: ✅/❌ [detail]
  - [check item]: N/A [reason if not applicable]
FAIL_REASON: [If fail, concise reason + fix suggestion]
```

---

## 6. Agent Prompt Specifications

### 6.1 brain.prompt.md

```
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
```

### 6.2 planner.prompt.md

```
你是 Planner Agent。你会收到来自 Brain 的用户原始指令。

你的任务：
1. 理解用户的自然语言需求
2. 将需求拆解为适合多Agent并行协同的步骤
3. 每个步骤是独立的、可验证的编码单元
4. 输出标准Markdown格式（含Overview、Steps、Dependencies）

原则：
- 步骤粒度适中：每步Coding可在单个会话完成
- 每步必须包含验证标准，Tester才能自动验证
- 明确标注涉及文件路径
- 有步骤依赖时显式声明
```

### 6.3 coding.prompt.md

```
你是 Coding Agent。你会从 Brain 收到一条明确的编码任务。

收到的任务包含：任务描述、涉及文件、验证标准

你的职责：
1. 根据任务描述编写/修改代码
2. 所有文件写入当前工作区
3. 完成后返回：文件路径列表 + 变更摘要（不返回文件内容）

原则：
- 遵守涉及文件列表，不越界修改无关文件
- 遵循项目已有代码风格和架构
- 不写测试文件（Tester负责验证）
- 不确定时做最小化假设并标注
```

### 6.4 tester.prompt.md

```
你是 Tester Agent。你会从 Brain 收到 Coding 的产出信息。

收到的信息包含：文件路径列表、验证标准、工作区路径

你的职责：
1. 自行读取所有涉及文件
2. 执行完整质量检查：Lint、Typecheck、Build、Test Suite
3. 返回结构化结果：RESULT(pass/fail)、SUMMARY、DETAILS、FAIL_REASON

原则：
- 自行检测项目测试框架和lint工具（读package.json/Makefile等）
- 某检查项不适用时标注N/A而非跳过
- 失败时提供精确修复建议供Coding使用
```

---

## 7. Plugin Architecture

### 7.1 Project Structure

```
D:\GIT\Opencode Agents/
├── package.json                 # npm package + @opencode-ai/plugin dependency
├── opencode.jsonc               # Agent definitions (4 agents + default brain)
├── opencode.plugin.json         # Plugin metadata (for OpenCode recognition)
├── index.ts                     # Plugin entry point
├── install.sh                   # Linux/Mac installer
├── install.ps1                  # Windows installer
├── uninstall.sh                 # Uninstaller
├── src/
│   ├── agents/
│   │   ├── brain.prompt.md
│   │   ├── planner.prompt.md
│   │   ├── coding.prompt.md
│   │   └── tester.prompt.md
│   └── hooks/
│       ├── retry-guard.ts       # Retry limit enforcement (code-level guard)
│       └── state-tracker.ts     # Tracks current step, task_id mappings
└── README.md
```

### 7.2 Plugin Entry (index.ts)

Responsibilities:
1. Load agent prompt files and register agent configurations
2. Install hooks:
   - `tool.execute.before` — intercept Task tool calls to enforce retry limits
   - `tool.execute.after` — track completed steps and task_id assignments
3. Merge agent configs into the runtime agent registry

### 7.3 retry-guard.ts (Hook)

Enforces the 3-retry cap at the code level:
- Maintains a per-step attempt counter
- When a Coding task is dispatched for the same step > 3 times with the same task_id, blocks the dispatch and triggers user notification
- Prevents LLM from bypassing the retry limit

### 7.4 state-tracker.ts (Hook)

Tracks orchestration state:
- Current plan step index
- Mapping of step → task_id (for retry resume)
- Mapping of step → attempt count
- Step completion flags

State persisted to `~/.config/opencode/plugins/opencode-agents/state.json` for cross-session resilience.

---

## 8. Installation & Distribution

### 8.1 One-command Install

```
npx @anthropic/opencode plugin install opencode-agents
```

Or local install:

```
opencode plugin install "D:\GIT\Opencode Agents"
```

### 8.2 What the Installer Does

1. Merge `opencode.jsonc` agent configs into user's `~/.config/opencode/opencode.jsonc`
2. Copy `src/agents/*.prompt.md` to `~/.config/opencode/agents/opencode-agents/`
3. Install npm dependencies (`@opencode-ai/plugin`)
4. Register plugin in `~/.config/opencode/plugins/`
5. Set `default_agent` to `brain`

### 8.3 Uninstall

```
opencode plugin uninstall opencode-agents
```
Restores `default_agent` to `build`, removes `brain/planner/coding/tester` agent config blocks.

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Planner returns unparseable plan | Brain asks Planner to reformat (max 1 retry), then reports to user |
| Coding fails (tool error, crash) | Counts as an attempt. Brain retries with same task_id |
| Tester cannot find test framework | Reports N/A for tests, still performs lint/typecheck/build |
| Tester fails with unclear reason | Brain asks Tester for more detail before sending to Coding |
| Step retry exceeds 3 | Brain halts, reports to user with full context |
| User interrupts mid-flow | Brain preserves state, can resume from last completed step |

---

## 10. Future Considerations (Out of Scope v1)

- Parallel execution of independent plan steps
- Plan approval/rejection gate before execution (Ralph pattern)
- Custom model selection per agent type
- Worktree isolation for parallel coding agents
- Integration with Ralph's GitHub Actions workflows for CI-triggered multi-agent runs
