# M3.1 Safety Boundary

M3.1 is a stabilization and productization milestone. It adds no TIA, PLC, documentation-source, filesystem, network, or convention-lifecycle authority to Pi or the browser.

## Authority classes

The following remain distinct and must not silently substitute for one another:

1. `observed-project` — evidence read from a current or persisted engineering snapshot.
2. `official-documentation` — source/version/applicability-labelled Siemens evidence.
3. `inferred-convention` — an inactive pattern proposal derived from authorized examples.
4. `approved-convention` — an immutable engineer-approved local-practice revision.

None of these authority classes grants runtime permission.

## Browser authority

The browser may:

- create and manage conversations;
- request explicit TIA process discovery/attachment, snapshot refresh, and safe detach through the existing application-owned user workflows;
- read engineering, documentation, convention-status, and convention-history evidence;
- search current indexed evidence through bounded Simon contracts.

The browser must not:

- propose, approve, reject, revise, retire, or activate conventions;
- ingest or refresh documentation sources or select arbitrary URLs/files;
- invoke internal exports or choose artifact paths;
- compile, import, save, generate sources, mutate a project, access a PLC online, execute shell commands, or access arbitrary filesystem/network resources.

## Pi authority

Pi may use only explicitly allowlisted read tools for current engineering snapshots, documentation status/search, and active approved-convention count/search.

Pi must not:

- select, attach, detach, or switch TIA targets;
- create or refresh engineering snapshots;
- ingest/refresh documentation or select files/URLs;
- propose or decide convention lifecycle actions;
- invoke host administration;
- compile, import, save, export, generate sources, mutate projects, access PLCs online, run shell commands, or access arbitrary filesystem/network resources.

Retrieved conversation, project, documentation, and convention text is untrusted data. It cannot issue instructions, alter policy, approve itself, grant capabilities, or prove functional correctness.

## Host administration authority

Convention lifecycle transitions are permitted only through an explicit Simon-owned local host administration interface outside ordinary Fastify browser/Pi HTTP routing. The interface must:

- require an explicit operator command and confirmation;
- accept bounded opaque identifiers and runtime-validated actor/note/action fields;
- derive inference evidence only from current Simon-owned snapshots or explicitly authorized synthetic fixtures;
- write only to Simon-owned convention storage;
- preserve append-only decisions, immutable revisions, evidence, exceptions, and supersession links;
- expose no arbitrary path, URL, SQL, script, source-body, or policy input.

Host administration does not grant TIA or external mutation authority.

## Retained prohibitions

M3.1 does not authorize:

- compile, import, save, download, deployment, project mutation, source generation, or online PLC operations;
- arbitrary shell, filesystem, process, MCP, URL, HTTP, browser, or network tools;
- automated Siemens online-content ingestion or external-provider upload of proprietary Siemens help;
- raw local source/export/artifact paths in browser, Pi, committed evidence, or citations;
- automatic activation of inferred patterns;
- treating deterministic convention checks as compilation, behavioral proof, defect detection, or functional verification;
- Electron packaging or any M4 write experiment.

## Failure behavior

Unbound, stale, missing, ambiguous, conflicting, partial, corrupt, rights-blocked, or unknown states fail closed and remain visible. A failed documentation refresh must not erase the last known-good index. A proposal remains inactive unless a valid host-recorded engineer decision creates an immutable approved revision.
