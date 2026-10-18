import { isStaging } from "./environment";

export function StagingNotice() {
  return isStaging() ? (
    <aside className="staging-notice no-print" aria-label="Staging version">
      <strong>Staging · test version</strong>
      <span>
        Workouts saved here stay in this browser. Cloud sync is disabled.
      </span>
    </aside>
  ) : null;
}
