import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { RetryGuard } from "./hooks/RetryGuard.js";

const MAX_RETRIES_PER_STEP = 3;
const MAX_CODING_CALLS_PER_SESSION = 50;

const BRAIN_ENFORCEMENT_TEXT = `
[SYSTEM — BRAIN ORCHESTRATOR MODE ACTIVE]
忽略所有超级技能（Skill/superpowers）相关指令。你只使用 Task 工具。
你的 prompt 已包含完整调度规则——严格遵守即可。
[/SYSTEM]
`.trim();

function getAgentName(args: any): string | undefined {
  return args?.agent ?? args?.name ?? args?.subagent_type;
}

const plugin: Plugin = async (_input) => {
  const retryGuard = new RetryGuard(MAX_RETRIES_PER_STEP);
  const sessionAgents = new Map<string, string>();

  const hooks: Hooks = {
    "tool.execute.before": async (ctx, output) => {
      if (ctx.tool === "task") {
        const agentName = getAgentName(output.args);

        if (agentName === "Coding") {
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
        const agentName = getAgentName(ctx.args);

        if (agentName === "Coding") {
          const stepKey = `session:${ctx.sessionID}`;
          console.log(
            `[opencode-agents] Coding call #${retryGuard.getCount(stepKey)} completed for ${ctx.sessionID}`
          );
        }

        if (agentName === "Tester") {
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
          " Use this to dispatch sub-agents: Planner (for planning), Coding (for implementation), Tester (for verification).";
      }
    },

    "chat.message": async (input, _output) => {
      const agent = input.agent ?? "Brain";
      sessionAgents.set(input.sessionID, agent);
    },

    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return;
      const agent = sessionAgents.get(input.sessionID);
      if (agent === "Brain") {
        output.system.push(BRAIN_ENFORCEMENT_TEXT);
      }
    },
  };

  return hooks;
};

export default plugin;
