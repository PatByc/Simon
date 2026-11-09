# Siemens TIA Portal Openness reference for Simon

> Local synthesis for coding agents. Start here, then consult the linked Siemens V20 pages and evidence notes for exact provenance. Nineteen official V20 topics were rendered and read directly from Siemens's JavaScript documentation site; see [`evidence/OFFICIAL_DOCS.md`](evidence/OFFICIAL_DOCS.md). This reference does not make Openness part of Simon's current chat-UI implementation scope; it supports future engineering integration work described in `docs/Simon_v0_3.md`.

## Scope and authority

This reference targets the locally installed **TIA Portal V20 PublicAPI** and Siemens's released English V20 Openness publication dated January 2025. Authority order:

1. Version-matched installed V20 public assemblies, XML API documentation, and XSDs for exact declarations.
2. Siemens V20 online documentation for supported workflows, prerequisites, and behavioral constraints.
3. Siemens V21 pages only when a V20 page is unavailable or a cross-version concept is explicitly identified.
4. Simon architecture and policy documents for product-specific restrictions; these are design decisions, not Siemens claims.

Do not infer V20 behavior from V21 examples without checking the installed V20 API. Do not use private TIA storage or private implementation assemblies as the integration contract.

## Installed baseline

The machine contains:

- `C:\Program Files\Siemens\Automation\Portal V20`
- PublicAPI generations V17, V18, V19, and V20
- V20 `Siemens.Engineering.dll`, XML API documentation, PLC XSDs, Add-In API, HMI API, and hardware parameter PDF

The inspected V20 assembly is `Siemens.Engineering` version `20.0.0.0`, file/product version `2000.7.201.2`, SHA-256 `94fa4550e591469842a38cd7a63625770787142607f71a9e0eec5907734c529f`. See [`evidence/LOCAL_ARTIFACTS.md`](evidence/LOCAL_ARTIFACTS.md).

## Core integration model

Openness is Siemens's supported .NET engineering API. A separate process can start TIA Portal with or without the UI or attach to a running process. The public API exposes projects and supported engineering objects through version-matched assemblies.

Key lifecycle declarations verified locally:

```csharp
using Siemens.Engineering;

using var tia = new TiaPortal(TiaPortalMode.WithUserInterface);
// or TiaPortalMode.WithoutUserInterface

IList<TiaPortalProcess> processes = TiaPortal.GetProcesses();
TiaPortal attached = processes[0].Attach();
```

The actual application must handle connection approval/security behavior, disposal, process disappearance, project state, and version matching. Never treat discovery of a process as permission to mutate it.

Siemens recommends resolving the public assemblies through application configuration in most cases. Its V20 documentation states that this route honors strong-name checks; the documented `AssemblyResolve` alternative requires careful early registration and does not provide the same modification detection. Openness has no compatibility mode: required option packages and HSPs used by a project must be installed.

Canonical Siemens V20 pages:

- [TIA Portal Openness API](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api)
- [Connecting to the TIA Portal](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/general-functions/connecting-to-the-tia-portal)
- [Requirements for TIA Portal Openness](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/basics/installation/requirements-for-tia-portal-openness)
- [Adding users to the Siemens TIA Openness group](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/basics/installation/adding-users-to-the-siemens-tia-openness-user-group)

## Access and security

Openness access is powerful. Keep these boundaries:

- Use the installed, version-matched Siemens assemblies; do not redistribute proprietary Siemens binaries or manuals without rights.
- Treat Windows group membership and connection approval as prerequisites, not authorization for every Simon operation.
- Siemens documents its Openness remoting channel as an `IpcChannel` with `ensureSecurity=false`, full type filtering, and an `authorizedGroup` corresponding to the built-in everyone account. Treat that as an implementation fact, not a security boundary.
- Keep all Siemens API calls in the restricted Windows/.NET bridge or worker.
- Return serializable Simon-owned DTOs, never live Siemens engineering objects.
- Do not expose arbitrary Openness method invocation, raw remoting, unrestricted shell access, or assembly loading to the model.
- Apply operation allowlists, selected-project scope, approval policy, audit logging, and conflict checks in backend code.
- Keep online PLC operations outside the initial integration unless separately designed, approved, and qualified.
- Do not automate whitelist registry writes as ordinary application behavior. Siemens's firewall prompt supports one-time approval or an administrator-approved persistent entry tied to application path, modification time, and file hash.

