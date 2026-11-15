import { useEffect, useId, useState } from "react";
import type { ConventionHistoryResponse, ConventionReadStatusResponse, ConventionReadSummary } from "@simon/contracts";

import { getConventionHistory, getConventionStatus } from "./api.js";

const groups: readonly { key: keyof ConventionReadStatusResponse; label: string }[] = [
  { key: "proposed", label: "Proposed · inactive" },
  { key: "active", label: "Approved · active" },
  { key: "rejected", label: "Rejected · historical" },
  { key: "retired", label: "Retired · historical" },
];

function stateDescription(summary: ConventionReadSummary): string {
  if (summary.state === "proposed") return "Inferred pattern only. It is not approved guidance.";
  if (summary.state === "rejected") return "Engineer-rejected history. It cannot guide Simon.";
  if (summary.state === "approved") return "Engineer-approved local practice. It is not a Siemens requirement.";
  return "Historical revision. It is not active guidance.";
}

export function ConventionEvidencePanel() {
  const detailId = useId();
  const [status, setStatus] = useState<ConventionReadStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(true);
  const [selected, setSelected] = useState<ConventionReadSummary | null>(null);
  const [history, setHistory] = useState<ConventionHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  const loadStatus = async () => {
    setStatusBusy(true); setStatusError(null);
    try { setStatus(await getConventionStatus()); }
    catch (cause) { setStatusError(cause instanceof Error ? cause.message : "Unable to load convention evidence"); }
    finally { setStatusBusy(false); }
  };

  useEffect(() => { void loadStatus(); }, []);

  const inspect = async (summary: ConventionReadSummary) => {
    if (selected?.conventionId === summary.conventionId) { setSelected(null); setHistory(null); setHistoryError(null); return; }
    setSelected(summary); setHistory(null); setHistoryError(null); setHistoryBusy(true);
    try { setHistory(await getConventionHistory(summary.conventionId)); }
    catch (cause) { setHistoryError(cause instanceof Error ? cause.message : "Convention history is unavailable"); }
    finally { setHistoryBusy(false); }
  };

  const counts = status ? [status.proposed.length, status.active.length, status.rejected.length, status.retired.length] : [0, 0, 0, 0];
  const total = counts.reduce((sum, count) => sum + count, 0);
  const primary = history ? history.revisions.at(-1) ?? history.draft : null;

  return (
    <section className="engineering-panel convention-panel" aria-label="Convention evidence">
      <div className="engineering-panel-head">
        <div><span className="engineering-kicker">Convention evidence</span><strong>Local practice register</strong></div>
        <span className="engineering-state"><i />{statusBusy ? "Loading" : `${status?.active.length ?? 0} active`}</span>
      </div>
      <p>Read-only evidence. Inferred patterns remain inactive; only immutable engineer-approved revisions may guide local-practice answers.</p>

      {status && <div className="convention-counts" aria-label="Convention state counts">
        {groups.map((group, index) => <div key={group.key}><span>{group.label.split(" · ")[0]}</span><strong>{counts[index]}</strong></div>)}
      </div>}

      <div className="convention-authority-key" aria-label="Convention authority legend">
        <span className="is-inferred">Inferred convention</span><span className="is-approved">Approved convention</span>
      </div>

      {statusBusy && !status && <p className="convention-empty" role="status">Loading convention evidence…</p>}
      {statusError && <div className="engineering-error" role="alert"><p>{statusError}</p><button type="button" onClick={() => void loadStatus()}>Retry convention evidence</button></div>}
      {status && total === 0 && <p className="convention-empty">No convention drafts or revisions are recorded. Simon has no approved local-practice guidance.</p>}

      {status && total > 0 && <div className="convention-groups">
        {groups.map((group) => status[group.key].length > 0 && <section key={group.key} aria-labelledby={`${detailId}-${group.key}`}>
          <h3 id={`${detailId}-${group.key}`}>{group.label}</h3>
          <ul>{status[group.key].map((summary) => {
            const expanded = selected?.conventionId === summary.conventionId;
            return <li key={summary.conventionId} className={`is-${summary.state}`}>
              <button type="button" onClick={() => void inspect(summary)} aria-expanded={expanded} aria-controls={expanded ? detailId : undefined}>
                <span><small>{summary.authority.replace("-", " ")}</small><strong>{summary.title}</strong></span>
                <span className="convention-state-mark">{summary.state}</span>
              </button>
              <p>{stateDescription(summary)}</p>
              <dl><div><dt>Scope</dt><dd>{summary.scope.join(" · ")}</dd></div><div><dt>Evidence</dt><dd>{summary.evidenceCount}</dd></div><div><dt>Exceptions</dt><dd>{summary.exceptionCount}</dd></div>{summary.latestRevision && <div><dt>Revision</dt><dd>{summary.latestRevision}</dd></div>}</dl>
              {expanded && <div id={detailId} className="convention-history" aria-live="polite">
                {historyBusy && <p role="status">Loading immutable history…</p>}
                {historyError && <p className="engineering-error" role="alert">History unavailable: {historyError}. Summary evidence remains visible.</p>}
                {history && primary && <>
                  <div className="convention-rule"><span>{history.draft && history.revisions.length === 0 ? "Inferred rule" : "Recorded rule"}</span><strong>{primary.rule}</strong><p>{primary.rationale}</p></div>
                  <div className="convention-history-grid"><div><span>Convention ID</span><code>{history.conventionId}</code></div>{"revisionId" in primary && <div><span>Immutable revision</span><code>{primary.revisionId}</code></div>}<div><span>Authority</span><strong>{summary.authority}</strong></div><div><span>State</span><strong>{summary.state}</strong></div></div>
                  <div className="convention-detail-block"><h4>Representative evidence</h4><ul>{primary.evidence.map((evidence) => <li key={evidence.evidenceId}><code>{evidence.citation}</code><span>{evidence.excerpt}</span></li>)}</ul></div>
                  <div className="convention-detail-block"><h4>Exceptions</h4>{primary.exceptions.length > 0 ? <ul>{primary.exceptions.map((exception) => <li key={exception}>{exception}</li>)}</ul> : <p>No recorded exceptions.</p>}</div>
                  <div className="convention-detail-block"><h4>Decision history</h4>{history.decisions.length > 0 ? <ol>{history.decisions.map((decision) => <li key={decision.decisionId}><strong>{decision.action}</strong><span>{decision.decidedBy} · <time dateTime={decision.decidedAt}>{decision.decidedAt}</time></span><p>{decision.note}</p></li>)}</ol> : <p>No engineer decision is recorded; this remains an inactive proposal.</p>}</div>
                  {history.revisions.length > 0 && <div className="convention-detail-block"><h4>Revision chain</h4><ol>{history.revisions.map((revision) => <li key={revision.revisionId}><strong>Revision {revision.revision} · {revision.state}</strong><code>{revision.revisionId}</code>{revision.supersedesRevisionId && <span>Supersedes {revision.supersedesRevisionId}</span>}</li>)}</ol></div>}
                </>}
              </div>}
            </li>;
          })}</ul>
        </section>)}
      </div>}
    </section>
  );
}
