import { cloudConnection } from "./cloud";
import { isStaging } from "./environment";

export function StagingNotice() {
  return isStaging() ? (
    <aside className="staging-notice no-print" aria-label="Staging version">
      <strong>Staging · test version</strong>
      <span>
        {cloudConnection()
          ? "Connect devices to see your saved workouts on your phone and computer."
          : "Test plans stay on this device until cloud saving is configured."}
      </span>
    </aside>
  ) : null;
}
