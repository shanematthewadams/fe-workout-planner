import { isStaging } from "./environment";

export function StagingNotice() {
  return isStaging() ? (
    <aside className="staging-notice no-print" aria-label="Staging version">
      <strong>Staging · test version</strong>
      <span>Small-group pilot · F3 The FE</span>
    </aside>
  ) : null;
}
