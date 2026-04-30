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
