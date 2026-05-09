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

Then manually merge the agent definitions from `opencode.jsonc` into your `~/.config/opencode/opencode.jsonc` and set `"default_agent": "Brain"`.

## Uninstall

```bash
# Windows
.\uninstall.ps1

# Linux/macOS
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
- `src/agents/*.md` — Agent system prompts (orchestration logic + behavior)
- `src/hooks/RetryGuard.ts` — Enforces max retry limit (default: 3)
- `src/hooks/StateTracker.ts` — Persists orchestration state to disk
- `src/Types.ts` — Shared TypeScript interfaces

## License

MIT
