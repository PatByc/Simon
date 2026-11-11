import { useEffect, useState } from "react";
import type {
  Conversation,
  EngineeringCapabilities,
  EngineeringDiagnostics,
  EngineeringInventory,
  EngineeringSearchResponse,
  EngineeringSnapshot,
  EngineeringStatus,
  ProjectBinding,
  TiaProcess,
} from "@simon/contracts";
import {
  attachEngineeringProcess,
  detachEngineeringProcess,
  getEngineeringCapabilities,
  getEngineeringDiagnostics,
  getEngineeringInventory,
  getEngineeringSnapshot,
  getEngineeringStatus,
  listEngineeringProcesses,
  refreshEngineeringSnapshot,
  searchEngineeringSnapshot,
} from "./api.js";

interface EngineeringContextPanelProps {
  conversation: Conversation;
  onBindingChange: (binding: ProjectBinding | null) => void;
}

function formatObserved(value: string): string {
  return new Date(value).toLocaleString();
}

export function EngineeringContextPanel({ conversation, onBindingChange }: EngineeringContextPanelProps) {
  const [status, setStatus] = useState<EngineeringStatus | null>(null);
  const [processes, setProcesses] = useState<TiaProcess[]>([]);
  const [capabilities, setCapabilities] = useState<EngineeringCapabilities | null>(null);
  const [diagnostics, setDiagnostics] = useState<EngineeringDiagnostics | null>(null);
  const [inventory, setInventory] = useState<EngineeringInventory | null>(null);
  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<EngineeringSearchResponse | null>(null);
  const [selectedProcess, setSelectedProcess] = useState("");
  const [busy, setBusy] = useState<"discover" | "attach" | "detach" | "inventory" | "snapshot" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [nextStatus, nextCapabilities, nextDiagnostics, nextSnapshot] = await Promise.all([
      getEngineeringStatus(conversation.conversationId),
      getEngineeringCapabilities(),
      getEngineeringDiagnostics(),
      getEngineeringSnapshot(conversation.conversationId),
    ]);
    setStatus(nextStatus);
    setCapabilities(nextCapabilities);
    setDiagnostics(nextDiagnostics);
    setSnapshot(nextSnapshot);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getEngineeringStatus(conversation.conversationId),
      getEngineeringCapabilities(),
      getEngineeringDiagnostics(),
      getEngineeringSnapshot(conversation.conversationId),
    ]).then(([nextStatus, nextCapabilities, nextDiagnostics, nextSnapshot]) => {
      if (cancelled) return;
      setStatus(nextStatus);
      setCapabilities(nextCapabilities);
      setDiagnostics(nextDiagnostics);
      setSnapshot(nextSnapshot);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load engineering context");
    });
    return () => { cancelled = true; };
  }, [conversation.conversationId, conversation.projectBinding?.epoch]);

  const discover = async () => {
    setBusy("discover");
    setError(null);
    try {
      const discovered = await listEngineeringProcesses();
      setProcesses(discovered);
      const saved = conversation.projectBinding;
      const matching = saved && discovered.find((process) =>
        process.processId === saved.processId && process.processStartTime === saved.processStartTime);
      const firstEligible = discovered.find((process) => process.hasProject);
      setSelectedProcess(matching
        ? `${matching.processId}|${matching.processStartTime}`
        : firstEligible
          ? `${firstEligible.processId}|${firstEligible.processStartTime}`
          : "");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to discover TIA processes");
    } finally {
      setBusy(null);
    }
  };

  const attach = async () => {
    const [processId, processStartTime] = selectedProcess.split("|");
    if (!processId || !processStartTime) return;
    setBusy("attach");
    setError(null);
    try {
      const binding = await attachEngineeringProcess(conversation.conversationId, {
        processId: Number(processId),
        processStartTime,
      });
      onBindingChange(binding);
      setInventory(null);
      setSearchResult(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to attach to TIA Portal");
    } finally {
      setBusy(null);
    }
  };

  const detach = async () => {
    setBusy("detach");
    setError(null);
    try {
      await detachEngineeringProcess();
      setInventory(null);
      setSnapshot(null);
      setSearchResult(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disconnect Simon from TIA Portal");
    } finally {
      setBusy(null);
    }
  };

  const inspectInventory = async () => {
    setBusy("inventory");
    setError(null);
    try {
      setInventory(await getEngineeringInventory(conversation.conversationId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to retrieve project inventory");
    } finally {
      setBusy(null);
    }
  };

  const refreshSnapshot = async () => {
    setBusy("snapshot");
    setError(null);
    try {
      setSnapshot(await refreshEngineeringSnapshot(conversation.conversationId, true));
      setSearchResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh engineering snapshot");
    } finally {
      setBusy(null);
    }
  };

  const searchSnapshot = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setBusy("search");
    setError(null);
    try {
      setSearchResult(await searchEngineeringSnapshot(conversation.conversationId, query));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search engineering snapshot");
    } finally {
      setBusy(null);
    }
  };

  if (!status) return <div className="engineering-panel is-loading">Loading engineering context…</div>;

  if (status.mode === "synthetic") {
    return (
      <section className="engineering-panel is-disabled" aria-label="Engineering context">
        <div className="engineering-panel-head">
          <div><span className="engineering-kicker">Engineering context</span><strong>Synthetic mode</strong></div>
          <span className="engineering-state">Disabled</span>
        </div>
        <p>TIA integration is not started. Relaunch Simon with <code>-EngineeringMode tia-readonly</code> to enable explicit read-only attachment.</p>
      </section>
    );
  }

  const connected = status.state === "connected" && status.conversationBindingMatches && status.binding;
  const qualifiedCount = capabilities?.capabilities.filter((item) => item.status === "live-tested").length ?? 0;
  const availableCount = capabilities?.capabilities.filter((item) => item.available).length ?? 0;

  return (
    <section className={`engineering-panel is-${status.state}`} aria-label="Engineering context">
      <div className="engineering-panel-head">
        <div>
          <span className="engineering-kicker">Engineering context</span>
          <strong>{connected ? status.binding?.projectName : "TIA Portal V20"}</strong>
        </div>
        <span className="engineering-state"><i aria-hidden="true" />{connected ? "Read only" : status.state.replace("-", " ")}</span>
      </div>

      {connected ? (
        <>
          <dl className="engineering-binding-grid">
            <div><dt>Project</dt><dd>{status.binding?.projectName}</dd></div>
            <div><dt>Process</dt><dd>PID {status.binding?.processId}</dd></div>
            <div><dt>Observed</dt><dd>{status.binding ? formatObserved(status.binding.observedAt) : "—"}</dd></div>
            <div><dt>Binding</dt><dd><code>{status.binding?.bindingId.slice(0, 8)}</code></dd></div>
          </dl>
          <div className="engineering-actions">
            <button type="button" onClick={inspectInventory} disabled={busy !== null}>
              {busy === "inventory" ? "Reading inventory…" : "Inspect inventory"}
            </button>
            <button type="button" className="quiet" onClick={detach} disabled={busy !== null}>
              {busy === "detach" ? "Disconnecting…" : "Disconnect Simon"}
            </button>
          </div>
          <p className="engineering-assurance">Disconnecting releases Simon's Openness attachment. It does not close TIA Portal or the engineer's project.</p>

          <div className="engineering-snapshot-card">
            <div className="engineering-snapshot-head">
              <div>
                <span>Retrieval snapshot</span>
                <strong>{snapshot ? `${snapshot.documentCount} documents · ${snapshot.objectCount} objects` : "Not created"}</strong>
              </div>
              <span className={`engineering-freshness is-${snapshot?.freshness ?? "missing"}`}>
                {snapshot ? snapshot.freshness : "missing"}
              </span>
            </div>
            {snapshot ? (
              <>
                <div className="engineering-snapshot-meta">
                  <span>Observed {formatObserved(snapshot.updatedAt)}</span>
                  <span>{snapshot.byteCount.toLocaleString()} bytes indexed</span>
                  <span>{snapshot.coverage.filter((item) => item.state !== "complete").length} coverage limits</span>
                </div>
                {snapshot.coverage.some((item) => item.state !== "complete") && (
                  <details className="engineering-snapshot-coverage">
                    <summary>Coverage notes</summary>
                    <ul>
                      {snapshot.coverage.filter((item) => item.state !== "complete").map((item, index) => (
                        <li key={`${item.capability}-${index}`}><strong>{item.state}</strong> · {item.note}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p className="engineering-snapshot-empty">Create a bounded local snapshot before asking Simon to search project sources, tags, or references.</p>
            )}
            <div className="engineering-actions">
              <button type="button" onClick={refreshSnapshot} disabled={busy !== null}>
                {busy === "snapshot" ? "Refreshing snapshot…" : snapshot ? "Refresh snapshot" : "Create snapshot"}
              </button>
            </div>

            <form className="engineering-search" onSubmit={(event) => { event.preventDefault(); void searchSnapshot(); }}>
              <label htmlFor={`engineering-search-${conversation.conversationId}`}>Search current snapshot</label>
              <div>
                <input
                  id={`engineering-search-${conversation.conversationId}`}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Exact path, tag, address, or phrase"
                  disabled={!snapshot || snapshot.freshness !== "current" || busy !== null}
                />
                <button type="submit" disabled={!snapshot || !searchQuery.trim() || busy !== null}>
                  {busy === "search" ? "Searching…" : "Search"}
                </button>
              </div>
            </form>

            {searchResult && (
              <div className="engineering-results" aria-live="polite">
                <div className="engineering-results-head">
                  <strong>{searchResult.hits.length} result{searchResult.hits.length === 1 ? "" : "s"}</strong>
                  <span>{searchResult.partial ? "Partial coverage" : "Current snapshot"}</span>
                </div>
                {searchResult.hits.length ? (
                  <ol>
                    {searchResult.hits.slice(0, 6).map((hit) => (
                      <li key={hit.citation.citationId}>
                        <div><span>{hit.document.kind}</span><strong>{hit.document.name}</strong></div>
                        <p>{hit.snippet}</p>
                        <code>{hit.citation.engineeringPath}</code>
                        <small>{hit.matchKind.replaceAll("-", " ")} · {hit.citation.coverage}</small>
                      </li>
                    ))}
                  </ol>
                ) : <p className="engineering-snapshot-empty">No exact or lexical match was found in this snapshot.</p>}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {conversation.projectBinding && (
            <p className="engineering-reconnect">This conversation remembers <strong>{conversation.projectBinding.projectName}</strong>, but explicit reconnection is required.</p>
          )}
          <div className="engineering-actions">
            <button type="button" onClick={discover} disabled={busy !== null}>
              {busy === "discover" ? "Discovering…" : processes.length ? "Refresh processes" : "Discover TIA processes"}
            </button>
          </div>
          {processes.length > 0 && (
            <div className="engineering-process-picker">
              <label>
                <span>Attachable process</span>
                <select value={selectedProcess} onChange={(event) => setSelectedProcess(event.target.value)}>
                  <option value="">Select a process</option>
                  {processes.map((process) => (
                    <option
                      key={`${process.processId}-${process.processStartTime}`}
                      value={`${process.processId}|${process.processStartTime}`}
                      disabled={!process.hasProject}
                    >
                      PID {process.processId} · {process.hasProject ? "open project" : "no project"} · {formatObserved(process.acquisitionTime)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={attach} disabled={!selectedProcess || busy !== null}>
                {busy === "attach" ? "Connecting…" : "Connect read only"}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="engineering-error" role="alert">{error}</p>}
      {status.reason && !error && <p className="engineering-error" role="status">{status.reason}</p>}

      <div className="engineering-coverage">
        <div><span>Model tools</span><strong>{availableCount}</strong></div>
        <div><span>Live-qualified</span><strong>{qualifiedCount}</strong></div>
        <div><span>Mutations</span><strong>0</strong></div>
      </div>

      {inventory && (
        <details className="engineering-inventory">
          <summary>Bounded project inventory</summary>
          <ul>{inventory.coverage.map((note) => <li key={note}>{note}</li>)}</ul>
          <pre>{inventory.projectTree}</pre>
        </details>
      )}

      {diagnostics && (
        <small className="engineering-diagnostics">
          Pi SDK {diagnostics.piPackageVersion} · MCP {diagnostics.mcpPackageVersion} · TIA {diagnostics.tiaMajorVersion ?? "off"}
        </small>
      )}
    </section>
  );
}
