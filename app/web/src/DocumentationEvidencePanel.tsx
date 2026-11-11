import { useEffect, useState } from "react";
import type { DocumentationSearchResponse, DocumentationStatusResponse, DocumentationTarget } from "@simon/contracts";

import { getDocumentationStatus, searchDocumentation } from "./api.js";

const emptyTarget: DocumentationTarget = {
  product: null, version: null, update: null, cpuFamily: null, firmware: null, language: null, locale: null,
};

export function DocumentationEvidencePanel() {
  const [status, setStatus] = useState<DocumentationStatusResponse | null>(null);
  const [target, setTarget] = useState<DocumentationTarget>(emptyTarget);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<DocumentationSearchResponse | null>(null);
  const [allowAdjacent, setAllowAdjacent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDocumentationStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      const preferred = next.sources.find((source) => source.state === "ready" || source.state === "partial");
      if (preferred) setTarget((current) => ({ ...current, product: preferred.product, version: preferred.version, update: preferred.update, locale: preferred.locale }));
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load documentation status"); });
    return () => { cancelled = true; };
  }, []);

  const setField = (field: keyof DocumentationTarget, value: string) => setTarget((current) => ({ ...current, [field]: value.trim() || null }));
  const search = async () => {
    if (!query.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try { setResult(await searchDocumentation({ query: query.trim(), target, allowAdjacent })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Documentation search failed"); }
    finally { setBusy(false); }
  };

  return (
    <section className="engineering-panel documentation-panel" aria-label="Documentation evidence">
      <div className="engineering-panel-head">
        <div><span className="engineering-kicker">Documentation evidence</span><strong>Version-aware Siemens guidance</strong></div>
        <span className="engineering-state"><i />{status ? `${status.topicCount} topics` : "Loading"}</span>
      </div>
      <p>Installed help stays local. Online ingestion is rights-blocked; results remain source- and applicability-labelled.</p>
      {status && (
        <div className="engineering-coverage" aria-label="Documentation source status">
          <div><span>Current sources</span><strong>{status.currentSourceCount}</strong></div>
          <div><span>Blocked sources</span><strong>{status.blockedSourceCount}</strong></div>
          <div><span>Coverage</span><strong>{status.partial ? "Partial" : "Ready"}</strong></div>
        </div>
      )}
      {status?.sources.map((source) => (
        <div className="documentation-source" key={source.sourceId}>
          <div><strong>{source.title}</strong><span className={`engineering-freshness is-${source.state === "ready" ? "current" : "stale"}`}>{source.state}</span></div>
          <small>{[source.product, source.version, source.update, source.locale].filter(Boolean).join(" · ")} · {source.rightsStatus}</small>
          <p>{source.statusNote}</p>
        </div>
      ))}
      <div className="documentation-target" aria-label="Documentation target context">
        {(["product", "version", "update", "cpuFamily", "firmware", "language", "locale"] as const).map((field) => (
          <label key={field}><span>{field.replace(/([A-Z])/g, " $1")}</span><input value={target[field] ?? ""} onChange={(event) => setField(field, event.target.value)} placeholder="Unknown" /></label>
        ))}
      </div>
      <label className="documentation-adjacent"><input type="checkbox" checked={allowAdjacent} onChange={(event) => setAllowAdjacent(event.target.checked)} /> Allow labelled adjacent-version background</label>
      <div className="engineering-search">
        <label htmlFor="documentation-search">Search indexed documentation</label>
        <div><input id="documentation-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Instruction, topic, or phrase" disabled={busy} /><button type="button" onClick={() => void search()} disabled={busy || !query.trim()}>{busy ? "Searching…" : "Search"}</button></div>
      </div>
      {error && <p className="engineering-error" role="alert">{error}</p>}
      {result && (
        <div className="engineering-results" aria-live="polite">
          <div className="engineering-results-head"><strong>{result.hits.length} evidence result{result.hits.length === 1 ? "" : "s"}</strong><span>{result.partial ? "Partial source set" : "Current source set"}</span></div>
          {result.hits.length === 0 ? <p>No applicable documentation evidence found.</p> : <ol>{result.hits.map((hit) => (
            <li key={hit.citation.citationId}>
              <div><span>{hit.matchKind}</span><strong>{hit.topic.title}</strong></div>
              <p>{hit.snippet}</p>
              <code>{hit.source.title} · {hit.topic.stableKey}</code>
              <small>{[hit.citation.product, hit.citation.version, hit.citation.update, hit.citation.locale].filter(Boolean).join(" · ")} · {hit.applicability.state}</small>
              <details><summary>Applicability evidence</summary><ul>{hit.applicability.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>
            </li>
          ))}</ol>}
        </div>
      )}
    </section>
  );
}
