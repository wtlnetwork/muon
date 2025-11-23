import { findModuleExport } from "@decky/ui";

interface SleepManager {
  RegisterForNotifyResumeFromSuspend: (
    cb: () => void
  ) => { unregister: () => void };
  RegisterForNotifyRequestSuspend: (
    cb: () => void
  ) => { unregister: () => void };
}

export const sleepManager = findModuleExport(
  (exp) =>
    exp &&
    typeof exp === "object" &&
    typeof exp.RegisterForNotifyResumeFromSuspend === "function" &&
    typeof exp.RegisterForNotifyRequestSuspend === "function"
) as SleepManager | undefined;