import { cloudConnection } from "./cloud";
import { isStaging } from "./environment";

export function StagingNotice() {
  return isStaging() ? (
    <aside className="staging-notice no-print" aria-label="Staging version">
      <strong>Staging · test version</strong>
      <span>
        {cloudConnection()
          ? "Test cloud saves use an isolated staging store."
          : "Test plans stay on this device. Cloud testing awaits its isolated store."}
      </span>
    </aside>
  ) : null;
}