## Projects and engineering objects

A `TiaPortal` exposes project compositions. The installed API declares open, retrieve, upgrade, and create operations and project `Save()`/`SaveAs(...)` methods. `Open` targets current-version projects. Siemens documents `OpenWithUpgrade` for projects from the previous version; older projects can fail. Project opening modes, protected projects, multiuser projects, and upgrades require dedicated handling; do not collapse them into one generic open call.

One primary and multiple secondary projects can be open. Secondary projects are always read-only and may not appear in project navigation. Composition indexes can be recalculated after a project closes, so never use collection position as durable identity.

For Simon, maintain stable identifiers and reacquire engineering objects after lifecycle changes. Do not persist live object references across worker restarts, project close/reopen, or proposal boundaries.

## Exclusive access and transactions

The installed API verifies this shape:

```csharp
using ExclusiveAccess exclusive = tia.ExclusiveAccess("Simon approved change");
using Transaction tx = exclusive.Transaction(project, "Apply approved proposal");

// Supported mutation calls.

tx.CommitOnDispose();
```

`CommitOnDispose()` requests commit when the transaction is disposed. If commit is not requested, disposal rolls back automatically. An exception raised after the commit request still causes rollback on disposal. Check `CanCommit` and `CommitRequested`; catching an invocation exception does not by itself restore committability.

Critical workflow rule: **compile and project save are separate from the mutation transaction**. Siemens documentation lists compile and save operations among those not allowed inside a transaction. Therefore model at least these independent stages:

1. Revalidate proposal and project identity.
2. Acquire exclusive access.
3. Open transaction and apply supported mutations.
4. Commit/dispose the transaction.
5. Read back and compare the changed objects.
6. Compile outside the transaction.
7. Inspect all compile results and messages.
8. Save outside the transaction only under explicit policy.
9. Verify final state and record outcome.

A committed transaction followed by failed compile or failed save is a partial workflow outcome, not a global rollback. Preserve that state explicitly.

- [Transaction handling](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/general-functions/transaction-handling)
- [Saving a project](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-projects-and-project-data/saving-a-project)

## Compilation

Compilation is service-based:

```csharp
ICompilable compilable = engineeringObject.GetService<ICompilable>();
CompilerResult result = compilable.Compile();
```

Inspect `State`, `ErrorCount`, `WarningCount`, and recursive `Messages`. The declared result states are Success, Information, Warning, and Error. A returned `CompilerResult`—not the absence of an exception—is the source of compile outcome.

Siemens documents compilation for supported devices, device items, PLC software/blocks/types and groups, and HMI targets. All devices must be offline. Compiler timestamps are UTC. Password-protected safety programs require the appropriate safety login or compilation is cancelled with an exception.

- [Compiling a project](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-projects-and-project-data/compiling-a-project)

## PLC block representations

Do not treat all exports as equivalent.

### SIMATIC ML/XML

Verified V20 declarations:

```csharp
plcBlock.Export(file, ExportOptions.WithDefaults);
blocks.Import(file, ImportOptions.Override);
```

The API also offers overloads with document information and software import options. Siemens requires the PLC not online for the documented block-export workflow and limits it to consistent supported objects. Export/import support depends on object type, language, consistency, protection, project state, and documented restrictions. Use the version declared by the document and validate against the corresponding installed schema where needed.

The V20 installation includes multiple schema generations side by side—for example SCL v3/v4, LAD/FBD v4/v5, GRAPH v5/v6, and STL v4/v5. Preserve the export's schema identity.

- [Exporting blocks](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/importing/exporting-data-of-a-plc-device/blocks/exporting-blocks)
- [Basic principles of importing/exporting](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/overview/basic-principles-of-importing/exporting)

### Program-block documents

V20 declares:

```csharp
plcBlock.ExportAsDocuments(directory, baseName);
blocks.ImportFromDocuments(directory, baseName, ImportDocumentOptions.Override);
```

This is a separate SIMATIC SD document exchange route with its own result and option types. Results expose state, messages, and exported/imported file or block collections. Document import options include `None`, `Override`, `Skipinactiveculture`, and `ActiveInactiveculture`.

- [Exporting program block as document](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/importing/exporting-data-of-a-plc-device/blocks/exporting-program-block-as-document)
- [Importing program block from document](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/importing/exporting-data-of-a-plc-device/blocks/importing-program-block-from-document)

### Generated SCL/STL source

V20 declares `IGenerateSource` and `PlcExternalSourceSystemGroup.GenerateSource(...)`. The documented workflow requires the PLC not online. It generates UTF-8; Siemens requires UTF-8 with BOM when writing special characters. `GenerateOptions.None` includes selected objects, while `WithDependencies` includes dependent objects. Block generation supports STL/SCL and enforces object-appropriate `.awl`, `.scl`, `.db`, or `.udt` extensions. This route is not automatically a complete backup of all engineering metadata, initial values, comments, protection state, or graphical structure.

- [Generate source from block](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-accessing-the-data-of-a-plc-device/blocks/generate-source-from-block)
- [Adding an external file](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-accessing-the-data-of-a-plc-device/blocks/adding-an-external-file)

## Cross references

The V20 assembly verifies:

```csharp
CrossReferenceResult result =
    crossReferenceService.GetCrossReferences(filter);
```

Preserve source objects, reference objects, locations, access/reference types, and textual paths. Siemens documents that member-level references can contain useful textual information even when an underlying engineering object is unavailable. Do not discard such results or fabricate an object identity.

- [Getting Cross References for STEP 7](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-accessing-the-data-of-a-plc-device/functions-for-accessing-plc-service/getting-cross-references-for-step7)

## Recommended Simon boundary

The Siemens-facing worker should expose narrow operations such as:

- inspect installed Openness versions;
- list attachable TIA processes;
- attach/open a selected project under explicit policy;
- read selected project/device/software/block metadata;
- export a selected supported representation to a controlled workspace;
- obtain cross references;
- prepare and validate an import proposal;
- apply an approved import in a transaction;
- read back, compile, and optionally save as distinct stages;
- return structured compiler and verification results.

It should not expose `invoke_any_openness_method`, arbitrary filesystem paths, arbitrary assembly loading, general shell access, hidden direct saves, or online PLC mutation.

## Error and state model

At minimum distinguish:

- prerequisite unavailable;
- assembly/version mismatch;
- TIA process unavailable;
- attachment rejected or lost;
- project unavailable, protected, read-only, or changed;
- unsupported object/service/representation;
- export/import validation failure;
- exclusive access denied or cancelled;
- transaction rolled back, committed, or outcome unknown;
- readback mismatch;
- compile success/information/warning/error;
- save success/failure/unknown;
- post-commit failure requiring recovery guidance.

Never report external work as completed based only on a proposed call, generated XML, synthetic test, or model output.

## Testing strategy

- Keep domain parsers, policy, DTO mapping, proposal diffs, and state machines testable without Siemens assemblies.
- Use synthetic XML/documents for ordinary CI; do not commit customer exports or Siemens proprietary artifacts.
- Maintain a fake worker clearly marked synthetic.
- Run live tests only on a version-matched Windows host with a licensed installation and disposable projects.
- Test failures between every workflow stage, especially after transaction commit and before/after compile or save.
- Record exact assembly SHA-256, MVID, TIA version, project fixture identity, and compiler result for qualified live runs.

## Local evidence

- [`evidence/OFFICIAL_DOCS.md`](evidence/OFFICIAL_DOCS.md) — page-level ledger and findings from 19 directly rendered official Siemens V20 topics.
- [`evidence/LOCAL_ARTIFACTS.md`](evidence/LOCAL_ARTIFACTS.md) — installation and REA identity observations.
- [`evidence/API_SURFACE.md`](evidence/API_SURFACE.md) — focused verified declarations and integration implications.

REA Evidence IDs:

- Assembly identity: `ev_1ca310e4e0f665b337808d567df45b9f83209d7139bc70df07a155d3f25999a7`
- Focused member inventory: `ev_9924163593006676228390ade2409c76c0955ecbe357a6427d0059178b65cded`

## Gaps and unknowns

- Nineteen Siemens pages were rendered and read directly, but their full proprietary text was not copied into the repository; the evidence ledger stores URLs and rendered-text hashes.
- No live TIA process or project was attached or executed during this research.
- Current Windows group membership and connection approval were not tested.
- The V19-to-V20 REA comparison returned unavailable member coverage and cannot support compatibility claims.
- HMI, hardware, drives, safety, multiuser, libraries, online PLC access, Add-Ins, and VCI were inventoried only at a high level and need focused research before implementation.
- Exact document/source fidelity must be qualified with representative disposable V20 projects and round-trip tests.
