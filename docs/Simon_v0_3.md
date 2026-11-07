# Simon

## Product definition, architecture, and implementation handoff

**Document version:** 0.3  
**File:** `Simon_v0_3.md`  
**Prepared:** 2026-11-07  
**Primary baseline:** `Simon_v0.2.md` (2026-09-07)  
**Audience:** The coding agent and engineer building Simon  
**Status:** Consolidated accepted product direction; implementation detail and qualification gates remain explicit  
**Scope:** Personal/internal engineering tool, not SaaS-first  
**Default and sole planned harness:** Pi  
**Application surface:** Reused `mcp-agent-chat` UI and suitable backend components  
**Manual editor / authoritative project:** TIA Portal  
**Selected bridge:** `Fanqi-dev/tia-v20-unified-mcp`, based on the user's basic V20 read test  
**Target environment:** Windows / TIA V20 initially; exact build, CPU/firmware, permissions, resources, and supported operations must be recorded  
**Missing implementation input:** The existing chat application's `handoff.md` and source have not been inspected for this revision

> **Your TIA Portal. Supercharged.**

> **Simon is a project-aware engineering copilot that runs alongside TIA Portal, understands existing mixed-language PLC projects, retrieves version-correct Siemens documentation, and proposes and applies reviewed changes through supported engineering interfaces.**

**You engineer. SIMON handles the legwork.**

Codename origin: **SI**e**M**ens **ON** steroids -> **SIMON**. This is an independent project, not a Siemens product or a performance guarantee.

---

## Revision 0.3 at a glance

This is an update of v0.2, not a replacement written from a shorter outline. Preserve its project model, freshness/provenance, permission boundaries, mutation/compile/recovery logic, functional checks, testing, and bounded self-customization.

The accepted current composition is:

```text
Existing chat application + Pi runtime + Simon engineering service
                         + selected Fanqi/Openness bridge + TIA Portal
```

There is no mandatory VS Code frontend, no new PLC editor, no new generic chat engine, and no multi-harness platform to build. The chat application stays familiar; its Codex-specific backend connection must be adapted to Pi. TIA remains the place where the engineer manually edits PLC code and hardware.

Use SCL source diffs and FBD/LAD XML diffs in the chat review surface. Internal exports, indexes, and proposal artifacts remain backend implementation details, not a new authoritative filesystem project.

Retain self-improvement as agent-assisted, reversible customization with preview, tests, activation, and optional reviewed contributions. Do not confuse it with rewriting the trusted bridge or permission system at runtime.

The original Manual/Auto execution question is explicitly addressed in section 18.6. A prompting preference does not automatically grant unrestricted TIA writes. Broader automatic-write behavior remains a separate open decision.

---

## How to use this handoff

This document is self-contained as a product and engineering specification. Use it as the current consolidated plan; retain earlier documents as history. Appendix A explains source lineage and what was carried forward.

**Source precedence:** the user's latest explicit decisions are applied transparently to the v0.2 baseline. Where detail is newly proposed rather than accepted, it is labeled as such. Missing evidence is not silently replaced with assumed implementation facts.

| Label | Meaning |
| --- | --- |
| **Accepted direction / Requirement** | User-approved product choice or retained engineering constraint. |
| **Proposed design** | Recommended implementation/default, to be recorded or revised through a decision. |
| **Inherited finding** | v0.2 source-based statement retained with its original version applicability; not freshly certified here. |
| **External documentation check** | Narrow v0.3 reference check, separate from user requirements and live-test evidence. |
| **User-reported evidence** | An outcome described or shown in conversation, with only the demonstrated scope. |
| **Validation gate** | Behavior that must pass on the chosen build before the capability is enabled. |
| **Open decision / missing input** | Not yet established; do not silently claim it as accepted or implemented. |

References `[S01]` through `[S30]` are inherited from v0.2; `[S31]` through `[S35]` are the limited v0.3 additions. Recheck target applicability and pin versions/commits during implementation. The user has reported successful basic Fanqi/Codex reading, but Pi integration, import fidelity, recovery, and hardware completeness have not thereby been qualified.

**Retained critical distinction:** compilation and project save are not part of a single Openness mutation transaction. Keep import, compilation, readback verification, and any compensating recovery as separate explicit stages. [S05]

---

## Contents

1. README opening and product identity
2. Problem, intended outcome, and product boundary
3. What Simon wraps: Openness, not TIA's private storage
4. Decisions already made and decisions left open
5. Inherited technical foundations and validation caveats
6. Selected bridge and historical reuse references
7. Primary user workflows
8. MVP scope and expansion sequence
9. Runtime architecture and responsibilities
10. Deployment, VM resources, and process isolation
11. Environment discovery and capability profiles
12. Project binding, object identity, and freshness
13. Project snapshots and intermediate representations
14. SCL and graphical-language handling
15. Retrieval and codebase indexing
16. Version-aware Siemens documentation retrieval
17. Coding conventions and the Simon engineering skill
18. Tool contracts and the approval boundary
19. The controlled change pipeline
20. Transactions, compilation, and recovery
21. Functional verification and PLC semantics
22. Security, privacy, and trust boundaries
23. Storage, events, and provenance
24. Pi runtime and integration with the existing chat backend
25. Existing chat application and engineering review surfaces
26. Performance and observability
27. Implementation stack and repository layout
28. Research backlog and architecture decisions
29. Milestones and acceptance gates
30. Test strategy and failure cases
31. Worked example
32. Risk register and success measures
33. First instructions to the coding agent
34. Agent-assisted onboarding and a self-customizing Simon UI
35. From local customization to reviewed upstream contribution
36. Primary-source register

Appendix A. Revision lineage and requirements preservation

---

## 1. README opening and product identity

### 1.1 Name and slogans

**Product name:** Simon. Use **SIMON** for the wordmark and slogans; use `simon` for repository/package/CLI identifiers where appropriate. SIENA was an intermediate planning name, not a second product or a required compatibility layer.

Preserve the phrases developed in the conversation:

| Role | Wording |
| --- | --- |
| Main public-facing slogan | **Your TIA Portal. Supercharged.** |
| Playful codename origin | **SIMON - Siemens on steroids.** |
| Letter extraction for the name | **SI**e**M**ens **ON** steroids -> **SIMON** |
| Secondary slogan | **You engineer. SIMON handles the legwork.** |
| Plain-language descriptor | **A project-aware AI agent for Siemens PLC engineering.** |

The slogan is not a measured speed, safety, or productivity guarantee. Simon is an independent personal/internal project, not a Siemens product. Do not imply endorsement or reuse Siemens branding without authorization. Assess naming and distribution requirements separately before a public release.

### 1.2 README opening to reuse

Use the following opening in the eventual project `README.md`. Keep the original engineering definition verbatim and include the accepted architecture diagram. The status text must be updated to match demonstrated implementation, not simply copied as a success claim.

````markdown
# SIMON

## Your TIA Portal. Supercharged.

> Simon is a project-aware engineering copilot that runs alongside TIA Portal, understands existing mixed-language PLC projects, retrieves version-correct Siemens documentation, and proposes and applies reviewed changes through supported engineering interfaces.

**You engineer. SIMON handles the legwork.**

Simon combines a reusable chat application, Pi as its agent runtime, and a
controlled engineering service built on the Fanqi TIA V20 MCP/Openness bridge.
You keep editing in TIA Portal. Simon retrieves project context and Siemens
references, prepares SCL/XML diffs, and applies authorized, qualified changes.

The codename comes from **SI**e**M**ens **ON** steroids. Simon is independent
and is not affiliated with or endorsed by Siemens.

## Architecture

```text
YOUR EXISTING CHAT UI
Messages, slash commands, SCL/XML diffs, approvals
                       ↕
SIMON APPLICATION BACKEND
                       │
             ┌─────────┴──────────┐
             │                    │
             ▼                    ▼
        PI RUNTIME         SIMON ENGINEERING SERVICE
             │             Project index, documentation,
             │             proposals, approvals, recovery
             │                    ▲
             ├── calls Simon tools┘
             │                    │
             ↕                    ▼
       Selected LLM         TIA MCP / Openness bridge
     OpenAI / Anthropic           │
         / others                 ▼
                              TIA Portal
```

The chat surface is reused from `mcp-agent-chat`. Simon-specific diff/review
features and the Pi integration must be implemented and tested. Models and
account access depend on the supported, verified Pi configuration.

## Project status

Personal/internal engineering tool. Basic Codex-to-Fanqi-to-TIA reading has
been reported working; that is not evidence that the Pi integration or Simon's
reviewed write/recovery pipeline is complete. Controller deployment and
safety-program authoring are outside the initial scope.

## Tailor your workspace

Use the copilot to learn Simon, tailor supported views, and prepare local
extensions that you can choose to contribute back. Treat this as roadmap
functionality until its activation, isolation, and recovery tests pass.
````

### 1.3 Positioning and interface boundary

Simon is a project-aware engineering assistant beside TIA, not a replacement PLC IDE, an autonomous commissioning agent, or simply a generic chatbot with an SCL prompt.

**TIA Portal remains the manual editor. The existing chat application becomes Simon's interaction and review surface. VS Code is not a runtime dependency.** Developers may use any editor to build Simon itself.

A diff viewer is a review component, not a second PLC editor. Project snapshots, source exports, and XML artifacts remain backend evidence and working representations; the engineer is not required to manage them manually.

The diagram describes responsibilities, not already implemented features or mandatory microservices. It also does not certify every provider/account combination shown in the diagram.

---

## 2. Problem, intended outcome, and product boundary

### 2.1 The user's problem

The current workflow requires substantial manual work to give an AI coding assistant enough context:

- Copy code or screenshots out of TIA.
- Explain interfaces, tags, types, calls, and project-specific conventions.
- Translate graphical networks into prose.
- Look up instruction documentation separately.
- Copy generated code back into the project.
- Compile, copy errors into chat, and repeat.
- Manually check whether changes fit the surrounding PLC program.

Simon should replace that disconnected loop with controlled project access, retrieval, reviewed changes, and compiler feedback.

### 2.2 Desired outcome

The engineer stays in TIA for normal engineering work. Simon runs beside it and can answer questions about the project, prepare small coherent changes, explain dependencies, follow approved conventions, and apply supported edits after review.

The user's ambition is a substantial productivity improvement, informally described as "10x." Treat that as an aspiration to measure, not a performance guarantee or marketing claim.

### 2.3 What the product optimizes

Prioritize:

1. Less manual context preparation and copy/paste.
2. Better understanding of existing mixed-language projects.
3. Small, reviewable changes grounded in actual project data.
4. Faster feedback from documentation and compilation.
5. Preservation of existing behavior unless a behavior change is explicitly requested.

Do not optimize merely for generating more code, making larger patches, or reducing human review at any cost.

### 2.4 Meaning of "alongside TIA"

The intended integration targets the engineering project open in TIA. It does not mean the model edits executable logic inside a running PLC. Project mutation, project save, compilation, download, and online controller manipulation are separate activities.

The first release is an **offline engineering assistant**. TIA may be open with its graphical interface while Simon operates through supported APIs. Operation-specific offline requirements still apply. [S01][S03][S06]

### 2.5 Personal-first scope and reuse

**Accepted direction:** build for the user's own PLC engineering workflow first. No SaaS billing, multi-tenancy, organization administration, marketplace, mandatory cloud backend, or generalized enterprise workflow is required. Optional upstream contributions do not turn the application into a SaaS product.

The user reports an existing `mcp-agent-chat` application with a chat/pop-up UI, slash commands, a backend, a working Codex-based subscription connection, and Manual approval / Auto execute settings. Reuse suitable components after inspecting that project's `handoff.md` and source. The handoff was not supplied for this revision; the UI framework, backend language, protocol, and exact implemented capabilities remain unverified.

Do not replace that application merely to match a speculative stack from an older plan. Do not claim that replacing its Codex connection with Pi requires no integration work.

---

## 3. What Simon wraps: Openness, not TIA's private storage

### 3.1 Direct answer to the architecture question

**Yes: Simon is built around TIA Portal Openness, Siemens's supported engineering API.**

More precisely:

```text
Engineer
   |
   v
Reused mcp-agent-chat interface with Simon review features
   |
   v
Pi runtime with Simon instructions and tools
   |
   v
Simon tools and controlled change service
   |
   v
Fanqi-derived TIA V20 bridge behind Simon policy
   |
   v
Siemens TIA Portal Openness API
   |
   v
The selected TIA engineering project
```

Openness supports attaching to a running TIA process as well as starting an instance with or without its graphical interface. That is the relevant foundation for a separate-process assistant. [S01]

### 3.2 Terminology that must remain clear

| Component | Role |
| --- | --- |
| TIA Portal | The engineering application and authoritative project environment. |
| TIA Portal Openness | Siemens's engineering API used to access supported project objects and operations. |
| Simon bridge | Our restricted adapter and policy layer around selected Openness operations. |
| MCP | One possible protocol through which an agent invokes Simon's tools. It is not Openness itself. |
| Agent harness | The coding-agent runtime that calls tools and interacts with the model. |
| Model | The LLM providing reasoning and generation. |
| TIA add-in | An optional future UI integration, such as a project-tree action opening Simon. |
| Simon skill | Instructions describing engineering workflows and how to use the tools. Not a permission system. |

A TIA add-in is not required for the first version. Siemens documents project-tree context-menu add-ins, so a small "Ask Simon" action is a possible later improvement. [S09]

### 3.3 Reusing an existing bridge

**Accepted starting point:** build on `Fanqi-dev/tia-v20-unified-mcp`, which the user has already built and used for a basic project-reading test. Capture the tested checkout and extend or wrap it rather than restarting a generic bridge selection. The selected bridge remains replaceable infrastructure; Siemens Openness is the underlying integration. [S31]

Do not choose an upstream project solely because it exposes many tools. Prefer compatible versions, understandable code, controlled writes, and demonstrated round-trip behavior. Simon must not inherit a broad mutation surface just because it already exists upstream.

### 3.4 What this architecture explicitly avoids

- Editing proprietary TIA project database files directly.
- Reverse-engineering private file formats as the primary integration path.
- Injecting code into TIA's editor process to simulate a copilot.
- Making GUI automation or screenshots the default project-reading mechanism.
- Giving an LLM unrestricted access to all Openness methods.
- Requiring a commercial third-party engine unless the user knowingly selects that dependency.

### 3.5 Openness and exported XML are complementary

Use Openness for supported access to project objects. Where block logic is obtained through an Openness XML/SCL export, the export is an internal working representation, not a conversion of the entire project into a new authoritative codebase. The native TIA project is not assumed to be plain XML. [S03]

For FBD/LAD, show original-versus-proposed XML in the chat diff viewer and supplement it with a network-level explanation. Do not require an external editor or automatic FBD-to-SCL translation. Displaying an XML diff does not qualify that edit for import; representation and operation gates still apply.

---

## 4. Decisions already made and decisions left open

### 4.1 Accepted direction for v0.3

| Decision | Consequence |
| --- | --- |
| The product is Simon / SIMON. | SIENA is retained only as historical planning context. Use the slogans and unchanged definition in section 1. |
| This is a personal/internal engineering tool first. | No SaaS architecture, billing, or multi-tenancy in scope. |
| TIA Portal remains the editor and authoritative engineering environment. | No mandatory VS Code frontend, project mirror editor, or replacement PLC IDE. |
| Reuse the existing `mcp-agent-chat` UI and suitable backend components. | Inspect its handoff/source before choosing frameworks or rewriting the app. Add engineering review features there. |
| Pi is the default and sole planned harness for this implementation. | Build one Pi integration. A runtime selector, Codex runtime adapter, or second-harness milestone is not required. |
| Model/provider selection remains independent of Pi. | Offer only combinations actually supported and authorized for the pinned configuration. |
| Build on `Fanqi-dev/tia-v20-unified-mcp`. | Record the tested commit, verify reuse rights, preserve attribution, and add Simon's engineering policy above the selected bridge. |
| Use supported engineering interfaces. | Openness remains the route to TIA; no direct proprietary-storage edits. |
| Preserve mixed-language projects. | No wholesale FBD/LAD conversion to SCL. |
| Start authoring with qualified non-safety SCL FC/FB changes. | Graphical edits require their own qualification; reading and diff presentation can arrive earlier. |
| Use SCL source diffs and FBD/LAD XML diffs in the chat app. | Include exact artifacts and affected-network explanations. Graphical before/after rendering is later. |
| Retain project indexing, dependencies, version-aware Siemens references, and approved conventions. | These are backend capabilities, independent of the interface or harness. |
| Recover v0.2's engineering detail. | Preserve binding/freshness, approval, transaction separation, metadata preservation, recovery, security, test matrices, and provenance. |
| Retain agent-assisted onboarding and self-improvement. | Implement reversible, bounded customizations, not autonomous rewriting of trusted policy or the running bridge. |
| Keep customizations in user-scoped `.simon`. | Separate editable packages from private project data and protected approval/policy storage. |
| Keep optional upstream contribution proposals. | Local changes remain usable without publication; exact outbound contents require review. |
| Include the accepted backend diagram in the plan and future README. | The diagram in sections 1 and 9 is canonical at the responsibility level. |

The user's motivation for choosing Pi includes perceived efficiency. **No 'several times faster/cheaper' or '10x' claim has been demonstrated for this project.** Selection is accepted; comparative performance remains something to measure, not a prerequisite to honoring that selection.

### 4.2 Proposed implementation choices, not user-confirmed facts

- Use Pi's SDK for an appropriate Node.js/TypeScript host, or its headless RPC subprocess for another backend or a deliberate process boundary. Choose after inspecting the existing app. [S32][S33]
- Keep the Fanqi-derived Siemens integration in its compatible Windows/.NET environment; do not rewrite it merely to align with the chat backend language.
- Keep SQLite plus local files as the starting storage design.
- Route Pi's engineering tools through Simon's policy-controlled service; keep unrestricted upstream mutations unreachable by the agent.
- Adapt the existing Manual approval / Auto execute controls according to section 18.6. Their exact TIA-write scope has not yet been agreed.
- Preserve a per-change human approval gate for original-project writes in this revision, as inherited from v0.2. A broader automatic-write policy is an explicit future decision, not implied by an Auto execute toggle.
- Keep executable customization and remote publication disabled until their corresponding gates pass; start with configuration-based improvements.

### 4.3 Implementation inputs still missing

The `mcp-agent-chat` handoff/source, its exact protocol (described as 'AMCP' in conversation), its event/session/authentication contracts, and its UI/runtime security model have not been inspected. Do not silently equate AMCP with MCP, ACP, or Codex App Server.

TIA V20 has been used in the user's tests. The exact currently selected TIA update, assembly versions, CPU/firmware, project mode, available options, simulation setup, and resource budget still need a recorded environment report. Previous machine names and paths are setup history, not global constants.

Pi release/package identity, SDK-versus-RPC choice, currently permitted subscription/API paths, and Fanqi commit/license details must be pinned before implementation claims are made. Existing Codex credentials or session files are not automatically portable to Pi.

### 4.4 What has actually been demonstrated

| Item | Evidence available in this conversation | Status for v0.3 |
| --- | --- | --- |
| TIA V20 / Openness and Fanqi executable setup | User supplied installation/build checks and reported executable existence. | User-reported setup; record exact environment/commit. |
| Codex calling the bridge | Tool-call outputs showed `GetState`, `GetProject`, and `GetProjectTree`; the user subsequently reported reading the project after attachment. | Basic read/attachment smoke test, not full qualification. |
| Hardware visibility | User reported an added module not being visible; no conclusive root cause or fix was supplied. | Open coverage/freshness regression case. |
| Existing chat application | User reports a functioning Codex-backed application, slash commands and approval controls. | Reuse selected; implementation not inspected here. |
| Pi running Simon tools | No integrated Pi/Simon test supplied. | To implement and test. |
| Reviewed imports, compile recovery, simulator behavior | No complete reproducible test evidence supplied. | Not qualified by the earlier smoke test. |
| Self-improvement and contributions | Accepted product direction; no implemented Simon pipeline shown. | Incremental roadmap, not shipped capability. |

Do not restart working setup steps or discard the existing app because evidence is incomplete. Capture and reproduce the known baseline, then close the specific gaps.

---

## 5. Inherited technical foundations and validation caveats

**Source status:** this section preserves v0.2 findings and their original version-specific references. They are not a fresh certification of the user's V20 build. Confirm target applicability before implementation, especially where a source describes V21.

### 5.1 SCL is not C

Siemens describes SCL as a Pascal-based language implementing Structured Text concepts. SCL and STL are not interchangeable names. The product's initial authoring target is **SCL**, not a migration to STL. [S02]

FBD's graphical appearance does not imply that a hidden C source file exists for Simon to edit. Use supported representations rather than assumptions about Siemens's compiler internals.

### 5.2 Structured exports provide a better starting point than PDF reconstruction

Siemens documents XML export of supported blocks and types, including FBD, LAD, and SCL program content. Its documented XML export path requires a connected Openness application, an open project, and a PLC that is not online; consistency and object restrictions also matter. [S03]

This gives Simon a machine-readable path to graphical logic. It does not guarantee that every object and all project metadata can be losslessly exported and re-imported through one format.

### 5.3 SIMATIC Source Documents are version-sensitive

The V21 documentation describes textual SIMATIC SD representations for supported LAD, FBD, and SCL blocks, with `.s7dcl` code and associated `.s7res` language resources. The V20 baseline documentation describes a narrower scope. Exact support must be probed for the installed major version and update. [S04][S18]

Siemens also documents program-block document export through Openness. Confirm actual assembly signatures rather than copying documentation pseudocode blindly: prose and sample names are not always identical. [S20]

### 5.4 Round-trip restrictions are real

The V21 SIMATIC SD documentation describes restrictions involving protection, some constructs, alarms, and attributes. It specifically warns about OB-type information being lost on export/import. That route must not be enabled indiscriminately for OB mutation. [S04][S19]

Ordinary SCL source export also has limitations; Siemens notes that certain initial values and array-element comments are not exported by particular source-generation routes. A text export is therefore not automatically a complete backup of the engineering object. [S21]

### 5.5 Compilation and transactions are separate

Siemens provides transaction handling for supported modifications, but documents `Compile`, `Project Save`, and several lifecycle operations as disallowed inside a transaction. [S05]

Compilation is available through the engineering API and returns structured results and nested diagnostics. The documented V21 compilation prerequisites include devices being offline. [S06]

**Design consequence:** Commit or roll back supported import mutations, then compile outside the transaction. A subsequent compilation failure requires explicit recovery logic, not a fictional transaction rollback spanning both stages.

### 5.6 Cross-references can be obtained from TIA

Openness exposes cross-reference results for supported STEP 7 objects. The documentation notes limits around returning engineering-object references for members; textual reference information can still be available. [S07]

Use these results where supported, preserve their provenance, and avoid claiming complete dependency knowledge where resolution is partial.

### 5.7 The help viewer is a discovery opportunity, not a proven content API

Siemens documents port 5112 as a default TIA Help Viewer port. That confirms the user's observation is plausible; it does not identify the installed content format or establish a stable search API. [S08]

Inspect the actual help installation later. Do not hardcode port 5112 as universally available or open it to other machines to simplify indexing.

---

## 6. Selected bridge and historical reuse references

**Selected foundation: `Fanqi-dev/tia-v20-unified-mcp`.** Build on the user's working checkout, preserve its provenance, and qualify only the operations Simon enables. The upstream README describes a standalone stdio server for local TIA V20 projects; upstream functionality is not automatically a Simon permission. [S31]

Record the repository commit, local modifications, build command/result, executable identity, Siemens assembly paths/versions, and the initial successful read evidence. Do not treat a directory name or a `True` readiness row as sufficient evidence. Retain the original project and checkout while establishing the Simon integration.

The alternatives below are historical references from v0.2, not a request to repeat the selection exercise. Reconsider the chosen bridge only for an evidenced licensing, compatibility, fidelity, or security blocker.

| Candidate | Documented positioning | Decision needed |
| --- | --- | --- |
| Siemens Eigen Engineering Agent | Siemens advertises project-aware assistance connected to TIA, including code development and testing. [S10] | Understand the commercial benchmark. Do not repeat unverified productivity claims. |
| `Czarnak/tia-portal-mcp` | Public V21-oriented MCP bridge; the repository describes separate modern-.NET and .NET Framework worker processes. [S11][S12] | Audit as a reuse candidate, especially version coupling and write-policy enforcement. |
| `JasonJJQ/tiaportal-mcp` | Public bridge whose documentation targets V20 by default and discusses configurable version selection and document operations. [S13] | Audit against the actual installed version; verify license and tests at a pinned commit. |
| `renanlido/tia-harness` | Open client skills/MCP layer with a separately licensed proprietary Openness engine. [S14] | Useful workflow reference, not a wholly open implementation. |
| `feelautom/tia-copilot-genai-bridge` | Public integration components whose documentation identifies a private core engine. [S15] | Useful design reference; do not mistake the repository for the complete backend. |

### 6.1 Required audit before adoption

For the selected Fanqi checkout, record (apply the same checklist to any replacement proposed later):

- Repository URL, commit, license files, dependency licenses, and build instructions.
- Exact supported TIA/API versions and whether support was actually demonstrated.
- Whether Siemens assemblies are correctly resolved from a licensed installation.
- Default read/write mode, registered tools, and reachable low-level endpoints.
- Whether the agent can bypass a high-level approval through another method.
- Project binding, concurrency, timeouts, worker lifetime, and error handling.
- Behavior on partial import, failed compile, stale content, and process disconnect.
- Whether operations are transactional, sequential, or compensating.
- Test fixtures, live-test evidence, and untested claims.
- Amount of code Simon would need to fork, replace, or disable.

Produce an architecture decision for the selected base: **which components are reused, which operations are wrapped, and which changes require a maintained fork**. Rebuilding the bridge is a fallback for an evidenced blocker, not the default. Verify that reuse rights cover the additions being adopted as well as upstream code; do not infer license coverage from one inherited license file.

A wrapper is only a security improvement when the agent cannot directly reach the broader underlying interface.

### 6.2 Simon-facing boundary around the selected bridge

Prefer narrow Simon contracts over exposing every upstream tool to Pi. A read/export tool may still write a local artifact or prompt for attachment; classify its actual effects. Disable automatic TIA startup, project selection, or broad export when they conflict with explicit user scope.

Only Simon's authorized backend should reach qualified mutation operations. A wrapper is ineffective if Pi's generic shell, an additional MCP registration, or an extension can call the raw bridge directly. Prevent or clearly mark such bypass paths as a development-only configuration.

The integration may wrap the existing process or incorporate reviewed code into a restricted worker; decide this from the checkout, without duplicating an already working implementation unnecessarily. Compile, save, import, and compensating recovery remain distinct Simon operations even when an upstream helper combines them.

---

## 7. Primary user workflows

### 7.1 Understand an unfamiliar project

Example request:

> Explain the pump permissive logic, show where the command is written, and identify the blocks that depend on it.

Simon should resolve the real symbols, retrieve relevant networks and interfaces, inspect references, and answer with object paths and source locations. Missing or protected content must be disclosed.

### 7.2 Improve an existing SCL block

Example request:

> Refactor this sequence to match our conventions without changing its interface or behavior.

Simon should examine the current block, its instances and callers, relevant approved patterns, and applicable documentation. It should propose a bounded patch with explicit invariants and tests.

### 7.3 Understand FBD without converting the project

Example request:

> Explain why this FBD network prevents restart after a fault.

Simon should reason from the exported network structure. It may provide prose or SCL-like pseudocode as an explanation, clearly marked as derived and non-authoritative. It must not replace the FBD implementation automatically.

### 7.4 Make a constrained graphical edit

Example request:

> Change this supported timer preset and preserve the existing network and block interface.

Only enable this workflow after that particular representation, object type, and edit pattern have passed round-trip and semantic tests. Unsupported graphical edits become proposals for manual review, not improvised imports.

### 7.5 Find and use the right instruction documentation

Example request:

> What are the prerequisites and status codes for this instruction on this CPU and TIA version?

Resolve the instruction and version from project metadata where possible. Return source-specific explanations and uncertainty when firmware or instruction versions are unknown.

### 7.6 Learn project conventions

Example request:

> Review this approved reference project and draft our CodingConventions.md.

Simon should identify repeated patterns, cite representative examples, list exceptions, and ask the engineer to approve the resulting rules. Existing inconsistency is not a new mandatory convention.

### 7.7 Resolve a compile failure

Simon should retrieve actual compiler diagnostics, propose a limited fix, and rerun the permitted validation path. Do not suppress diagnostics, change hardware, weaken engineering constraints, or widen the patch merely to obtain a green compile.

### 7.8 Read hardware with explicit coverage

Example request:

> Find the I/O module I added and show its parent device and slot.

Inspect the bound project and relevant nested device items. Record object identity, last refresh, recursion coverage, and errors. Do not equate a coarse project tree with a complete module inventory. The earlier missing-module report is a regression case; do not pre-label it as caching, missing permissions, or a traversal bug without evidence.

### 7.9 Review changes in the existing chat app

Example request:

> Show the proposed change before applying it.

Show SCL source for supported text logic or an XML diff for FBD/LAD, together with object/network identity and the explanation. Acknowledge unsupported representations. Reviewing a proposed XML change does not grant arbitrary graphical-edit capability.

---

## 8. MVP scope and expansion sequence

**Retained in revision 0.3:** Agent-assisted onboarding and a bounded customization surface are product requirements. Establish their interfaces early, but do not delay the first read-only TIA workflow for a plugin marketplace or arbitrary runtime code generation. See the parallel E0-E3 milestones in section 34.12.

### 8.1 First useful release

Support one qualified TIA V20 environment and Pi as the sole planned runtime, using the existing chat application. No VS Code, new standalone shell, or generic multi-harness framework is required.

Required capabilities:

- Explicit attachment to the selected TIA process and project.
- Read-only inventory of supported PLC software and relevant hardware items, with explicit coverage limits.
- SCL reading and approved SCL edits through a tested route.
- FBD reading and explanation for a bounded supported subset.
- Interface/type/tag retrieval and available cross-references.
- Local project snapshots with freshness information.
- Version-aware documentation search.
- Approved project conventions.
- A reviewable change set with SCL source diffs or FBD/LAD XML diffs in the existing chat interface; graphical writes remain qualification-gated.
- Independent approval and strict stale-state rejection.
- Compilation outside the mutation transaction.
- Post-import verification and a demonstrated recovery workflow.
- Evidence-backed compatibility and capability reporting.

### 8.2 Next increment

Add a small set of verified FBD/LAD edit patterns, focused navigation within the chat app, and the first reversible customization. Expand only through tests and capability entries. A second harness is not a scheduled deliverable under the Pi-only decision.

### 8.3 Later possibilities

A TIA context-menu add-in, stronger diagram rendering, additional TIA versions, library-aware refactoring, isolated simulator orchestration, HMI support, and hardware configuration assistance may follow. Team/SaaS features and other harnesses require a new explicit need and decision.

### 8.4 Explicit exclusions from the initial product

No controller download or upload, force operations, CPU mode changes, online variable writes, credential/protection changes, autonomous safety-program edits, hardware/network mutation, project upgrades, automatic library publishing, or project-server commits.

Reading permitted metadata about such areas can be useful, but does not enable writing them. Safety-related content must be classified and handled separately; unknown safety impact blocks mutation.

Do not attempt to implement a universal PLC compiler, a complete TIA replacement, a universal FBD-to-SCL converter, or a broad benchmark platform as a prerequisite to the MVP.

---

## 9. Runtime architecture and responsibilities

### 9.1 Accepted backend architecture and README diagram

```text
YOUR EXISTING CHAT UI
Messages, slash commands, SCL/XML diffs, approvals
                       ↕
SIMON APPLICATION BACKEND
                       │
             ┌─────────┴──────────┐
             │                    │
             ▼                    ▼
        PI RUNTIME         SIMON ENGINEERING SERVICE
             │             Project index, documentation,
             │             proposals, approvals, recovery
             │                    ▲
             ├── calls Simon tools┘
             │                    │
             ↕                    ▼
       Selected LLM         TIA MCP / Openness bridge
     OpenAI / Anthropic           │
         / others                 ▼
                              TIA Portal
```

This is the user-approved responsibility graph. Reuse it in `README.md` (section 1). It is not a claim that the existing app already has SCL/XML review or that Pi integration is complete. The engineering-service box includes the approval authority, restricted write broker, validation, and recovery detailed below.

Pi is not Openness and is not the TIA-specific tool implementation. It runs the model/tool loop; the engineering service owns engineering state and effects. Direct model access does not grant project permissions.

### 9.1.1 Retained trust-boundary view

```text
                     TRUSTED ENGINEER
                            |
                selection, review, approval
                            |
                   Simon review surface
                            |
                   approval authority
                            |
Pi runtime ------> Simon application service
  |                  |      |       |
  |                  |      |       +--> audit / change journal
  |                  |      +----------> project + documentation index
  |                  +-----------------> proposal validator
  |                                     |
  |                            restricted write broker
  |                                     |
  +--> isolated worktree                |
        proposals only           private authenticated IPC
                                        |
                              version-specific worker
                                        |
                                  TIA Openness
                                        |
                            selected offline TIA project
```

The logical components may share a trusted service process initially. The essential separation is that agent-generated content and the agent's general-purpose execution environment do not control the authority that grants project writes.

The app-customization extension host and optional contribution publisher sit beside this engineering pipeline, not inside the Openness worker. Both use narrow contracts; neither may replace the approval authority. A generated UI can prepare or display a proposal, never grant it engineering or publication authority. See sections 34-35.

### 9.2 Pi runtime

Runs the agent loop that supports interpretation, retrieval selection, proposed edits, explanations, and interaction with the user. Simon supplies the domain instructions and controlled tools; the selected model produces the requested reasoning and content. Pi is more than a tool collection and does not replace the engineering service.

It does not hold unrestricted project-file access, Siemens assembly access, or a general Windows shell under the TIA user's privileged identity in the hardened deployment.

### 9.3 Application service

Owns project bindings, capability profiles, snapshots, retrieval, change-set lifecycle, validation requests, and progress reporting. It should be independently testable without TIA installed.

### 9.4 Approval authority and write broker

Own exact change-set authorization, allowed object scope, risk classification, immutable staging, preconditions, expiry, single-use approval, and execution state.

This component, not the language model or a Markdown instruction, decides whether a write is allowed.

### 9.5 Fanqi-derived Openness bridge/worker

Owns every Siemens API call. It uses the installed, version-matched Siemens assemblies and keeps engineering objects inside the worker boundary. Return serializable data transfer objects, not live Siemens object references.

Use a serialized operation queue per attached project as the conservative initial design. Determine actual threading and apartment requirements from the target API documentation and tests rather than guessing.

### 9.6 Documentation/index service

Owns extraction, search, document versioning, source locations, dependency records, and context packaging. It must distinguish authoritative source content from model-written summaries.

### 9.7 No circular ownership

The agent proposes content. The broker stages and applies approved content. The index reflects verified project state. A summary or generated mirror file must never become the authoritative project merely because it is easier to access.

### 9.8 Ownership and event paths

| Responsibility | Owner |
| --- | --- |
| Message composer, chat display, command picker, review controls | Reused chat frontend, extended for Simon |
| Conversation-to-project binding and approved app actions | Simon application backend |
| Model interaction, tool-call loop, runtime conversation/compaction | Pi integration |
| Project snapshots, source maps, documentation, conventions | Simon engineering/knowledge service |
| Exact change authorization and authoritative operation journal | Protected approval authority / broker |
| Siemens calls | Fanqi-derived Windows bridge/worker |
| Manual PLC/hardware editing and authoritative project | TIA Portal |

The backend maps Pi events to the existing UI's stable message/tool/proposal events. A Pi turn finishing, a browser disconnecting, or a successful tool transport response must not be treated as proof that an engineering operation completed. Only the engineering journal and verification evidence establish that state.

The UI sends human review decisions to the trusted backend, not as a chat message for the model to interpret. Starting and stopping the Pi runtime must not automatically close the user's TIA process or replay a pending project write.

---

## 10. Deployment, VM resources, and process isolation

### 10.1 Option A: Same Windows machine

TIA, the bridge, and Simon run on one machine. This simplifies connectivity but does not automatically create a sandbox.

Separate processes under the same unrestricted user are a convenience boundary, not strong protection. Before real-project writes, choose an isolation model that prevents the agent from changing broker policy, approvals, worker binaries, or the original project outside the tool interface.

### 10.2 Option B: Agent on host, bridge in TIA VM

Preferred when it meaningfully reduces guest load and improves isolation:

```text
HOST / AGENT ENVIRONMENT              TIA WINDOWS VM
------------------------             ---------------------------
Agent harness                        TIA Portal
Simon UI / retrieval                 restricted Simon broker
proposal worktree                    Openness worker
          |                                   |
          +---- authenticated narrow link ----+
```

Do not expose raw Openness remoting over the network. The custom link carries only the typed Simon operations permitted by policy. Bind it to a restricted interface, authenticate both sides, encrypt transport where applicable, and restrict firewall access.

An unauthenticated HTTP listener on the local network is not acceptable. A local TCP port is not automatically secure simply because it is named "localhost" or is used inside a VM.

### 10.3 Option C: Non-TIA development environment

A developer can implement parsers, search, policies, protocol tests, and UI against sanitized fixtures and a fake worker on another machine. Live integration tests remain pending until the target Windows environment is available.

### 10.4 Resource measurements

The implementation agent must collect a small resource report on the target machine:

- RAM and CPU available to the VM/host.
- TIA idle footprint and peak compile footprint for the representative project.
- Initial export duration, subsequent refresh duration, and index size.
- Worker/application-service idle and active overhead.
- Agent-harness overhead and any local embedding workload.
- Network latency between agent and bridge, when separated.
- Behavior when memory pressure or a long compile occurs.

Do not choose arbitrary minimum RAM figures or require nested virtualization before measuring. The design does not require local model weights. Local embeddings are optional, not a hidden GPU requirement.

### 10.5 Installation and licensing

Detect installed prerequisites first. Do not silently install Siemens components, change Windows groups, enable firewall rules, weaken endpoint protection, or change project licensing. Present required setup changes for the engineer or administrator to approve.

Resolve Siemens assemblies from the licensed installation; do not bundle proprietary binaries into a public package without establishing distribution rights.

### 10.6 Current setup is a smoke-test environment, not proof of isolation

The user has run the tools under an `aiagent` Windows account and arranged launchers for TIA and development tools. Keep useful setup, but discover the current machine identity and effective privileges rather than hardcoding earlier example names.

A shared account with Openness rights can make attachment easier while leaving the agent able to bypass a broker through other programs. Do not describe it as a hardened engineering sandbox without demonstrating the restrictions in section 22. Pi's own security documentation likewise separates runtime functionality from an enforced operating-system boundary. [S34]

---

## 11. Environment discovery and capability profiles

### 11.1 Environment report

Implement a read-only diagnostic command. Proposed CLI spelling:

```text
simon doctor
```

This is a proposed Simon command, not an existing Siemens command.

Capture:

```text
OS / architecture
TIA installations and versions
TIA update/build identifiers
Openness installation and assembly identities
required runtimes / targeting packs
current user's relevant authorization status
available TIA processes
selected project type and project mode
CPU families / firmware / installed instruction versions where available
installed engineering options and simulator availability
local help availability / content version
available storage / RAM / configured isolation mode
```

The report should redact sensitive paths and identifiers when exported for support.

### 11.2 Capability profile

A capability is keyed by more than TIA major version. Include update, API assembly version, CPU family, object type, representation, and operation.

Example application-level schema; the values below are placeholders, not a verified installation:

```json
{
  "schema_version": 1,
  "environment_id": "env-local-01",
  "tia_major_version": null,
  "tia_update": null,
  "api_assembly_versions": {},
  "verification_status": "not_tested_on_target",
  "capabilities": {
    "project_inventory": {"status": "not_tested", "evidence": []},
    "scl_read": {"status": "not_tested", "evidence": []},
    "scl_write": {"status": "disabled", "evidence": []},
    "fbd_read": {"status": "not_tested", "evidence": []},
    "fbd_write": {"status": "disabled", "evidence": []},
    "compile": {"status": "not_tested", "evidence": []},
    "controller_download": {"status": "out_of_scope", "evidence": []}
  }
}
```

Useful statuses: `documented`, `tested`, `partial`, `unsupported`, `not_tested`, `disabled`, and `out_of_scope`.

### 11.3 Fail closed

A new TIA update, changed assembly identity, unsupported object kind, or unknown serialization format must not silently inherit a tested write capability. Fall back to read-only where safe and report the missing gate.

Do not infer an unsupported capability from another repository's version claim.

### 11.4 Added v0.3 discovery fields

Record the Pi package/release, integration mode (SDK or RPC), loaded extension/tool manifests, approved model/provider route, chat-app commit, Fanqi commit and local patches, and source/review schema versions. Account capability or a successful earlier Codex login is not evidence that Pi has equivalent access.

Record hardware enumeration coverage separately from software retrieval coverage. A generic `project_inventory=tested` flag must not imply every nested I/O module is visible.

---

## 12. Project binding, object identity, and freshness

### 12.1 Bind explicitly

Never choose the first TIA process or first PLC silently. An attachment should identify:

```text
machine identity
Windows/session context
TIA process ID and process-start identity
TIA version/API version
project identity and project path where available
project open-session epoch
selected PLC/device/software container
explicit read/write scope
```

A process ID or file path alone is insufficient. Both can be reused; two copies of a project may contain identically named blocks.

### 12.2 Stable application identities

Use a native stable identifier where the API provides one. Otherwise use a documented composite identity plus a local identifier scoped to the project binding.

Objects should include their device, software-unit/container, group path, kind, name, number when applicable, and revision evidence. Do not assume block names are globally unique.

### 12.3 Freshness model

Each read should return:

- Snapshot identifier and observed timestamp.
- Object revision/fingerprint evidence.
- Project binding epoch.
- Whether the object is fully parsed, partially parsed, protected, or stale.
- Any unsaved-editor uncertainty.

Investigate documented fingerprints and change notifications on the target API. Use tested hashes as a fallback, not an assertion that Siemens has a universal project revision counter.

### 12.4 Human edits win over stale proposals

If the engineer changes an affected block, interface, dependency, approved convention, or relevant configuration after a proposal is created, invalidate the proposal. Re-read, replan, and obtain approval for the new exact change set.

Do not merge project edits speculatively or overwrite the engineer's work based on an old chat turn.

### 12.5 Real-time behavior is bounded

The MVP refreshes on demand, before proposals, after writes, and through conservative polling where useful. Add event-driven refresh only where the API exposes reliable notifications.

Do not advertise keystroke-level synchronization or visibility into uncommitted editor buffers until tested. When uncertain, ask the engineer to commit editor changes through normal TIA actions; do not automatically save the entire project to hide the ambiguity.

---

## 13. Project snapshots and intermediate representations

### 13.1 Three distinct forms of project information

1. **Authoritative engineering project:** The selected TIA project.
2. **Original supported exports and property captures:** Evidence for a particular snapshot, with documented completeness limits.
3. **Parsed views and generated explanations:** Searchable or human-readable derivatives, never silently authoritative.

A block export is not a full-project backup. A Git repository of text exports is useful history, but not necessarily sufficient disaster recovery.

### 13.2 Suggested workspace layout

```text
<Simon-managed workspace>/
  manifest.json
  snapshots/
    <snapshot-id>/
      inventory.json
      objects/
        <object-id>/
          metadata.json
          raw/
          parsed/
          source-map.json
      references.json
      coverage.json
  proposals/
    <proposal-id>/
      intent.md
      change-set.json
      diff.md
      candidate-artifacts/
      validation-plan.json
  documentation-index/
  conventions/
    CodingConventions.md
    ProjectArchitecture.md
    EngineeringRules.md
    Examples/
```

The trusted broker must stage approved artifacts in a separate, agent-nonwritable location. The workspace shown here is not the approval database or the worker's arbitrary filesystem root.

### 13.3 Snapshot manifest

Record environment profile, project binding, export routes, source hashes, format versions, timestamps, coverage, errors, and skipped objects. Preserve the relationship between `.s7dcl` files and their `.s7res` resources.

Use UTF-8 for Simon-owned JSON/Markdown, but preserve original export encodings and line endings where required for re-import.

### 13.4 Suggested normalized object model

```text
ProjectSnapshot
  Device / PlcSoftware / SoftwareUnit
    Block / PlcType / TagTable
      InterfaceMember
      Network / SourceRegion
      InstructionOrCall
      Connection / Operand / Constant
      Attribute / Comment / LanguageResource
      Reference / Dependency
```

Each normalized node should retain a path back to its source snapshot and location. Unknown constructs remain opaque fragments with explicit capability limits.

### 13.5 Parsing principles

- Use proper XML/text parsers, not broad string replacements.
- Disable external XML entities and untrusted resource resolution.
- Preserve unknown namespaces, attributes, language resources, and source fragments.
- Do not reorder graphical networks or calls for aesthetic reasons.
- Do not strip attributes because they appear irrelevant to the LLM.
- Treat parser success, import success, compile success, and functional correctness as different results.
- Keep raw hashes for evidence and conservative normalized hashes for useful diffs.

Do not discard exported identifiers merely because they look generated. Some identify connections or resources. Normalization rules require fixtures and tests.

### 13.6 Internal artifacts, not a mandatory editor mirror

The snapshot/proposal structure is retained for indexing, diff review, provenance, and guarded import. It is not a requirement for a VS Code workspace or user-managed source tree. Materialize files only where needed by supported export routes, Pi's scoped tools, the diff viewer, or validation.

The backend must distinguish original raw artifacts, display-normalized views, edited candidates, trusted immutable staging, and post-import readback. An AI summary or pretty-printed XML view is never silently substituted for the exact candidate authorized for import.

---

## 14. SCL and graphical-language handling

### 14.1 SCL first, but project context remains mixed-language

Initial edits should be limited to supported non-safety SCL FCs/FBs and verified operations. Use the representation that preserves the necessary engineering information on the target build, not automatically the smallest text file.

An SCL body change can affect more than that file. Include the block interface, instance relationships, referenced types, and relevant callers in the analysis boundary.

### 14.2 FBD understanding

For supported graphical exports, preserve network order, operations, operand connections, execution conditions, instance references, and source locations. The parser should make the network intelligible without pretending it is ordinary sequential text.

Possible derived explanation:

```text
Network 4: restart permission
- Identifies the signals and state participating in the decision.
- Describes the conditions under which an operation executes.
- Links each statement to the original network and exported constructs.
- Marks unsupported instructions or unresolved state explicitly.
```

Do not invent wire connections or treat a screenshot as more authoritative than a valid structured export.

### 14.3 FBD edits: start with an allowlist

Examples of candidate edit classes to test, not pre-approved capabilities:

- Change a literal at a known typed instruction parameter.
- Replace an operand reference with another compatible approved operand.
- Update a comment or title without affecting logic.
- Apply a narrowly defined network transformation whose semantics are covered by fixtures and simulation.

Arbitrary graphical regeneration, language conversion, and large network restructuring are later research features.

### 14.4 Preservation checklist

For every supported route, determine how to preserve and compare:

```text
block identity and language
interface directions, order, types, defaults, and attributes
optimized/non-optimized access properties where applicable
instance DB / multi-instance relationships
retentivity-related settings
block and network comments in project languages
instruction and library version references
network topology and execution order
OB classification and scheduling properties, when applicable
other relevant metadata identified during route validation
```

OBs, protected content, safety content, and unsupported library-managed objects remain read-only until independently qualified. Do not use a known lossy OB route and attempt to repair it from a guess.

### 14.5 PDF/print support is supplementary

The user's original print-to-PDF idea remains useful for visual reference, legacy documentation, or gaps in structured access. It is not the primary code-ingestion route.

For a PDF-derived explanation, retain the source page, extraction method, uncertainty, and whether an engineer verified it. OCR is a fallback, not the default. Never import code generated solely from a diagram reconstruction as an equivalent replacement without a separate review and verification project.

### 14.6 Unknown is a valid result

A partial project view is acceptable when clearly labeled. Silently dropping unsupported networks, instructions, comments, or blocks is not acceptable.

### 14.7 Accepted SCL and FBD/LAD review behavior

**Requirement:** use a source-code diff for supported SCL changes and a text XML diff for FBD/LAD changes, displayed in the reused chat UI. Provide a brief explanation that names the affected block, network, instruction/operand, and intended behavior. This implements the user's accepted review choice; a summary must not replace access to the actual diff.

For a supported timer edit, an illustrative XML excerpt could show:

```diff
- <ConstantValue>T#5s</ConstantValue>
+ <ConstantValue>T#10s</ConstantValue>
```

This excerpt is illustrative, not a complete Siemens import document or proof that every timer uses that representation. Preserve source mapping to the real export.

The comparison must expose changed connections, identifiers, interface fields, attributes, and language resources where present. Do not hide generated-looking IDs, reorder networks/wires, or relabel a wiring change as a cosmetic change without a tested normalization rule. Offer the raw artifact comparison when the display is normalized, and bind approval to the actual candidate bytes and dependencies.

A 'no textual changes' result does not prove no semantic/metadata changes, and a large XML diff does not prove a large behavior change. Include known parser limits. Graphical before/after rendering is later and is not required to ship this review view.

**Displaying or preparing an XML proposal is separate from enabling its write path.** Before a graphical write is enabled, the route/edit-class preservation and semantic gates in sections 14.3, 20, 21, and 29 still apply. The initial SCL-first write scope remains unchanged.

---

## 15. Retrieval and codebase indexing

### 15.1 Three retrieval mechanisms

**Exact retrieval:** Symbols, block names/numbers, tag names, addresses, type names, instruction names, and paths.

**Dependency traversal:** Callers, callees, type usage, instance relationships, and read/write references.

**Semantic retrieval:** Natural-language concepts such as "pump restart sequence" or "communication retry logic."

Do not begin by embedding the entire project and hoping similarity search will replace symbol resolution.

### 15.2 Proposed local implementation

Use structured tables plus SQLite FTS5 for the initial full-text index. FTS5 is SQLite's documented full-text-search module. [S22]

Use application-level edges for dependency traversal before adding a graph database. Add embeddings only when evaluation shows useful gaps in lexical and structural retrieval.

`pgvector` is an optional later PostgreSQL-based vector-search choice, not a requirement for Simon's architecture. No database server is required for the initial design.

### 15.3 Indexing units

Useful units include block interfaces, source regions/networks, tags, types, comments, documented instruction topics, and approved example patterns.

Avoid slicing a block into arbitrary text chunks that separate a call from the interface or state needed to understand it. Context packaging should include the necessary surrounding declarations and source links.

### 15.4 Retrieval flow

```text
User question
  -> resolve explicitly named objects
  -> refresh stale source if permitted
  -> collect interfaces and direct dependencies
  -> lexical search for supporting context
  -> optional semantic retrieval
  -> version-filtered documentation lookup
  -> bounded context package with citations and coverage
  -> answer or proposal
```

### 15.5 Coverage and ambiguity

Store unresolved references, indirect accesses, protected objects, missing exports, and parser coverage. Absence from the index is not proof that an object is unused.

Cross-reference results from TIA and parser-derived edges should retain separate provenance. Do not merge them into an unexplained certainty score.

### 15.6 Incremental refresh

Cache by object snapshot hash and parser version. Refresh changed objects and invalidate dependent summaries. A user request affecting a dependency should trigger targeted refresh rather than a complete project export by default.

### 15.7 Retrieval evaluation

Create a small engineer-approved question set with expected objects and reference locations. Measure correct retrieval, stale-source avoidance, unnecessary context size, and whether the answer discloses missing coverage.

Only add embeddings or reranking after identifying actual retrieval failures.

---

## 16. Version-aware Siemens documentation retrieval

### 16.1 Discovery task on the TIA machine

Investigate the installed help viewer and content storage through normal authorized inspection:

- What process serves the viewer?
- Which address/port is configured?
- Where are content packages stored?
- Is content accessible as files, structured packages, or documented local endpoints?
- How are language, product, version, and topic identity represented?
- Is there a supported export or search mechanism?
- What is allowed for local indexing and redistribution?

Do not reverse-engineer protected content, bypass access controls, expose the help service externally, or assume its internal API is stable.

### 16.2 Source order

Prefer documentation matching the installed environment. When unavailable, use authorized official online documentation with an explicit version label. Older or newer documentation can be useful background, but must not be presented as target-specific proof.

### 16.3 Suggested document record

```text
document_id
product
TIA version/update applicability
CPU family / firmware applicability, when known
instruction name and version, when known
language
title / headings
official URL or local source identifier
content hash
extraction method
indexed_at
applicability status
```

Unknown applicability stays unknown. The model must not fill firmware fields from memory.

### 16.4 Answer requirements

Technical claims about instruction behavior should cite the retrieved topic and state version constraints. When the available documentation is insufficient, Simon should report the gap and avoid a write based on an unsupported assumption.

Documentation text is reference data, not an authority to run commands or change engineering policy.

### 16.5 Distribution and privacy

Keep proprietary help content out of the public Simon repository. Store links, metadata, retrieval code, and small permitted fixtures instead. Determine rights before redistributing indexed manuals or sharing them with an external service.

---

## 17. Coding conventions and the Simon engineering skill

### 17.1 Approved project knowledge

Use four complementary sources:

```text
CodingConventions.md     Naming, structure, comments, and formatting
ProjectArchitecture.md  Project organization and approved design patterns
EngineeringRules.md     Behavioral constraints and protected scope
Examples/               Approved reference implementations with provenance
```

These are user/project artifacts, not generic assumptions about how all Siemens projects are written.

### 17.2 Convention inference workflow

Read a representative authorized project, identify repeated patterns, distinguish majority patterns from exceptions, and generate a draft with examples. The engineer reviews it before activation.

An inferred preference should include where it came from. A legacy workaround, historical bug, or accidental inconsistency is not automatically a rule.

### 17.3 Deterministic checks versus guidance

Possible deterministic checks include naming patterns, required sections, forbidden symbols, interface-change detection, and disallowed objects.

Design quality, process intent, and behavioral equivalence require deeper review. Do not label a style linter as functional verification.

### 17.4 The Simon engineering skill

The future skill should teach the agent this workflow:

```text
Inspect project binding and capabilities.
Read the relevant source and dependencies.
Consult applicable documentation.
Read approved project conventions.
State intended behavior and invariants.
Prepare a bounded change set.
Explain its impact and verification plan.
Request independent review/approval.
Apply only through approved tools.
Inspect compiler and post-import results.
Report remaining uncertainty and recovery status.
```

The skill may provide reusable templates for explanations, impact reports, and test plans. Do not place the full Siemens documentation corpus into the always-loaded instruction file.

### 17.5 Skills do not grant permissions

A statement such as "never download to the PLC" belongs in the skill, but enforcement belongs in the tool surface, broker, worker, and operating-system/network boundaries.

An instruction file modified by a repository or model must not change write permissions. Changes to approved conventions also invalidate affected proposals.

### 17.6 Pi resource package and recovered instructions

Retain the v0.2 engineering workflow, conventions, and verification checklist. Package its approved instructions for the pinned Pi loader rather than placing the entire handoff or manuals in an always-loaded system prompt. Instruction paths and loader configuration are implementation details to verify against the chosen Pi version.

Maintain a small trusted engineering instruction entry point, task-specific skills, approved examples, and retrieval tools. Record their revisions on proposals. A prompt/skill improvement is a behavior change to review, not an authority grant; the agent cannot edit its way around broker policy.

The runtime package should distinguish engineering tasks from app-customization tasks. The customization session gets a separate workspace and grants, not the engineering session's blanket context or plant access.

---

## 18. Tool contracts and the approval boundary

All names in this section are **proposed Simon API names**, not Siemens method names.

### 18.1 Small initial tool surface

| Tool | Purpose | Permission |
| --- | --- | --- |
| `environment.inspect` | Read target environment and capability report. | Read-only |
| `project.list_instances` | Enumerate permitted candidate attachments. | Read-only |
| `project.bind` | Bind to an explicitly selected engineering scope. | User-controlled selection |
| `project.inventory` | Read supported object inventory and coverage. | Read-only |
| `project.read_object` | Read an object and its revision evidence. | Read-only |
| `project.find_references` | Retrieve supported reference information. | Read-only |
| `knowledge.search` | Search project/docs/conventions with source metadata. | Read-only |
| `change.prepare` | Create a staged proposal, not a TIA write. | Proposal-only |
| `change.validate` | Run permitted static or isolated-copy validation. | Scope-bound |
| `change.request_review` | Open the exact proposal for human review. | Cannot approve itself |
| `change.apply` | Execute an independently approved immutable proposal. | Broker-enforced write |
| `operation.status` | Read long-running operation state and evidence. | Read-only |

Use separate permissions for operations that are not pure reads, even when they do not download anything. Compilation, archival, saving, and opening a validation copy have their own side effects and prerequisites.

### 18.2 No generic escape hatch

Do not expose:

```text
run_arbitrary_powershell
execute_csharp
invoke_any_openness_method
import_any_file_from_any_path
write_any_project_property
approve_change_as_agent
```

Development/debugging tools must not accidentally become production agent tools.

### 18.3 Change-set contract

Illustrative application-level JSON:

```json
{
  "schema_version": 1,
  "change_set_id": "change-example-001",
  "project_binding_id": "binding-example-001",
  "snapshot_id": "snapshot-example-001",
  "intent": "Modify a bounded non-safety SCL implementation",
  "policy_version": "policy-example-001",
  "conventions_revision": "conventions-example-001",
  "changes": [
    {
      "object_id": "object-example-001",
      "operation": "replace_supported_source",
      "expected_revision": "revision-example-001",
      "artifact_id": "artifact-example-001",
      "interface_change_allowed": false
    }
  ],
  "invariants": [
    "Preserve the public interface",
    "Preserve declared project-specific behavior outside the requested change"
  ],
  "validation_plan_id": "validation-example-001",
  "status": "awaiting_review"
}
```

### 18.4 Approval design

An approval must be created through a trusted engineer-controlled surface and bound to:

- Exact change-set digest and immutable candidate bytes.
- Target project binding and affected objects.
- Expected revisions and policy/convention versions.
- Allowed operation scope and expiry.
- Review identity and single-use state.

`confirm=true` in an agent tool call is not human approval. The model must not mint its own authorization or alter staged bytes after approval.

A narrowly scoped execution handle may be returned to the agent after approval, but the broker must verify it and consume it once. The agent cannot access the approval-signing secret or modify the broker's decision store.

### 18.5 Tool results

Return structured data with source locations, warnings, evidence, and operation state. Never report success solely because an API call returned without throwing.

For long operations, return an operation identifier and support status polling. A client timeout is not proof that a mutation did not happen.

### 18.6 Manual approval versus Auto execute

**User-reported existing UI:** `mcp-agent-chat` has Manual approval and Auto execute modes. Keep these as recognizable user controls; inspect their actual implementation before mapping them to Simon. The user asked how they relate to the plan and has not authorized unrestricted automatic TIA writes.

There are three separate questions:

1. **Interaction:** must the UI interrupt for this individual tool call?
2. **Authorization:** is this exact operation on this exact target permitted by a trusted user decision or scoped policy?
3. **Engineering validation:** are the representation, source freshness, candidate bytes, prerequisites, verification, and recovery conditions satisfied?

An Auto execute setting answers the first question within its granted scope. It does not remove questions two and three. Pi prompt instructions or a client-side 'approved' flag are not the engineering permission system.

**Proposed initial mapping; original-project approval remains the v0.2 baseline:**

| Operation | Manual approval mode | Auto execute mode |
| --- | --- | --- |
| Approved-scope read/search/documentation retrieval | Follow the configured per-call prompting preference. | Run without repeated prompts once project and data-sharing scope are granted. |
| Prepare a draft or calculate its diff | May request confirmation under the manual setting; no original-project write. | May proceed automatically in the scoped draft workspace. |
| Validate/import/compile on a disposable copy | Require explicit experiment scope or per-operation approval. | Only within a separately granted, bounded copy-only validation policy. |
| Apply a change to the original offline TIA project | Approve exact immutable change set and declared follow-up steps. | Same exact-change approval gate in v0.3; routine investigation need not prompt repeatedly. |
| Compile after an approved apply | May run as an explicitly included step in that approval. | May run as an explicitly included step in that approval; not a blanket write grant. |
| Save project, activate executable customization, publish a contribution | Must be explicitly authorized for the relevant scope. | Not silently inherited from generic tool auto-execution. |
| Download/force/RUN-STOP/safety authoring/excluded operations | Unavailable. | Unavailable. |

A multi-step approved change can run its declared import/compile/readback sequence without asking for every underlying call. That is different from approving arbitrary new patches, new targets, or a compile-fix loop. Any changed candidate, target, policy, or relevant project revision invalidates the original authorization.

The UI must explain effective scope, for example: **'Auto execute: reads and draft preparation. TIA project changes still require approval.'** This wording is a proposed safe default, not a claim about how the existing application currently behaves.

Whether Auto execute should eventually authorize narrowly bounded original-project writes in advance is an **open product decision**. Do not enable that merely because the source app has a global toggle. If later approved, implement it as explicit, revocable backend policy with target/operation limits, audit evidence, budgets, and unchanged freshness/verification requirements.

### 18.7 Test for approval integration, not just a visible button

Test denial, expiry, duplicate clicks, changed bytes, wrong project, reconnect, queued calls, and an agent attempting to send its own approval. An approved routine tool call does not approve another engineering proposal. Changing modes while an operation is pending must not retroactively authorize it or restart it.

The backend must continue to enforce policy when a client calls the tool endpoint directly or the chat UI is disconnected. A frontend-only approval modal is not a substitute for this boundary.

---

## 19. The controlled change pipeline

### 19.1 State machine

```text
DRAFT
  -> STATIC_VALIDATED
  -> READY_FOR_REVIEW
  -> APPROVED
  -> PRECONDITIONS_RECHECKED
  -> APPLYING
  -> APPLIED_UNVERIFIED
  -> COMPILED
  -> POST_VERIFIED
  -> READY_FOR_ENGINEER
```

Alternate states:

```text
REJECTED
STALE
BLOCKED_UNSUPPORTED
FAILED_BEFORE_MUTATION
PARTIALLY_APPLIED
RECOVERY_REQUIRED
RECOVERED
OUTCOME_UNKNOWN
CANCELLED_BEFORE_MUTATION
```

`READY_FOR_ENGINEER` does not mean downloaded, commissioned, or proven safe for operation.

### 19.2 Read and plan

Read the affected objects, interfaces, known dependencies, conventions, and applicable documentation. Define the goal and the invariants before producing code.

Capture existing compiler errors when a baseline compile is authorized and practical. Do not quietly attribute all pre-existing failures to Simon's patch or ignore newly introduced warnings.

### 19.3 Prepare and validate

Generate candidate source in the proposal workspace. Run format/schema checks and supported static checks. Resolve all proposed object identities against the bound project.

For immature mutation routes, validate on a disposable project copy first. Do not claim that independent text parsing substitutes for TIA compilation.

### 19.4 Review

Show the exact source diff, semantic summary, affected-object list, dependency impact, metadata-preservation checks, test plan, unknowns, and restore plan.

Separate behavior changes from cosmetic cleanup. Do not bundle unrequested project-wide renaming into a local fix.

### 19.5 Recheck immediately before mutation

Verify project identity, project epoch, offline prerequisites, supported operation profile, current revisions, policy state, staging hashes, and approval scope.

Acquire the relevant exclusive access or operation lock for the shortest validated interval. Do not hold TIA locked while waiting for the LLM or human review.

### 19.6 Apply

Use only tested operations in the declared scope. Journal intent before sending a mutation and record confirmed outcomes afterward. Reject any unexpected target expansion.

Where native transaction support applies, use it for the mutation stage only. Do not claim multi-object atomicity unless all selected operations have been tested within that boundary.

### 19.7 Compile and verify

Compile outside the mutation transaction. Re-export/read back the affected scope and compare required properties, references, and intended changes. Validate that unrelated source did not change unexpectedly.

Compilation and post-verification results are separately visible. A compiling block with a changed interface or lost attribute has not passed verification.

### 19.8 Engineer handoff

Report what changed, what was checked, what remains untested, whether the project is saved or unsaved, and how recovery is available. Do not automatically save the entire project unless that action was separately authorized.

---

## 20. Transactions, compilation, and recovery

### 20.1 Do not implement this pattern

```text
Open Openness transaction
  Import all changes
  Compile project
  Save project
  Roll everything back if compile fails
```

That conflicts with the documented transaction restrictions. [S05]

### 20.2 Supported design direction

```text
Prepare and validate candidate artifacts
  -> establish tested recoverable baseline
  -> review and authorize
  -> acquire supported exclusive access
  -> recheck preconditions
  -> perform permitted mutation transaction
  -> close transaction
  -> compile outside transaction
  -> verify postconditions
  -> finalize status OR execute guarded compensation
```

Whether exclusive access can safely span additional steps must be verified for the chosen operations. Do not assume transaction disposal, exclusive-access disposal, and compiler lifecycle are identical.

### 20.3 Recovery hierarchy

Use native rollback for mutations still inside a failed transaction. After a completed transaction, restoration is a separate engineering operation.

Possible recovery mechanisms, to be tested:

- Restore supported affected objects from a verified pre-change baseline.
- Reopen a known recoverable project copy through an approved workflow.
- Present explicit manual recovery when safe automated restoration cannot be guaranteed.

Do not rely solely on UI Undo history or a raw filesystem copy of an open project. Establish a supported snapshot/archive/copy mechanism and demonstrate restoration on a disposable project.

### 20.4 Protect concurrent human work

Automated compensation may proceed only when the current state matches the expected post-write state within the recovery scope. If the engineer or another application has changed it, stop and present a conflict.

Never restore an entire old project over new unrelated human edits to make a failed patch disappear.

### 20.5 Timeouts and crashes

A worker crash, bridge disconnect, or timeout during mutation yields `OUTCOME_UNKNOWN` until reconciled. Do not replay the write blindly.

Use a durable operation journal and reconcile by reading the project state. Retry read-only operations where safe; mutation retries require proof that the previous attempt did not already take effect or a verified idempotency mechanism.

Do not terminate the user's TIA process automatically to recover Simon. Worker disposal must not close a TIA instance Simon merely attached to.

### 20.6 Compile-driven repair loops

Bound retries, changed objects, time, and model budget. Every candidate revision has a new digest. New live-project changes require approval; previously approved content does not authorize an arbitrary repair loop.

An engineer may approve a narrowly defined experiment on a disposable copy. That authority must not be reused against the original project.

---

## 21. Functional verification and PLC semantics

### 21.1 Verification ladder

Keep these statuses distinct:

```text
Source parses
  -> export/import route is supported
  -> intended metadata is preserved
  -> TIA compilation passes
  -> relevant tests pass in an isolated environment
  -> engineer accepts the change
  -> separate commissioning process, outside Simon MVP
```

### 21.2 Required engineering review topics

The following are proposed review requirements, not a claim that Simon can automatically prove all of them:

- Scan order and the timing of assignments and calls.
- Stateful function blocks, instances, and multi-instance storage.
- Timer/counter state and whether calls occur every relevant cycle.
- Edge-detection behavior and initialization.
- Set/reset priority and multiple writers to an output or state.
- Enable/execution conditions in graphical logic.
- Temporary versus persistent storage and startup behavior.
- Retentivity, initialization, and restart assumptions.
- Type widths, conversions, signedness, ranges, and overflow behavior.
- Asynchronous instruction handshakes and status handling.
- Address-based interfaces and external consumers.
- HMI/SCADA or communication dependencies not fully represented in the selected scope.
- Safety-related dependencies or unknown process consequences.

For specific instruction semantics, retrieve the applicable Siemens documentation rather than relying only on this checklist.

### 21.3 Tests should describe observable behavior

Example categories:

```text
normal startup and shutdown
permissive absent
fault enters during operation
fault clears without reset
reset held versus reset edge
simultaneous start/stop requests
timer boundary cases
warm/cold restart scenarios where relevant
invalid input ranges
communication error and retry behavior
```

The engineer must define expected outcomes for the actual machine. Simon should not invent a process-safety requirement from an instruction name.

### 21.4 Simulator use

Simulator availability, licensing, CPU compatibility, APIs, and network isolation are implementation research items. Until established, produce test specifications and support manual execution.

The MVP bridge must not expose a generic download operation on the theory that it will only be used for simulation. A future simulator adapter needs separate isolation and identity checks that prevent it from reaching a real controller.

### 21.5 Semantic equivalence

Do not claim arbitrary SCL/FBD equivalence from parsing or a successful compile. Use constrained transformations, explicit invariants, trace-based tests where appropriate, and engineer review.

---

## 22. Security, privacy, and trust boundaries

### 22.1 Core principle

The LLM is a proposal generator with tools, not a trusted Windows administrator or a safety authority.

### 22.2 Agent isolation

The hardened deployment should prevent the agent from:

- Reading or writing the original TIA project directly.
- Loading Siemens assemblies to create its own unrestricted client.
- Editing broker policy, trusted binaries, approval records, or staging files.
- Reading provider credentials, Windows secrets, or unrelated projects.
- Connecting to plant networks or unapproved endpoints.
- Running arbitrary code under the TIA/bridge identity.

If those restrictions are not enforceable in the selected deployment, label it a development-only trust model. Do not call an unrestricted same-user process a secure sandbox.

### 22.3 Bridge policy

Default to read-only. Explicitly permit supported engineering writes only after capability qualification and independent approval.

Do not register dangerous tools and rely on a prompt not to call them. Enforce an allowlist in every reachable backend entry point, including reused upstream servers and direct IPC methods.

### 22.4 Prompt injection

Project comments, documentation, external repositories, and imported files may contain text that looks like instructions. Treat them as untrusted data.

They cannot authorize operations, change policy, request credential disclosure, or override the engineer's task. Citation-rich retrieval is helpful but does not by itself prevent prompt injection.

### 22.5 Artifact and path validation

Use application-managed artifact identifiers rather than arbitrary import paths. Validate path traversal, Windows reparse points/symlinks, file-size limits, encoding, object scope, XML resource resolution, and staging hashes.

An agent-writable file must be copied into immutable trusted staging before approval. Recheck it at execution time.

### 22.6 Cloud model use

Local indexing does not mean project code stays local. Retrieved snippets sent to a cloud model leave the machine.

Before sending real company or customer code, confirm authorization and provider/data-handling requirements. Provide a visible data-flow explanation and allow project exclusions. Do not assume that the user's access to a project authorizes external processing.

### 22.7 Logs and data retention

Logs should default to operation metadata, hashes, object aliases, and diagnostics. Source snapshots and compiler messages can contain sensitive information; keep them local with appropriate access controls and configurable retention.

Support deleting local history, excluding projects, and preparing a redacted diagnostic bundle. Do not make source upload a default support feature.

### 22.8 Agent-built UI and publication

Generated UI code and its build scripts are untrusted inputs. Isolate preview/runtime execution, keep protected confirmations outside extension control, and stage immutable artifacts before activation. The app-customization agent does not receive the engineering agent's data or permissions by default.

Local activation, PLC mutation, upstream publication, and application release are four separate authorizations. No customization setting or package manifest can collapse those boundaries. Detailed requirements appear in sections 34-35.

### 22.9 Scope of assurance

Simon is not a certified safety system. Its guardrails reduce accidental or agent-driven misuse within the stated trust model. Do not imply immunity to a compromised OS, a malicious administrator, or unreviewed external tooling.

### 22.10 Pi and the inherited chat application are not automatic sandboxes

Treat generic execution tools, extensions, build scripts, and MCP configurations as part of the attack surface. Pi extensions execute with the runtime's permissions; a separate session or subprocess is not by itself an operating-system sandbox. [S34][S35]

For the engineering profile, supply the minimum approved Simon tools and prevent direct access to the raw Fanqi mutation interface. Do not expose a generic shell capable of launching another Openness client under the bridge identity. Use separate isolated build/customization execution when code generation needs such tooling.

Inspect the existing chat app's authentication, IPC/API routes, approval handling, resource loading, and secrets before reusing it as the trusted approval surface. A previously functional Codex chat integration establishes usability, not this security property.

---

## 23. Storage, events, and provenance

### 23.1 Proposed local storage

Use SQLite for metadata and application-managed files for exports, proposals, and documentation snapshots. The agent must not receive direct write access to policy/approval tables.

Suggested tables:

```text
environments
capability_profiles
project_bindings
project_snapshots
engineering_objects
object_revisions
source_artifacts
reference_edges
document_topics
document_chunks
convention_revisions
change_sets
change_items
approvals
operations
operation_events
compile_runs
compile_diagnostics
verification_results
recovery_baselines
```

Do not create every table before the first vertical slice. Preserve the domain boundaries while implementing incrementally.

### 23.2 Event envelope

```json
{
  "schema_version": 1,
  "event_id": "event-example-001",
  "event_type": "change.post_verification.completed",
  "occurred_at": "2026-09-07T12:00:00Z",
  "project_binding_id": "binding-example-001",
  "operation_id": "operation-example-001",
  "change_set_id": "change-example-001",
  "source": "simon_verifier",
  "result": "passed",
  "evidence_ids": ["evidence-example-001"]
}
```

The event above is illustrative. Do not seed production analytics with invented successful operations.

### 23.3 Provenance categories

```text
openness_reported
original_export
parser_derived
official_documentation
user_approved_convention
compiler_reported
simulator_observed
model_generated_explanation
manual_engineer_review
```

A model explanation must not be relabeled as a compiler result or official instruction behavior.

### 23.4 Integrity and retention

Use content hashes, schema versions, timestamps, and operation IDs. A hash helps detect changes; it is not proof of authorship or correct behavior. Document what is protected from the agent and what remains mutable by the trusted user.

### 23.5 Customization storage

Use the user-scoped `.simon` structure in section 34.6 for editable extension source, layouts, local history, and contribution drafts. Keep it distinct from engineering indexes, source snapshots, and protected policy/approval storage. Only explicit sanitized candidates may be published.

Add customization revisions, validated artifacts, activation records, capability grants, and contribution states as needed; do not put authoritative permission records in an agent-writable database.

### 23.6 Relationship to Velocity

Simon and Velocity are separate products. Simon may later emit ordinary session/tool/operation telemetry useful to Velocity, but it must not depend on Velocity to function.

Keep that optional export metadata-first. Do not couple the two databases or delay the Simon MVP to build shared infrastructure.

---

## 24. Pi runtime and integration with the existing chat backend

### 24.1 Accepted runtime decision

**Pi is the default and sole planned harness for v0.3.** Keep its integration in a clear module, but do not build a runtime marketplace, multiple adapters, or a universal harness abstraction. Other runtimes may be reconsidered only through a later explicit decision.

The existing app used Codex as a complete runtime plus model/account integration. Reusing its frontend does not retain the Codex harness underneath Pi. A selected OpenAI model in Pi still runs inside Pi; it is not automatically Codex CLI. Historical Codex smoke tests remain useful bridge evidence, not evidence of Pi integration.

Pi owns generic agent execution. Simon owns its engineering instructions, context retrieval, scoped tools, project state, authorization, and verification. Customizing Pi does not mean extensively forking its core.

### 24.2 SDK or RPC: choose from the existing handoff

**External documentation check for this revision:** Pi documents a TypeScript SDK for in-process Node.js/Bun use and an RPC interface for controlling a subprocess. Its SDK can provide sessions, resources, models, tools, and events; RPC exchanges structured records rather than requiring terminal-screen scraping. [S32][S33]

| Existing application situation | Proposed integration |
| --- | --- |
| Suitable Node.js/TypeScript backend and compatible trust boundary | Embed the pinned Pi SDK in the agent-side host. |
| Another backend language, or a deliberate separate runtime process | Start a pinned Pi RPC subprocess and map its commands/events. |

Neither option authorizes the runtime to share the privileged bridge identity or approval store. Decide placement using section 10, not convenience alone. The backend stack is not known until the user-supplied `handoff.md` and source are inspected. Do not rewrite it just to select one of these options.

Pin the release, package identity, runtime requirements, and integration API. The currently inspected documentation must not silently override the installed package's actual contracts. Reuse the appropriate checked upstream examples during implementation; pseudocode in this handoff is not a Pi API specification.

### 24.3 Existing `mcp-agent-chat` intake and migration checklist

Before modifying that project, record:

- Frontend/backend technologies, launch flow, process ownership, transport, and project/repository commit.
- What the reported 'AMCP' integration actually denotes in source; do not guess the protocol from its name.
- Codex-specific authentication, session IDs, event schemas, tool registration, cancellation, and history storage.
- Which slash commands are UI actions, runtime actions, prompt templates, or external-tool operations.
- What Manual approval / Auto execute currently enforce in the backend, not just what the button says.
- Which UI elements already exist and which must be added: object binding, exact diffs, proposal identity, compile status, recovery, and source links.
- Credential storage, extension loading, outbound data policy, and any generic shell/backend escape paths.

Preserve the working app in version control. Implement and test the Pi path with synthetic data first. Retain historical transcripts as history where possible, but do not import incompatible Codex tool-call state as a live Pi session or silently discard old history.

This intake is a concrete missing implementation input, not a reason to redesign the product or invent the handoff's content.

### 24.4 Conversation, project, and operation identity

**Proposed Simon contract:** map each conversation to a Pi session and an explicit engineering context. Record at least:

```text
conversation_id
pi_session_id / selected session storage handle
project_binding_id and binding epoch
environment/capability profile revision
approved model/provider access route
engineering instruction and conventions revisions
allowed tool set and execution-mode policy revision
active proposal and engineering operation IDs
```

These are application fields, not claimed Pi API property names. Do not share mutable project scope between conversations. Switching the bound project must invalidate pending write grants and update the visible target; stale tool results cannot silently become context for another project.

Pi session context and Simon's operation journal have different jobs. Session history supports the conversation; the engineering journal establishes what was authorized, attempted, applied, compiled, and verified. Compaction or session deletion must not erase the authoritative write/recovery record without the separate retention policy.

### 24.5 Pi resources and tool registration

Pi exposes extension mechanisms for custom tools, commands, and event hooks. Its documentation also permits agent-authored extensions, but that is extensibility, not a guarantee of safe self-improvement. [S35]

Register only the intended Simon engineering tool surface. Two possible implementations are custom Pi tools calling Simon's application service, or a Pi MCP integration connected to a restricted Simon endpoint. The endpoint behind that interface may call the selected Fanqi bridge. Choose one path per operation and avoid duplicate, differently authorized tools.

Do not connect an unrestricted Fanqi server to Pi alongside the policy-controlled Simon tools. Do not load arbitrary extensions discovered in exported customer project folders. Use explicit trusted resource paths and scoped working directories.

**Version-sensitive note:** the Pi SDK documentation inspected for v0.3 describes CLI-provided built-in extensions that are not automatically enabled by SDK session creation, including its MCP integration. Verify and explicitly configure the selected release; neither 'MCP never exists in Pi' nor 'MCP is always loaded' is a valid permanent assumption. [S32]

### 24.6 Event mapping to the unchanged chat UI

**Proposed application behavior:** keep the familiar frontend while mapping the new runtime's events to the app's display model. Separate text messages, tool activity, source references, proposal readiness, authorization state, and engineering-operation results. Use stable IDs and explicit completion/error states.

Do not drive UI behavior by scraping terminal output or asking the LLM to produce fake status messages. Never map an assistant sentence such as 'compiled successfully' to a passed compile badge without the compiler-reported operation evidence.

For an RPC implementation, process structured stdout independently from diagnostic stderr, correlate requests, and account for asynchronous execution. A protocol acknowledgement is not task completion. Validate the selected release's run-settled and cancellation semantics. [S33]

Closing the UI or cancelling a model run must not be described as undoing a TIA mutation. Resume status from the engineering journal and reconcile pending operations before accepting more writes.

### 24.7 Slash commands and context budgeting

Preserve useful existing commands, but map their meaning explicitly. Commands to select project, inspect diagnostics, request a diff, or change review mode are host-controlled actions; they are not arbitrary model text or permission grants. Runtime-specific unsupported commands should be disabled or explained, not forwarded to a shell.

Possible Simon commands such as `/project`, `/review`, `/docs`, and `/customize` are design examples, not existing installed commands. Select exact names after inspecting the app and Pi's command registry to avoid collisions.

Supply a small engineering instruction layer and retrieve project/docs/conventions on demand. Keep project scope and capability restrictions in trusted backend state, not solely in model context that may be compacted. Retrieve large artifacts in bounded ranges with exact source locations and coverage.

### 24.8 Providers, subscriptions, and model selection

The UI may expose supported provider/model choices within Pi. A model change does not create another harness or change the engineering tool implementation. Preserve the selected model/access route in session/proposal evidence and show actual failures rather than substituting a different billed service silently.

The user's working Codex subscription login is a reported existing capability, not a transferable Pi credential. Use the selected Pi release's supported login/API mechanism, verify current provider permissions, and never extract or replay unrelated application credentials.

Do not promise a particular subscription's included quota, price, or availability from this plan. If the intended route is unsupported or unavailable, disclose the limitation and let the user explicitly choose an authorized alternative; do not auto-switch to a paid API or another provider.

### 24.9 Runtime acceptance tests

Before real project writes, demonstrate:

1. The existing UI can create, resume, and stop a Pi conversation with explicit project identity.
2. Tool calls reach the same Simon policy boundary in Manual approval and Auto execute modes.
3. Denied, expired, altered, or wrong-project proposals cannot run.
4. Runtime interruption, reconnect, compaction, or provider error cannot replay or falsely finalize a TIA write.
5. Unavailable commands, models, or credentials produce accurate UI states.
6. Engineering sessions cannot acquire customization/build/publication privileges through an extension or command.

A terminal-only Pi smoke test is useful for debugging, but it is not the intended final frontend and does not replace UI/backend contract tests.

---

## 25. Existing chat application and engineering review surfaces

### 25.1 Accepted interaction model

Use the user's existing `mcp-agent-chat` UI and suitable backend components as the application foundation. TIA Portal stays open as the manual engineering editor. Pi runs behind the application; neither VS Code nor a Pi terminal is required for normal use.

The user has reported chat/pop-up behavior, slash commands, subscription-based Codex access, and two execution settings. Their implementation is not available in this handoff. Do not mark new diff/review, Pi, indexing, or TIA features as already present.

Start with a focused chat workspace, target/status banner, operation history, documentation/source results, and a change-review view. Do not rebuild TIA's full project browser, hardware editor, or FBD/LAD programming canvas.

### 25.2 Always-visible project and policy context

Show selected machine, TIA version/build, project, PLC/device, offline engineering mode, snapshot freshness, parser/write coverage, and current execution-policy scope. Users must not infer which of several open projects is targeted.

Display Manual approval / Auto execute in the familiar interface, with an explanation of what the mode actually authorizes. Section 18.6 distinguishes routine tool prompts from exact engineering-change approval. Do not show an unrestricted-looking 'Auto' control while silently relying on prompt instructions for enforcement.

### 25.3 Review card

```text
SIMON CHANGE REVIEW

Target:           <project / PLC / object / network when applicable>
Environment:      <TIA build / qualified route>
Intent:           <requested behavior or refactor>
Objects changed:  <count and paths>
Interface impact: <none / present / unknown>
Source freshness: <verified baseline revision>
Proposal:         <immutable revision/digest>
Validation:       <static / disposable-copy compile / not yet run>
Unverified:       <behavior or coverage gaps>
Recovery:         <tested baseline and scope>
Planned effects:  <import / compile / readback / save if separately included>

[SCL or XML diff] [Impact] [Documentation] [Tests]

[Reject] [Request revision] [Approve this exact change]
```

This is a review component in the existing app, not a full code editor. It must remain usable without requiring the user to open an exported file in another program. The trusted host owns its approval event and target/proposal identity.

Do not present an unexplained confidence score as a substitute for evidence. Compiler success, post-import verification, and behavioral testing are distinct statuses.

### 25.4 SCL/XML diff behavior and later graphical views

Use source text for SCL and original-versus-proposed XML for FBD/LAD, accompanied by a short affected-network explanation. Retain raw artifacts and source maps; disclose normalization and parsing gaps. Do not hide meaningful identifiers or metadata to make a diff look cleaner.

Graphical before/after rendering is a later enhancement, not an initial requirement. An XML diff is already a useful review surface; it is not evidence that arbitrary graphical editing is qualified.

### 25.5 Future TIA add-in is optional

A supported TIA context-menu action could pass an object's identity to Simon, open its conversation, or reveal a review panel. Keep it thin and route it through the same broker; this is not a second mutation or approval architecture. [S09]

### 25.6 Accurate status and error language

Use explicit statements such as:

```text
This block is visible, but its implementation is protected.
FBD reading is supported here; this edit pattern is not qualified.
The project changed after review. No write was applied.
Import completed, but compilation failed. Recovery awaits review.
The connection dropped during mutation. Outcome is being reconciled.
The model stopped; the engineering operation is still running.
Auto execute covers reads and draft preparation, not this TIA write.
```

Use actual backend evidence, not generated conversational reassurance. A UI disconnect must not hide a pending or unknown engineering outcome.

### 25.7 Agent-assisted navigation and personalization

Retain v0.2's app guide, machine-readable view/action catalog, supported settings changes, local extension previews, Keep/Discard, rollback, and safe-mode recovery. Apply them to the reused chat application rather than creating another app shell.

Project identity, approval, recovery, credentials, and outbound publication controls remain protected. The customization agent must not replace or obscure them. Sections 34-35 retain the full design; the first increment is a small reversible configuration change, not a plugin marketplace.

---

## 26. Performance and observability

### 26.1 Performance strategy

Cache verified snapshots, refresh on demand, page large results, serialize project mutation, and avoid holding engineering locks during reasoning or user review.

Large project exports should have progress, bounded scope, and cancellation before mutation. Cancellation of an already-running engineering mutation is a separate capability to investigate, not an assumed safe action.

### 26.2 Initial measurements

Measure attachment latency, read latency, export duration, index update time, documentation retrieval time, compile duration, operation queue length, and application memory overhead.

Choose service-level targets after the representative project is available. Do not promise instant project synchronization on unknown hardware.

### 26.3 Operational telemetry

Track tool invocation, object scope, latency, result state, adapter version, failure category, and recovery outcome. Model usage/cost can be optional observability rather than the first product goal.

Keep engineering source out of telemetry by default. Local evidence bundles may contain source and require explicit access controls.

### 26.4 Useful diagnostic categories

```text
environment_mismatch
permission_denied
unsupported_operation
object_not_found
ambiguous_object
protected_object
stale_precondition
offline_required
project_busy
import_rejected
compile_failed
postcondition_failed
connection_lost
outcome_unknown
recovery_conflict
```

Stable categories are more useful to the agent than exception text alone. Preserve detailed diagnostics locally for investigation.

### 26.5 Evaluate the Pi choice without inventing a speedup

Pi is selected; Simon does not need a broad harness benchmark platform before implementation. Record useful local measures such as time to the correct source, time to an acceptable proposal, request/context size when observable, tool latency, engineering errors, and user corrections.

Do not report reduced tokens as proof of improved engineering quality. Do not claim that Pi is several times more optimized than another runtime without a controlled comparison of the same task, model/access route, context, tools, and acceptance criteria. Unknown usage/cost stays unknown rather than zero.

---

## 27. Implementation stack and repository layout

### 27.1 Reuse the actual application stack

The existing chat application is the frontend/backend starting point; inspect its handoff before selecting another framework. Keep the C#/.NET Siemens-facing implementation from the selected Fanqi base where compatible. Resolve the actual V20 environment rather than forcing Siemens assemblies into the chat runtime. [S31]

Integrate Pi through SDK or RPC according to section 24. Use SQLite plus local files as the proposed local storage baseline. The logical engineering service, runtime adapter, index, and UI do not require separate deployed microservices; security-sensitive privilege boundaries must nevertheless be enforceable.

Do not assume Electron, Tauri, React, Python, C#, or a particular API transport for the existing app. Framework choices belong in a short evidence-backed decision after source inspection.

### 27.2 Proposed logical layout, adapted to the existing repositories

```text
simon/
  README.md
  AGENTS.md
  LICENSE
  docs/
    Simon_v0_3.md
    architecture.md
    compatibility.md
    security-model.md
    operation-contracts.md
    recovery-runbook.md
    source-provenance.md
    decisions/
    test-evidence/
  apps/
    chat/                       # Reused mcp-agent-chat; not a new UI rewrite
  packages/
    contracts/
    application/
    engineering/
    knowledge/
    persistence/
    pi-integration/             # One runtime integration
    review-components/
  bridges/
    tia-v20/                    # Fanqi-derived adapter/fork, with attribution
  agent-resources/
    engineering/
    customization/
    prompt-templates/
    approved-examples/
  extensions/                   # Optional reviewed app packages, incrementally
  presets/
  tests/
    unit/
    contract/
    fixtures/synthetic/
    fixtures/sanitized-exports/
    integration/
    live-tia/
    security/
  tools/
    diagnostics/
    fixture-validation/
```

This layout describes ownership, not a requirement to move both existing projects into a monorepo. Preserve useful upstream structure, history, and update paths. Record the chosen fork/vendor/submodule/package relationship and license obligations. Do not create empty framework packages before the first working slice.

### 27.3 Dependency and privilege rules

- Domain rules and parsers must be testable without Siemens assemblies.
- Only the qualified bridge/worker calls Siemens engineering APIs.
- Pi integration translates sessions/events/tools; it does not own the approval store.
- The review frontend sends exact user decisions to the backend; it cannot directly import blocks.
- The backend is authoritative for project binding, authorization, pending operations, and recovery.
- The user can develop Simon in VS Code, but installed Simon does not depend on it.
- Agent-authored customization is isolated from trusted engineering/UI controls; Pi extension loading is not that isolation mechanism.
- Both the backend and any reused upstream endpoints enforce the same supported scope.

Define the smallest extension contract needed for one real customization. Do not rebuild a general plugin platform merely because the old document described a future SDK.

### 27.4 Development without TIA

Retain a fake worker implementing the same contract, clearly marked synthetic. Test runtime/UI integration, parsers, policy, source maps, diffs, and event handling without a Siemens installation. Live tests remain separate, explicit, version-matched, and limited to disposable projects.

Do not check proprietary assemblies, project archives, customer source, manuals, secrets, or credentials into the repository. Preserve attribution and reviewed licensing for reused code.

---

## 28. Research backlog and architecture decisions

Research is part of implementation. Track an owner, evidence, decision, and affected capability for each item.

| ID | Question | Evidence required | What it gates |
| --- | --- | --- | --- |
| R01 | What exact TIA/update/API build is installed? | Read-only environment report. | Live attachment and worker target. |
| R02 | Which authorized project/CPU types form the first scope? | Engineer-selected disposable test project. | Compatibility profile. |
| R03 | Which export/import route preserves each supported object? | No-change round-trip matrix and property comparisons. | All writes. |
| R04 | What is the actual FBD representation on this build? | Original exports and parser fixtures. | FBD understanding/editing. |
| R05 | Which operations support transactions and exclusive access? | Target docs plus live failure tests. | Atomicity claims. |
| R06 | What can be backed up and restored through supported operations? | Demonstrated restore on disposable project. | Original-project writes. |
| R07 | Are unsaved editor changes visible, and how is freshness detected? | Controlled edit/export tests. | Stale-state guarantees. |
| R08 | What native fingerprints or notifications exist? | Target API docs and measured behavior. | Incremental refresh. |
| R09 | How complete are cross-references and type/instance resolution? | Reference fixtures including indirect/unresolved cases. | Impact analysis. |
| R10 | How is installed help stored and searched? | Local inspection and rights review. | Local documentation adapter. |
| R11 | How will the selected Fanqi checkout be wrapped or extended? | User-tested commit, license/attribution review, code/security audit, and regression evidence. | Reuse implementation and reachable tool scope; selection is already made. |
| R12 | How is Pi integrated and isolated in the existing application? | Existing app handoff, pinned SDK/RPC contract, controlled tools, and threat-model tests. | End-to-end Pi workflow; Pi selection is already made. |
| R13 | What VM/host resource budget is available? | Measurement report. | Deployment choice. |
| R14 | Can a simulator be safely integrated? | Version/license/CPU/isolation evidence. | Automated behavior tests. |
| R15 | Are libraries, project-server sessions, or safety dependencies present? | Inventory and engineer review. | Scope exclusions. |
| R16 | What project data may go to external models? | User/company authorization and selected provider policy. | Real-code cloud inference. |
| R17 | Which UI extension runtime can enforce the required isolation? | Threat model, hostile-package tests, and protected-review proof. | Executable customization activation. |
| R18 | What application commands and extension SDK can be exposed safely? | Versioned schema, effect classification, and contract tests. | Agent-led onboarding and custom panels. |
| R19 | How are `.simon` drafts, trusted staging, grants, and private state isolated? | ACL/process/transport tests on the target Windows setup. | Honest sandbox and rollback claims. |
| R20 | Which repository, contribution layout, visibility, and authentication flow are authorized? | Maintainer policy and least-privilege publication test. | Optional remote PR creation. |
| R21 | How are customizations migrated or replaced by accepted upstream features? | Versioning policy and upgrade/rollback fixtures. | Safe app and SDK updates. |

### 28.1 Architecture decision records

At minimum, record decisions for:

```text
ADR-001: Target environment and first supported scope
ADR-002: Selected Fanqi base, pinning, licensing, and restricted integration
ADR-003: Authoritative representations and round-trip strategy
ADR-004: Approval boundary and deployment isolation
ADR-005: Mutation / compile / recovery state machine
ADR-006: Retrieval stack and documentation ingestion
ADR-007: Pi-only runtime, SDK/RPC transport, and existing-app migration
ADR-008: Agent-native UI contracts and extension isolation
ADR-009: Customization storage, activation, and upgrade model
ADR-010: Optional contribution packaging, authentication, and review policy
ADR-011: Manual/Auto execution semantics versus engineering authorization
ADR-012: SCL/XML review artifacts and display-to-candidate integrity
```

Each decision should state alternatives, chosen approach, evidence, limitations, and conditions for revisiting it.

### 28.2 What the coding agent should not ask repeatedly

Do not ask the user to rediscover the product concept, choose every library upfront, or restate the motto. Those decisions are already captured.

Ask only for genuinely unavailable machine access, authorization, representative fixtures, or engineering choices that cannot be safely inferred.

### 28.3 New v0.3 implementation questions

| ID | Question | Evidence required | What it gates |
| --- | --- | --- | --- |
| R22 | What does `mcp-agent-chat` actually implement? | Read its handoff/source; record stack, protocol, sessions, commands, auth, and approval semantics. | UI/backend reuse and migration plan. |
| R23 | Which pinned Pi SDK/RPC surface fits that application? | Small working session/stream/tool integration with synthetic fixtures. | Agent runtime migration, not selection. |
| R24 | Which desired model/account routes work and are authorized in Pi? | Current provider guidance and explicit account-level test without copying unrelated credentials. | Real inference; no assumed subscription transfer. |
| R25 | What do Manual approval and Auto execute mean for each effect class? | Backend policy tests and explicit UI scope wording; user decision for any wider automatic-write scope. | Execution policy beyond the conservative v0.2 write baseline. |
| R26 | How is diff display tied to the artifact actually applied? | SCL/XML fixtures, raw/view hashes, source maps, and changed-after-review tests. | Trustworthy review for each qualified route. |
| R27 | Why was a newly added hardware module missing in the earlier test? | Explicit binding, fresh reads, nested-item coverage, and raw tool results. | Accurate hardware inventory; no pre-assumed root cause. |
| R28 | Which first self-improvement removes real daily friction? | One scoped request, schema/fixture, preview, activation, and rollback proof. | E0/E1 without a generic plugin-platform build. |

Missing handoff or target-machine access must be marked pending, not filled with guessed details. Continue with available contracts/fixtures while keeping the integration gate explicit.

---

## 29. Milestones and acceptance gates

### M0: Establish the repository and research plan

Preserve the existing app and Fanqi checkout. Read the app handoff/source, record both baselines, select the pinned Pi SDK/RPC path, and deliver README with the slogans, unchanged definition and accepted diagram. Keep the threat model, research backlog, source register, minimal contract and fake worker.

**Gate:** The project runs and tests without TIA; no fake result is presented as live integration.

Capture the customization/approval boundary and the future `.simon` layout during M0. E0 can be built against the fake worker in parallel; executable plugins and remote contributions are not prerequisites for M1-M6.

### M1: Read-only environment and attachment

Connect the reused chat interface to Pi and the restricted engineering read path. Implement diagnostics, explicit process/project selection, permitted inventory, and capability reporting on the target machine. Reproduce the earlier Fanqi smoke test and record its exact environment rather than starting from a blank integration.

**Gate:** From the existing UI, Pi retrieves actual read-only results for the selected TIA instance; supported objects and coverage are visible; detaching does not close the user's TIA; no project mutation or unnecessary external editor is required.

### M2: Source extraction and retrieval

Read representative SCL and supported FBD/LAD blocks, interfaces, types, tags, references, and relevant nested hardware items. Build snapshots, coverage reporting, exact/lexical retrieval, source-linked answers, and static SCL/XML diff fixtures in the chat app. Investigate the earlier missing-module case without assuming its cause.

**Gate:** Engineer can ask a small approved question set and inspect the exact supporting project locations. Unsupported content is visible, not omitted.

### M3: Documentation and conventions

Inspect local help or use version-correct official documentation. Draft conventions from authorized examples and require approval.

**Gate:** Instruction answers contain applicable sources; no silently mixed version guidance; approved and inferred conventions are distinct.

### M4: No-change round trips and recovery on a disposable project

Test candidate export/import routes with no intended source change. Compare required properties. Demonstrate backup/restoration, transaction failure, and post-commit compile failure handling.

**Gate:** Evidence exists for every enabled write route. A compiling but semantically or structurally altered round trip fails this milestone.

### M5: One reviewed SCL change

Complete the prepare/review/approve/apply/compile/post-verify pipeline from the reused UI with Pi, exact SCL diff review, stale-state rejection, and durable operation status. Test the proposed Manual/Auto behavior: routine auto-execution cannot bypass the original-project change gate.

**Gate:** An exact approved edit appears in the correct project, compiler diagnostics are reported, and unauthorized or stale edits are rejected.

### M6: Complete workflow, interruption, and restart recovery

Run a bounded Pi task from the existing UI through Simon's restricted tools on a disposable project. Exercise approval denial, frontend disconnect, Pi interruption, operation reconciliation, and application restart. This extends the early read-only Pi integration; it is not the first time the harness is connected.

**Gate:** The agent retrieves real context, proposes a reviewable change, cannot self-approve, and reports validation truthfully.

### M7: Qualified graphical edit patterns

Add the first supported FBD/LAD mutation class with preservation checks, actual XML diff review, affected-network explanation, and behavior tests. Do not require graphical rendering or a second editor.

**Gate:** The block remains in its original graphical language; tested invariants and metadata are preserved; unsupported patterns are blocked.

### M8: First real-project pilot

With authorization, validated recovery, and the hardened trust boundary, pilot a small non-safety change on the selected offline engineering project.

**Gate:** The engineer verifies the complete audit trail, expected behavior, and recoverability. No controller deployment is performed by Simon.

### M9: Expand based on measured use

Improve the existing chat UX, self-customization, retrieval, or qualified TIA coverage based on actual use. Other harnesses are not scheduled under this Pi-only plan; reconsider them only through an explicit later decision. Do not expand several dimensions without a regression matrix.

### v0.3 delivery sequence clarification

Integrate a minimal Pi read-only turn early (M1), rather than waiting until every engineering feature exists. This does not relax the M4 no-change round-trip/recovery gate before original-project writes.

E0-E3 in section 34 remain parallel, incremental customization milestones. Start with one reversible configuration change, then a small read-only panel. Do not make executable customization or PR publication prerequisites for the engineering MVP.

---

## 30. Test strategy and failure cases

### 30.1 Test layers

**Unit tests:** Hashing, identity handling, parsers, source maps, conventions, diffing, policy rules, state transitions, and redaction.

**Contract tests:** Worker protocol, schema compatibility, pagination, errors, timeouts, approvals, operation IDs, and replay behavior.

**Fixture tests:** Sanitized real exports and explicitly synthetic cases. Preserve multilingual text, nested types, comments, and unsupported constructs.

**Live TIA tests:** Explicitly opt-in, environment-matched, disposable projects only. Never run destructive integration tests automatically against whichever TIA instance happens to be open.

**Functional tests:** Engineer-defined behavior traces and isolated simulation when available.

**Security tests:** Attempted policy bypass, approval forgery, path traversal, malicious comments, direct backend access, and unapproved network/file access.

### 30.2 Minimum failure matrix

| Scenario | Required result |
| --- | --- |
| Several TIA instances are open. | Require explicit binding; never choose arbitrarily. |
| Wrong API major version is selected. | Refuse attachment or select a verified version-matched worker explicitly. |
| Object name occurs in several containers. | Return ambiguity and fully qualified choices. |
| A block is protected or unsupported. | Report limited visibility; no bypass or empty-body replacement. |
| A snapshot is incomplete. | Show coverage limitations in retrieval and proposals. |
| The engineer edits a block after review. | Reject stale application before mutation. |
| Candidate bytes change after approval. | Reject hash mismatch. |
| The agent passes `confirm=true`. | Does not create authorization. |
| Import fails mid-batch. | Report actual state; use verified transaction rollback or controlled recovery. |
| Compile fails after committed import. | Enter explicit recovery workflow; do not claim the transaction undid it. |
| Compile passes but a relevant attribute changed unexpectedly. | Fail post-verification. |
| Connection drops during mutation. | Mark outcome unknown and reconcile before retry. |
| The agent requests controller download or arbitrary code execution. | Operation is absent or rejected at every reachable layer. |
| A project comment contains prompt-injection instructions. | Treat as data; no policy or credential change. |
| Recovery would overwrite a newer human edit. | Stop with conflict. |
| A new TIA update changes export format. | Disable unqualified writes and require regression evidence. |
| The local help viewer is absent. | Use explicit alternative documentation or report the gap. |
| The application restarts with a pending operation. | Recover status from the journal; do not replay blindly. |
| User cancellation occurs during a non-cancellable mutation. | Report the actual continuing/unknown state; do not pretend cancellation reverted it. |

The extension and publication failure matrix in section 35.9 is also mandatory before those capabilities are released. Include malicious build scripts, permission escalation, approval spoofing, package revision races, confidential outbound content, and extension crash recovery.

### 30.3 Acceptance evidence

For each live test record environment, project fixture hash, adapter commit, operation, expected result, observed result, source/metadata diff, compiler output, and recovery result where applicable.

A screenshot or a demo video is supplementary evidence, not a substitute for structured results and reproducible fixtures.

### 30.4 v0.3 runtime, diff, and mode regression cases

| Scenario | Required result |
| --- | --- |
| Pi receives a project change while a previous target has a pending proposal. | Reject stale/wrong-target execution; require current binding and review. |
| Auto execute is enabled after a proposal was denied or expired. | Does not resurrect its authorization. |
| The chat UI is bypassed and the tool endpoint is called directly. | The same backend policy and exact-change checks apply. |
| Pi or the UI restarts during a TIA mutation. | Journal reconciliation precedes retries; runtime cancellation is not rollback. |
| UI says a compile passed but the actual tool outcome is failed/unknown. | Compiler/journal evidence wins; presentation is corrected. |
| The shown XML is normalized differently from the import candidate. | Preserve raw evidence and verified source mapping; cannot approve an unshown material change. |
| A generated-looking XML identifier encodes a changed connection. | It remains visible in raw review and relevant impact checks. |
| FBD/LAD XML is displayable but the edit class is not qualified. | Show read/proposal evidence; block import. |
| A newly added module is absent from a coarse project tree. | Expand permitted hardware inspection and report coverage/freshness; do not assert absence from the project. |
| A Codex-specific slash command has no Pi equivalent. | Disable/explain it or implement an explicit host mapping; never fake success. |
| A desired subscription/model route is unavailable in Pi. | Explain and require an explicit alternative; no silent paid-provider fallback. |
| A customization extension tries to register raw Fanqi writes or alter approval policy. | Reject the privilege expansion at host/backend boundaries. |
| A local customization works and no repository is configured. | It remains usable locally without a contribution account. |
| The first-generation chat handoff cannot be located. | Preserve the missing-input status; do not claim its framework/protocol is known. |

---

## 31. Worked example

**Illustrative workflow, not a tested implementation or a machine-control prescription.**

### User request

> In the selected non-safety SCL sequence, change the fault-reset handling to match the approved reference pattern. Preserve the interface and unrelated sequence behavior.

### Step 1: Establish context

In the reused chat app, Pi calls Simon tools to confirm the project binding, read the block and instance/type relationships, obtain relevant callers and references, and retrieve the approved fault-reset pattern. TIA remains the editor throughout.

The agent does not infer the desired reset priority from a generic example. If the approved pattern does not establish the required behavior, it asks the engineer.

### Step 2: Prepare evidence

The proposal identifies the affected source region, current behavior, requested behavior, unchanged interface, potential stateful effects, and known documentation references.

The test plan includes existing-fault, cleared-fault, held-reset, simultaneous-command, and initialization cases where they are relevant to the approved requirement.

### Step 3: Produce a bounded diff

The candidate changes only the necessary logic. It does not rename project-wide tags, convert callers from FBD to SCL, or rewrite unrelated sequence states.

The broker stages exact bytes and identifies the baseline needed for recovery.

### Step 4: Review and apply

The engineer inspects the SCL diff in the chat review card and authorizes the exact change. Auto execute may have avoided routine read/proposal prompts; it does not manufacture this authorization. The broker rechecks revisions and permitted operation scope, then applies through the tested route.

If the source changed while the engineer was reviewing, the proposal is invalidated.

### Step 5: Validate

The mutation transaction ends before compilation. Simon compiles the affected supported scope, collects nested diagnostics, reads back the source and metadata, and compares required properties.

Behavior tests run only in an established isolated test environment or are handed to the engineer for manual execution.

### Step 6: Handoff

A truthful result might be:

```text
Applied to the selected offline engineering project.
Public interface unchanged.
TIA compilation passed with no new errors.
Source and required metadata post-checks passed.
Behavior test plan prepared; simulation has not yet been run.
Project save state: unsaved.
No controller download or online operation was performed.
```

That is more useful than claiming "fixed and safe" after a successful import.

---

## 32. Risk register and success measures

### 32.1 Main risks

| Risk | Design response |
| --- | --- |
| Wrong interpretation of a graphical/stateful program. | Structured source, bounded parsing/editing, explicit invariants, functional tests, engineer review. |
| Lossy source round trip. | Route-specific preservation matrix and no-change tests; block unsupported writes. |
| Stale proposal overwrites human work. | Revision preconditions, project binding, and conflict rejection. |
| Compile failure after import. | Separate validation stages and tested compensating recovery. |
| Overprivileged third-party bridge. | Audit, reduce registered surface, enforce server-side policy, prevent alternate access. |
| A VM is mistaken for complete isolation. | Document and test process, credential, filesystem, and network boundaries. |
| Wrong documentation version. | Environment-aware retrieval and explicit applicability status. |
| Hidden protected or indirect dependencies. | Coverage reporting and escalation of unknown impact. |
| Customer code is sent to a cloud model without permission. | Explicit authorization and visible data flow. |
| Scope expands into HMI, hardware, simulation, and every TIA version at once. | One tested environment and one vertical slice first. |
| A demonstration becomes mistaken for production readiness. | Publish supported-operation profiles and live acceptance evidence. |

### 32.2 Product success measures

Measure engineer time spent preparing context, number of manual copy/paste steps, retrieval accuracy on approved questions, time to a reviewed change, first-pass compilation rate, stale-write prevention, post-check failures caught, and recovery success.

Track how often the engineer accepts or rejects proposals and why. A high rejection rate can identify missing context or poor conventions rather than simply a weak model.

Do not measure success only by generated lines, tool-call volume, or the number of blocks modified.

### 32.3 First useful product threshold

Simon is useful when an engineer can ask about actual mixed-language project content, receive source-grounded answers, and complete one small approved SCL change with clear validation and recovery evidence without manual chat-to-TIA copying.

Broad autonomous engineering is not required to reach that threshold.

---

## 33. First instructions to the coding agent

1. Treat `Simon_v0_3.md` as the current consolidated handoff. Keep the earlier files as history, not competing plans. Preserve the original engineering definition, slogans, and accepted diagram in the future README.
2. Inspect the existing `mcp-agent-chat` handoff/source before choosing a UI/backend stack. Reuse it; do not build a new generic chat app or require VS Code.
3. Use Pi as the sole planned runtime. Choose SDK or RPC from the app's actual stack and isolation requirements. Do not implement Codex/Claude/Pi runtime switching as an MVP obligation.
4. Build on the user's tested `Fanqi-dev/tia-v20-unified-mcp` checkout. Pin it, preserve attribution, resolve applicable licenses, and record local patches. Do not replace it merely because older documents listed alternatives.
5. Preserve the known basic connection/read test as user-reported evidence, not qualification of every tool. Capture the exact V20 build and repeat only the necessary smoke tests.
6. Keep Siemens calls inside the qualified bridge. Route engineering tools through Simon policy; prevent raw-server or shell bypasses before original-project writes.
7. Keep TIA Portal as the authoritative project and manual editor. XML/SCL exports, indexes, and candidates are backend working artifacts, not a mandatory external source editor.
8. Build a small Pi/read-only/UI workflow early, using a fake worker where appropriate. Do not wait for a full index or customization platform before proving the integration.
9. Recover and retain v0.2's project binding, freshness, source provenance, preservation checks, scoped approvals, transaction/compile separation, recovery, and test matrices.
10. Show SCL source diffs and FBD/LAD XML diffs with affected-network explanations. Do not translate the graphical project into SCL or hide material XML changes.
11. Establish no-change round-trip and recovery evidence before enabling each write route. Graphical review support does not automatically qualify graphical authoring.
12. Preserve Manual approval / Auto execute controls, but document their effective backend scope. The exact-change human gate for original-project writes remains the baseline until the user explicitly approves a different policy.
13. Keep validation, source freshness, capability checks, and audit behavior active in both modes. A prompt, tool parameter, or agent-generated 'approved' string is not authorization.
14. Compile and save outside Openness mutation transactions. Model partial application, post-commit failure, unknown outcome, and conflicts with later human edits explicitly.
15. Exclude controller deployment, safety-program authoring, online forcing/mode changes, and unqualified broad mutation from the initial tool surface.
16. Retrieve version-applicable Siemens documentation and approved project conventions. Keep inferred, user-approved, compiler-reported, and model-generated information distinct.
17. Inspect the earlier missing-hardware-module report as a concrete coverage/freshness test; do not repeat an unverified diagnosis.
18. Retain self-improvement as a product capability: first guidance/configuration, then one isolated read-only panel, then optional sanitized contributions. Do not let app customization modify trusted engineering policy or the running bridge.
19. Keep customization sources under user-scoped `.simon`, separate from protected authorization, recovery, credentials, and private project evidence. Never publish the whole directory or inherited private history.
20. Confirm actual Pi account/model support; do not transfer Codex credentials by assumption or silently change billing. Do not promise comparative efficiency multipliers without evidence.
21. Record missing inputs, unexecuted tests, and unqualified behavior honestly. Personal-first scope does not mean skipping data protection or PLC engineering verification.
22. Deliver small working increments with reproducible evidence. Do not re-ask settled product choices or recreate generic infrastructure already supplied by the app, Pi, or the bridge.

The central product loop remains:

```text
UNDERSTAND THE PROJECT
  -> RETRIEVE THE RIGHT ENGINEERING KNOWLEDGE
  -> PROPOSE A BOUNDED CHANGE
  -> REVIEW AND AUTHORIZE
  -> APPLY THROUGH SUPPORTED INTERFACES
  -> COMPILE AND VERIFY
  -> HAND CONTROL BACK TO THE ENGINEER
```

Simon should make the engineer faster without making the engineering process opaque.

---

## 34. Agent-assisted onboarding and a self-customizing Simon UI

### 34.1 Product requirement and meaning of "self-building"

**Retained user-approved direction (v0.2, reaffirmed in v0.3):** Simon's own coding agent should help the engineer learn, navigate, configure, and extend Simon. Users should be able to request useful interface changes in normal language, try them locally, and optionally propose reusable improvements to the maintainers.

This is an additional product pillar, not a change to the approved README motto. Keep the existing definition verbatim. The following sentence can appear below it:

> Use the copilot to learn Simon, tailor your workspace, and build local extensions that you can choose to contribute back.

"Self-building" means **agent-authored changes within defined extension boundaries**. It does not mean an agent rewrites the running trusted application, replaces the Openness worker, changes its own permissions, or bypasses review. This feature customizes Simon's interface, not Siemens's TIA editor internals.

Design most ordinary Simon workspace surfaces as configurable views or extensions from the beginning. The protected project-binding, permission, approval, recovery, and publication controls remain outside that customization surface. Do not promise that literally every screen or behavior can be replaced at runtime.

### 34.2 Herdr is the interaction reference, not the security template

Herdr's documentation explicitly supports agent-led onboarding through an agent guide, and describes applying most UI configuration changes without restarting panes. This supports the desired interaction pattern: ask the agent rather than hunt through settings. [S24][S25]

Herdr also documents executable workflow plugins, but says their code is not sandboxed and runs with the user's environment. Its plugin documentation does not establish arbitrary safe runtime rewriting of its core UI. Simon should borrow the approachable workflow, not inherit that trust model around PLC engineering. [S26]

No Herdr integration, source reuse, or runtime dependency is required. If implementation proposes reuse, conduct a separate pinned-version, compatibility, and licensing review.

### 34.3 Three kinds of assistance

| Mode | Example | Allowed outcome |
| --- | --- | --- |
| Guide | "Show me how to inspect callers of this block." | Explain, navigate to an existing view, highlight a control, or open relevant help. No code generation required. |
| Customize Simon | "Add a panel grouping compile errors by block." | Change a supported layout or create a local extension, validate it, preview it, and activate it after the required approval. |
| Engineer the PLC project | "Change this sequence's reset handling." | Use the existing reviewed engineering-change pipeline. UI customization is not an alternate write path. |

Use distinct task scopes, capability grants, and histories for these modes even when the same model or harness serves all three. An app-customization task should receive synthetic data by default, not automatically inherit the engineering session's customer source, credentials, or entire conversation.

Switching modes must be visible. A request for a new panel does not authorize editing PLC code, and a request to edit PLC code does not authorize publishing a Simon contribution.

### 34.4 Make the application understandable and operable by an agent

Provide a versioned application guide and a machine-readable catalog of supported views, commands, settings, extension slots, and state schemas. Derive catalog entries from the actual registered features where possible, so onboarding describes the installed build rather than an aspirational manual.

Proposed narrow app operations include:

```text
app.describe_capabilities
app.read_ui_state
app.navigate
app.highlight_control
app.propose_settings_change
customization.create_draft
customization.validate
customization.preview
customization.request_activation
customization.request_rollback
contribution.prepare
contribution.request_publish
```

These are **proposed Simon contracts**, not existing external APIs. Every operation needs an input schema, error contract, side-effect classification, permission check, and audit behavior. There is deliberately no agent operation to approve a PLC change, grant permissions, publish without consent, or invoke arbitrary backend methods.

Expose selected view IDs, documented control IDs, redacted errors, and explicitly granted context through this interface. Do not require screenshot interpretation or arbitrary DOM manipulation for routine navigation. Ask for visual inspection only when genuinely needed, with the same data-sharing policy as other model inputs.

Keep onboarding usable without model access: ordinary help, navigation, keyboard access, settings, and the ability to dismiss the tour remain available.

### 34.5 Extension levels and hard limits

| Level | Examples | Runtime policy |
| --- | --- | --- |
| Declarative customization | Layouts, visible columns, filters, approved theme tokens, shortcuts to allowed actions. | Validate against a schema; preview and apply atomically; provide undo. No arbitrary commands or executable configuration. |
| Local UI extension | A new report, project-summary panel, diagnostic browser, or reusable onboarding view. | Run in an isolated extension surface with explicit scoped data permissions; activate an immutable validated revision. |
| Workflow extension | A guided sequence of existing application operations. | May prepare proposals or request permitted operations; each effect still passes existing broker checks and confirmations. |
| Core change proposal | A missing backend capability, new Openness operation, parser change, or policy change. | Prepare an ordinary repository patch with tests for maintainer review. Not hot-loaded into the user's trusted installation. |

The default extension data plane should be read-only. Read-only access is still sensitive: a panel that can read source code must not also receive arbitrary network access simply because it cannot edit the PLC.

If a requested feature cannot be expressed through available contracts, explain the missing capability and offer a core-change proposal. Do not invent a private endpoint or expand permissions to make the demo work.

### 34.6 The internal `.simon` workspace

Use a user-scoped Simon home, conventionally `~/.simon`; on Windows the proposed location is `%USERPROFILE%\.simon`. Here `.simon` is not a literal directory at the filesystem root, and not a directory inside the proprietary TIA project archive.

Proposed layout:

```text
~/.simon/
  preferences.json                 # Non-security user preferences
  layouts/                         # Declarative layout profiles
  customizations/
    compile-errors-by-block/
      simon-extension.json
      README.md
      CHANGELOG.md
      src/
      tests/
      fixtures/synthetic/
  proposals/
    <proposal-id>/
      proposal.json                # Purpose, package revision, intended target
      summary.md
      file-manifest.json           # Exact proposed outbound file list
      checks.json                  # Local evidence, not CI attestation
      candidate/                   # Sanitized shareable source only
  history/                         # Local editing checkpoints; not published
  cache/                           # Disposable build/cache artifacts
  state/                           # Private extension state; not published
  worktrees/                       # Optional isolated source checkouts
```

The shareable unit is an individual package under `customizations/`, or an explicitly prepared contribution candidate. **Never initialize the entire `.simon` home as an upstream-bound repository or push it wholesale.** History, state, caches, logs, account information, project exports, paths, and indexes do not become shareable just because they sit next to extension source.

Optional per-project layout profiles can be added later. Opening a repository containing a `.simon` folder must not automatically execute its extensions or trust its settings. Require a workspace trust decision and normal extension validation.

User preferences are not the authoritative permission policy. Active package grants, approved artifact hashes, publication authorizations, protected recovery copies, and broker policy must be stored outside agent-writable paths or behind separately enforced access controls. The implementation must prove those controls; a directory convention or `.gitignore` is not a sandbox.

### 34.7 Extension contract and host-owned permissions

Each extension should carry a manifest with a stable ID, version, supported Simon/SDK range, entrypoint, declared surfaces, requested data access, storage needs, and dependency information. For example:

```json
{
  "manifest_version": 1,
  "id": "local.compile-errors-by-block",
  "version": "0.1.0",
  "sdk_api": "simon-ui/1",
  "kind": "ui-panel",
  "entrypoint": "dist/panel.js",
  "contributes": {
    "panels": [{"id": "errors-by-block", "slot": "workspace.secondary"}]
  },
  "requested_permissions": [
    "diagnostics.read:selected-project",
    "navigation.request"
  ],
  "network": "none"
}
```

This manifest is illustrative and not yet an implemented schema. The `sdk_api` above is a proposed Simon contract, not an external SDK version.

A manifest requests permissions; it never grants them. Effective permissions are the intersection of supported host capabilities, administrator policy, the user's grant, and the current project scope. Missing or unknown permissions fail closed. A new revision requesting broader access needs a new grant.

The host assigns actual project scope and extension identity through its authenticated channel. Never trust a caller-supplied `project_id`, `extension_id`, or `approved=true` as authority.

### 34.8 Isolation and the protected application surface

Do not import generated extension JavaScript into the same privileged renderer that displays trusted approvals, nor load generated native code into the bridge process. Define an extension protocol and select a separately isolated renderer/process or a constrained declarative renderer.

For an Electron candidate, official guidance emphasizes renderer isolation, sandboxing, restricted navigation, and validating IPC senders. For a Tauri candidate, permissions are bound to windows/webviews and overlapping capabilities can combine privileges. Those mechanisms need an application-specific threat model; neither framework alone certifies a safe plugin architecture. [S27][S28]

Regardless of framework, enforce these Simon requirements:

- Extension code cannot access the approval DOM, credential store, full filesystem, arbitrary shell, Siemens assemblies, bridge channel, or plant network.
- Package CSS and overlays cannot cover or replace the trusted target banner, permission prompts, source-diff review, recovery controls, or publication review.
- Custom panels are labeled as local extensions. A trusted window or clearly separated host surface performs consequential confirmations using broker-owned evidence.
- Extensions may request opening the trusted review interface, but cannot fabricate approval events or dismiss required warnings.
- File/data access is scoped and brokered. Network is denied by default, including loopback services and alternative exfiltration channels relevant to the chosen runtime.
- Per-extension storage, event subscriptions, CPU/memory limits, timeouts, and cancellation are bounded; subscriptions are released when an extension stops.
- An extension crash cannot kill the Openness worker or corrupt its operation journal.

Build isolation is as important as runtime isolation. Agent-written tests, scripts, dependencies, and build configurations are executable input. Use a constrained build worker with no TIA access, publication credentials, unrelated home directory, or default network. Prefer a pinned host-provided toolchain and vetted dependencies. New packages and installation scripts need explicit review rather than unrestricted package-manager execution.

Do not expose an agent-controlled development server or privileged hot-reload channel as a production interface. If proper isolation is not demonstrated, ship declarative customization first and keep executable extensions disabled.

### 34.9 Local build, preview, activate, and recover

Implement a distinct customization lifecycle:

```text
requested -> drafted -> validated -> preview_ready
  -> approved_for_activation -> active
  -> superseded / disabled / rolled_back
```

Validation failures leave the current active revision unchanged. Validation includes manifest checks, path checks, dependency policy, compilation where needed, contract tests, permission diff, and a preview using synthetic or explicitly authorized data.

The developer experience should be:

```text
Ask for a change
  -> agent edits only its draft package
  -> Simon builds and checks it
  -> isolated preview shows the result and permission changes
  -> user selects Keep or Discard
  -> host activates the exact validated artifact
  -> one action restores the previous known-good revision
```

Use content-addressed or equivalently immutable staging. Validate and activate the same bytes, not whatever happens to be in an agent-writable directory a moment later. Concurrent edits need revision checks. Atomic activation means a new panel becomes active as a whole, rather than serving half-written assets.

Support live refresh of extension views where qualified. Core, native, or incompatible changes may require a normal application release or restart; never promise universal instant hot replacement. UI refresh must not restart TIA, interrupt a mutation, or reset the authoritative engineering operation state.

Keep a launch-time safe mode that ignores local extensions and restores the built-in workspace. It must be accessible even when extension code crashes during startup. Rollback restores UI/package state; it cannot undo external effects or already-published code.

### 34.10 Example: a new engineer's first session

The user asks:

> Show me where to inspect a block's callers, and keep the documentation beside the block explanation.

Simon reads its supported view catalog, opens the existing callers view, highlights the documented navigation control, and proposes a layout change. The change is local and reversible. No PLC program, Openness policy, or repository is modified.

Later the user asks:

> Build a panel that groups the latest compiler diagnostics by block, with a link to each affected object.

The app-customization task receives the diagnostics schema, extension SDK, and synthetic fixtures. It builds a package under `customizations/compile-errors-by-block`, validates the grouping and navigation behavior, and opens a preview. The engineer activates it through the host.

Real compiler messages are read only after granting the panel access to the selected project. Diagnostics remain provider/compiler-reported; the panel cannot label its own interpretation as a successful compile. Clicking a block requests host navigation, not direct Openness execution.

### 34.11 Compatibility, updates, and the built-in extension model

Ordinary built-in workspace panels should use the same versioned extension contracts where practical. Keep the security-sensitive host UI outside that system. This makes local improvements portable without making policy replaceable.

Record the Simon version, SDK version, package revision, dependency lock, and tested capabilities for each activation. An application update checks compatibility before loading extensions. Preserve the user package, disable incompatible versions with a clear message, and offer a migration preview rather than deleting or silently rewriting it.

If an extension later becomes a built-in feature, identify it through an explicit replacement/migration record. Ask whether to switch and preserve local settings; do not load two conflicting implementations or delete the user's variant automatically.

### 34.12 Incremental delivery and acceptance

This feature is an architectural requirement now, but does not postpone the original read-only TIA integration work. Separate its milestones:

**E0: Agent-readable application and declarative customization.** Implement current-build documentation, navigation tools, one reversible layout change, user-scoped storage, and protected host controls. This can run entirely against the fake worker.

**E1: One agent-authored UI package.** Implement a bounded SDK and isolated preview/activation for the diagnostic-grouping example. Demonstrate failed-build preservation, crash recovery, permission checks, and safe mode before general executable extension support.

**E2: Local contribution preparation.** Build a clean shareable candidate and manifest, show a human-readable diff, and export it without network access.

**E3: Optional upstream proposal.** Add reviewed publication to a configured repository and maintainer feedback, as specified in section 35. There is no public submission dependency for using Simon locally.

Minimum acceptance: a new user can obtain guidance, request a useful panel, inspect its preview, activate it, restart Simon, retain it, and revert it without changing the engineering project or exposing its code. A customization cannot move itself into a privileged role by editing a manifest, layout, or script.

### 34.13 Making self-improvement real with Pi and the reused chat app

The user likes the idea of software that can be improved through its own agent. Implement that as a small, observable development workflow, not as a claim that Pi autonomously improves itself or that more generated code is automatically better.

**Proposed first deliverable:** from the chat, ask Simon to group compile diagnostics by block. First use an existing view/configuration schema if possible. Only generate a new component when the requested presentation cannot be expressed through existing supported controls.

A practical implementation sequence is:

1. The trusted host exposes the installed app's view/setting catalog and a small diagnostics schema.
2. Start a separate Pi customization session with synthetic diagnostics and an isolated draft directory under `.simon/customizations/compile-errors-by-block`.
3. The agent creates a declarative view or a bounded package against the documented host contract. It cannot modify the active installation, broker, credentials, or original TIA project.
4. An isolated build/test step validates rendering, grouping, links, permission requests, and failure handling.
5. The app shows a preview and the exact package/configuration diff. The engineer chooses Keep or Discard.
6. The host activates the validated immutable revision and records an undo point. An incompatible or failing revision leaves the working app intact.
7. With an explicit grant, the panel reads only selected-project diagnostics through the existing backend. It does not call Openness directly or change compiler results.

The first increment can be entirely declarative and use synthetic data. A package system, remote PR publisher, or arbitrary executable hot reload is not required to demonstrate value.

### 34.14 Distinguish three different extension targets

| Target | Example | Policy |
| --- | --- | --- |
| Simon app configuration/UI | Group diagnostics, add a filter, arrange a supported panel. | Versioned schema/package, preview, activation control, undo. |
| Simon's Pi resources | Add an approved explanation template, improve a skill, add a reviewed read-only command. | Review behavior/tool changes, test in a non-privileged session, pin approved revision, and re-check capabilities. |
| Trusted core / bridge / permission code | Add a new Openness operation or change write policy. | Ordinary source patch and release qualification; never self-installed by the active engineering agent. |

Pi extension code executes in its runtime process; loading an agent-written extension can change more than its visible UI. Its extension system is therefore not a sandbox for Simon. Treat new tool registrations, resource loading, dependencies, and network/file access as explicit privilege changes. [S34][S35]

A supported Pi reload mechanism may reload approved runtime resources, but must not serve as an alternate route to activate unreviewed code or bypass the host's manifest and artifact checks. Test the exact SDK/RPC/headless behavior selected for Simon; terminal-specific UI behavior is not assumed to exist in the chat frontend.

The same Pi technology can serve engineering and customization, but separate sessions alone do not enforce isolation. Use the process/filesystem/network/credential boundaries already required in section 34.8.

### 34.15 Scope and evidence for self-improvement

Keep manual approval of executable activation and core releases as the default. Auto execution of permitted draft edits/build checks does not authorize activation, publication, permission expansion, or PLC writes.

Measure whether the user keeps and uses a change, whether it passes existing tests, and whether it can be reverted. Record the problem and evidence; do not invent a universal quality score. A small useful local configuration is a valid success.

The inherited Herdr reference describes interaction inspiration. The user's Pi/self-improving-software inspiration adds motivation; it does not prove that either upstream project supplies Simon's complete isolation, review, or contribution system. Sections 34-35 remain Simon requirements.

---

## 35. From local customization to reviewed upstream contribution

### 35.1 Two feedback loops, not automatic self-merging

The user's intent is to turn real engineering needs into working local improvements and optionally make reusable improvements available to the Simon repository. In the current personal-first scope the user may also be the maintainer; no external team, public repository, or SaaS account is required.

Separate the loops:

```text
LOCAL LOOP
Need -> agent builds -> checks -> preview -> user tries it -> revise

UPSTREAM LOOP
Chosen local revision -> sanitized proposal -> user approves publication
  -> branch / draft PR -> maintainer review and CI
  -> requested changes / rejection / merge -> normal release
```

The local loop can be fast and interactive. Team review and releases are asynchronous; do not promise immediate maintainer feedback, automatic acceptance, or an instant update to everyone's application.

A successful local customization stays usable even if the team rejects it or never receives it. Contribution is optional, not a hidden condition of personalization.

### 35.2 Recommended defaults; user has not chosen automatic publication

The user proposed an internal setting and left its default open. This handoff recommends:

| Behavior | Proposed default |
| --- | --- |
| Save requested customizations locally | Enabled. |
| Keep local revision/rollback history | Enabled, with retention controls. |
| Preview before first activation of executable code | Required. |
| Automatically publish to a Git remote | Disabled. |
| Prepare an upstream candidate on demand | Available without account connection. |
| Submit a draft PR | Only after outbound-content and destination approval. |
| Automatically merge or push to the protected main branch | Never available to the runtime agent. |
| Share project code, manual extracts, prompts, or diagnostics | Excluded by default and prohibited where authorization is absent. |

These are proposed product defaults, not a claim that the user has already approved automatic-sharing settings. Organization policy may further restrict or disable contributions.

Possible later convenience: after a user explicitly enables it for a particular trusted repository, automatically *prepare local drafts* for selected accepted customizations. Remote publication should still have an exact-content review gate. Avoid noisy proposals for every theme adjustment or every intermediate edit.

### 35.3 What a contribution contains

A candidate should capture a reusable improvement, not the user's environment. Include only reviewed package source or a targeted core patch, manifest, synthetic fixtures, tests, documentation, dependency changes, and a short explanation of the problem and observed result.

Record:

```text
proposal_id
customization_id and immutable revision
proposal_type: extension | preset | core_patch
base repository and base commit
intended upstream repository, branch, and visibility
exact outbound file paths and content hashes
build/test evidence and known limitations
permission changes
origin/attribution and applicable contribution terms
publication state and remote references
```

Do not include customer/project identifiers, PLC source, symbols, hardware/network details, Siemens manuals or assemblies, real compiler logs, absolute local paths, credentials, raw conversations, hidden model reasoning, or inherited private Git history. Screenshots can contain the same information; include them only after explicit review and preferably generate them from synthetic previews.

A `.gitignore` is a convenience, not the export policy. Build the candidate in a clean staging directory from a **positive allowlist of reviewed files**, then check the complete resulting diff and outbound commit set. Do not push the customization workspace's history as a shortcut.

### 35.4 A local extension is not automatically a patch to Simon core

Storing source under `.simon` makes it inspectable and portable, but does not by itself give it a meaningful diff against the upstream application. Define an explicit contribution mapping.

Proposed upstream targets:

```text
extensions/<accepted-extension-id>/   # Reusable optional feature
presets/<accepted-preset-id>/         # Declarative layout/workflow preset
src/<appropriate-component>/         # Maintainer-reviewed core change
```

Choose the repository's canonical layout during implementation; these paths are proposals.

For an extension contribution, map the clean package into its target location in an isolated checkout of the upstream base commit. Run integration checks there. For promotion into the default application, maintainers may adapt the extension, add tests, or implement the idea differently. Do not claim that copying the entire `.simon` directory into `src/` produces a valid PR.

For core changes, the agent may draft a patch in an isolated source checkout using synthetic tests. It must not replace the running trusted binary or gain live TIA privileges to validate the patch. CI/live integration qualification and release approval remain separate.

### 35.5 Publication is an independent trusted operation

Use a dedicated contribution publisher, separate from the generated extension and the general agent shell. It receives a frozen candidate and a trusted user authorization, not a request to push arbitrary filesystem paths.

The review surface must show the destination repository, public/private visibility, target branch, exact files/diff, commit metadata, test evidence, known sensitive-data findings, and whether a draft PR will be created. Bind approval to these facts and the candidate hash. New content or a changed destination invalidates approval.

Use an explicitly configured remote and protected credentials. Never infer a safe destination from the currently open PLC project's Git remote, from a package manifest, or from model output. Do not put Git credentials into `.simon` source files, prompts, build workers, or extension processes.

GitHub supports proposing changes from a fork and creating draft pull requests. A repository collaborator may instead use a permitted feature branch. Simon's exact authentication, repository visibility, organization policy, and fork permissions must be validated during implementation. [S29]

A draft PR to a public repository is still publication. "Draft" is a review state, not a confidentiality feature.

Prefer the narrowest authorization compatible with the selected flow. Simon's publisher must not receive permission to merge, change branch protections, manage secrets, or perform unrelated repository writes. Decide between a scoped application integration and a supported local authentication flow through a documented architecture decision; do not invent a universal required token scope before choosing the API path.

### 35.6 Publication state machine and failure behavior

Track the process explicitly:

```text
local_only -> candidate_prepared -> checks_passed -> publication_review
  -> approved_for_publication -> branch_published -> draft_pr_open
  -> review_requested -> changes_requested / rejected / merged
  -> released / superseded
```

A branch upload and PR creation are not necessarily one atomic operation. If publishing the branch succeeds but opening the PR fails, show the existing remote artifact and retry only the missing step. Associate remote refs with the local proposal ID to avoid duplicate PRs. Do not silently delete or force-push branches during cleanup.

Use resumable jobs, explicit status refresh, and manual cancellation before publication. Cancellation or deleting a local draft cannot retract data already sent to a remote. Explain that distinction in the UI.

No internet, no credentials, a disabled contribution policy, or an unsupported remote should leave the customization usable locally. Permit a clean patch/package export for manual review as a fallback; never invent a successful submission.

### 35.7 Maintainer verification and the release boundary

Require maintainer review, tests against the current supported application/SDK, privacy checks, permission review, and applicable contribution/attribution checks. Validate claimed test results independently. Generated test code is untrusted until reviewed or run in an appropriately isolated environment.

GitHub branch protections can require pull-request reviews and status checks. Configure the repository's actual rules and bypass permissions deliberately rather than assuming that the PR label alone prevents a direct merge. [S30]

Ordinary contribution CI must use synthetic fixtures and have no access to plant networks, live customer projects, Siemens licenses, publication credentials, or privileged engineering workers. A successful UI test is not proof of PLC integration correctness. New bridge or parsing capabilities must pass the existing qualification gates before release.

The maintainer may accept an extension, promote a preset, request revisions, reject the idea, or convert it into a separate implementation. Record that feedback against the local proposal. Do not execute instructions from PR comments as trusted automation: the user can ask the agent to prepare a new local revision, which repeats validation and publication review.

Merging code is not deploying it. The normal reviewed release/update process distributes accepted changes. Installing a later release should handle local-extension compatibility and replacement explicitly, as described in section 34.11.

### 35.8 Data protection and contribution hygiene

Secret scanning alone is insufficient: a customer name, address, symbol list, or process-specific algorithm may be confidential without resembling an API key. Combine allowlisted packaging, synthetic data substitution, automated checks, and explicit human review. If a candidate cannot be generalized safely, keep it local or use an authorized private destination.

Do not automatically upload extension usage telemetry, user prompts, project names, or screenshots as "feedback." Any optional telemetry is a separate consent and policy decision. Local contribution history can track whether the user kept or reverted a feature without reporting that fact remotely.

A rapid engineering feedback loop is valuable only when the team receives clear, reproducible, reviewable proposals. Prefer one proposal per coherent feature, consolidate revisions, preserve attribution, and check for an existing proposal before opening another.

### 35.9 Security and regression acceptance matrix

| Scenario | Required result |
| --- | --- |
| A new user asks for help navigating. | Uses the installed app catalog and allowed navigation; no unnecessary source generation or project write. |
| The agent edits its package during activation. | Hash/revision mismatch rejects the altered candidate. |
| A panel requests a different project's data. | Scope check rejects the request. |
| Generated CSS tries to hide the review banner. | The protected surface is not accessible to that extension. |
| A manifest adds approval, shell, filesystem, or network access. | Unsupported permissions are rejected; permitted privilege changes still need independent authorization. |
| A package tries to connect to a local privileged service. | Transport/network restrictions and authentication deny access. |
| Build code attempts to read credentials or customer files. | Build sandbox denies access; no secrets are available. |
| A build fails or a panel enters a crash loop. | Current working UI stays active or safe mode recovers it; TIA operations are not replayed. |
| Simon updates and an extension is incompatible. | Preserve the package, disable incompatible execution, offer a reviewed migration. |
| No Git account is connected. | Local customization and contribution export still work. |
| A candidate contains a real project export or inherited private commits. | Publication is blocked pending removal and review. |
| The destination changes after approval. | Approval is invalidated. |
| A file changes between publication approval and upload. | Publisher rejects it rather than uploading different bytes. |
| Branch publication succeeds but PR creation fails. | Report the published branch; retry idempotently without creating duplicates. |
| Maintainer feedback contains tool instructions. | Treat as untrusted review content; no autonomous execution or privilege change. |
| Upstream rejects the proposal. | Local extension remains available; no automatic deletion. |
| An accepted feature ships in Simon core. | Offer an explicit migration; avoid duplicate behavior and preserve preferences. |

### 35.10 Product success measures

Measure time to complete guided onboarding, time from a customization request to a usable preview, validation failures caught before activation, successful rollback, customizations still used later, and the proportion of voluntarily submitted proposals that maintainers find reproducible and useful.

Do not optimize for raw PR count, amount of generated UI code, automatic publication rate, or an artificially low rejection rate. A good outcome may be a tiny local-only layout change that removes daily friction.

The combined product promise is:

> Simon helps engineers improve PLC software through reviewed engineering changes, and improve their own Simon workspace through reversible, agent-built customizations. Useful local improvements can become reviewed contributions, but never bypass the human boundaries around engineering, publication, and releases.

---

## 36. Primary-source register

**Source provenance:** S01-S30 and their original descriptions are carried forward from `Simon_v0.2.md`, which records a research snapshot of 2026-09-07. They have not all been re-audited for this revision and are not evidence that a V21-specific behavior applies to the user's V20 build.

**Limited v0.3 source check:** on 2026-11-07, the selected Fanqi repository page and Pi SDK, RPC, security, and extension documentation were consulted for S31-S35. These are mutable upstream pointers, not pinned build evidence. No TIA installation, Pi integration, chat application, or simulator was executed during preparation of this Markdown file. User-reported earlier smoke tests are recorded separately in section 4.4.

Each reference supports the limited factual claims attributed to it. The proposed architecture, security policy, schemas, milestones, and tests are Simon design requirements, not promises made by Siemens or upstream maintainers.

### S01: Siemens: Connecting to the TIA Portal (V21)

[Open primary source][S01]

Process attachment, starting an instance, and version-specific Siemens assembly loading.

### S02: Siemens: Programming language SCL (V21)

[Open primary source][S02]

SCL language background and its relationship to Structured Text.

### S03: Siemens: Exporting blocks (Openness V21)

[Open primary source][S03]

XML export prerequisites, supported block/language categories, and exported attributes.

### S04: Siemens: SIMATIC SD block export/import (V21)

[Open primary source][S04]

Source-document representations, resource files, supported languages, and round-trip restrictions.

### S05: Siemens: Transaction handling (Openness V21)

[Open primary source][S05]

Transactions, commit/rollback behavior, and operations prohibited within a transaction. Essential reading before implementing writes.

### S06: Siemens: Compiling a project (Openness V21)

[Open primary source][S06]

Compilation services, supported engineering targets, offline prerequisites, and structured results.

### S07: Siemens: Getting Cross References for Step7 (V21)

[Open primary source][S07]

Cross-reference access and limitations around underlying member objects.

### S08: Siemens: Cybersecurity information, STEP 7 Readme (V21)

[Open primary source][S08]

TIA Help Viewer port information. This does not establish an indexing API.

### S09: Siemens: Creating Add-Ins for Microsoft Visual Studio (V21)

[Open primary source][S09]

Documented add-in templates, including project-tree context-menu integrations.

### S10: Siemens: Eigen Engineering Agent

[Open primary source][S10]

Commercial product positioning and advertised capabilities. Not an independently verified benchmark.

### S11: Czarnak: tia-portal-mcp repository

[Open primary source][S11]

Candidate open-source integration. Audit current code, license, and reachable operations at a pinned commit.

### S12: Czarnak: tia-portal-mcp architecture

[Open primary source][S12]

Maintainer description of the host/worker split, access modes, project binding, and write behavior.

### S13: JasonJJQ: tiaportal-mcp repository

[Open primary source][S13]

Alternative bridge candidate with version-selection and document-operation notes.

### S14: renanlido: tia-harness repository

[Open primary source][S14]

Open client layer and its documented dependency on a separately licensed engine.

### S15: feelautom: tia-copilot-genai-bridge repository

[Open primary source][S15]

Integration reference whose documentation distinguishes public components from a private core.

### S16: OpenAI: Codex Model Context Protocol documentation

[Open primary source][S16]

Official Codex MCP integration entry point; it redirected to OpenAI's current documentation during research. Recheck harness/version-specific setup.

### S17: Anthropic: Connect Claude Code to tools via MCP

[Open primary source][S17]

Official Claude Code external-tool integration documentation.

### S18: Siemens: SIMATIC SD block export/import (V20 baseline)

[Open primary source][S18]

Evidence that language and format support must be checked per version/update rather than generalized from V21.

### S19: Siemens: Notes on the SIMATIC SD format (V21)

[Open primary source][S19]

Readme restrictions, including organization-block behavior and language-resource export caveats.

### S20: Siemens: Exporting program block as document (Openness V21)

[Open primary source][S20]

Programmatic document export and result data. Resolve exact signatures against the installed API.

### S21: Siemens: Saving blocks as external source files (V21)

[Open primary source][S21]

Source-generation behavior and examples of information not retained by particular export paths.

### S22: SQLite: FTS5 Extension

[Open primary source][S22]

Primary documentation for the proposed local full-text index.

### S23: Pi coding-agent README

[Open primary source][S23]

Pi README pointer inherited from v0.2. Use it as background and pin the actual release/package identity; do not assume old MCP-loading or package-name details remain unchanged. The limited v0.3 SDK/RPC/security checks are separately recorded as S32-S35.

---

### S24: Herdr: Documentation and agent-led onboarding

[Open primary source][S24]

Documents the agent-guide approach to helping users learn and configure the app. Supports the interaction inspiration, not a claim that Simon already implements it.

### S25: Herdr: Configuration

[Open primary source][S25]

Describes configuration and reloading most UI settings without restarting panes; startup-only settings remain different.

### S26: Herdr: Plugins and trust model

[Open primary source][S26]

Describes executable workflow packages and explicitly states that plugin code is not sandboxed. This is a design contrast, not a security model to copy into Simon.

### S27: Electron: Security

[Open primary source][S27]

Primary guidance on renderer isolation, sandboxing, IPC validation, and limiting privileged access. Relevant only if that UI stack is selected; it does not prove isolation in Simon.

### S28: Tauri: Capabilities

[Open primary source][S28]

Documents per-window/webview permissions and the effect of overlapping capabilities. A candidate implementation reference, not a mandated stack.

### S29: GitHub: Creating a pull request from a fork

[Open primary source][S29]

Describes fork-based contributions and draft pull requests. Exact access, organization policy, and remote visibility must still be checked.

### S30: GitHub: Protected branches

[Open primary source][S30]

Documents required reviews, status checks, and bypass-related settings that maintainers can configure around the contribution process.

---

### S31: Fanqi-dev: tia-v20-unified-mcp

[Open selected repository][S31]

User-selected integration base. The inspected README describes a standalone stdio .NET Framework 4.8 server for local V20 projects, including project inspection and XML-based operations. That description is not independent validation of every operation, rollback claim, or license. The user's earlier basic connection/read test is recorded in section 4.4.

### S32: Pi: SDK integration

[Open primary source][S32]

Documents in-process integration, sessions, resources, tool configuration, and events. The inspected page describes explicit SDK loading of CLI-provided built-in extensions. Exact API names and package identity must be pinned to the implementation release.

### S33: Pi: RPC mode

[Open primary source][S33]

Documents headless subprocess integration through structured commands, responses, and events. Used only to establish the SDK/RPC integration choices and their lifecycle distinction; Simon's proposed event/project/approval contracts are its own design.

### S34: Pi: Run Pi safely

[Open primary source][S34]

Explains the runtime's user-permission model and the distinction between project trust, tool execution, and enforced isolation. Supports the requirement not to treat Pi, a working directory, or a separate session as Simon's security boundary.

### S35: Pi: Extensions

[Open primary source][S35]

Documents extension hooks, custom tools and commands, and their execution inside the runtime process. Supports the customization mechanism, not a claim that Simon's UI activation/recovery system is already implemented or automatically supplied by Pi.

---

### Reference links

[S01]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/general-functions/connecting-to-the-tia-portal
[S02]: https://docs.tia.siemens.cloud/r/en-us/v21/creating-scl-programs/basics-of-scl/programming-language-scl
[S03]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/importing/exporting-data-of-a-plc-device/blocks/exporting-blocks
[S04]: https://docs.tia.siemens.cloud/r/en-us/v21/creating-and-managing-blocks/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500-s7-1200-g2/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500-s7-1200-g2
[S05]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/general-functions/transaction-handling
[S06]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-projects-and-project-data/compiling-a-project
[S07]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/tia-portal-openness-api/functions-for-accessing-the-data-of-a-plc-device/functions-for-accessing-plc-service/getting-cross-references-for-step7
[S08]: https://docs.tia.siemens.cloud/r/en-us/v21/readme-step-7/cybersecurity-information
[S09]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-add-in-development-tools/creating-add-ins-in-microsoft-visual-studio/creating-add-ins-for-microsoft-visual-studio
[S10]: https://www.siemens.com/en-us/products/tia-portal/eigen-engineering-agent/
[S11]: https://github.com/Czarnak/tia-portal-mcp
[S12]: https://github.com/Czarnak/tia-portal-mcp/blob/main/docs/ARCHITECTURE.md
[S13]: https://github.com/JasonJJQ/tiaportal-mcp
[S14]: https://github.com/renanlido/tia-harness
[S15]: https://github.com/feelautom/tia-copilot-genai-bridge
[S16]: https://developers.openai.com/codex/mcp/
[S17]: https://code.claude.com/docs/en/mcp
[S18]: https://docs.tia.siemens.cloud/r/en-us/v20/creating-and-managing-blocks/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500
[S19]: https://docs.tia.siemens.cloud/r/en-us/v21/readme-step-7/programming-a-plc/notes-on-the-simatic-sd-format
[S20]: https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows/export/import/importing/exporting-data-of-a-plc-device/blocks/exporting-program-block-as-document
[S21]: https://docs.tia.siemens.cloud/r/en-us/v21/creating-and-managing-blocks/using-external-source-files-for-stl-and-scl/saving-blocks-as-external-source-files
[S22]: https://sqlite.org/fts5.html
[S23]: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md
[S24]: https://herdr.dev/docs/
[S25]: https://herdr.dev/docs/configuration/
[S26]: https://herdr.dev/docs/plugins/
[S27]: https://www.electronjs.org/docs/latest/tutorial/security
[S28]: https://v2.tauri.app/security/capabilities/
[S29]: https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork
[S30]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

[S31]: https://github.com/Fanqi-dev/tia-v20-unified-mcp
[S32]: https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md
[S33]: https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/rpc.md
[S34]: https://pi.dev/docs/latest/security
[S35]: https://pi.dev/docs/latest/extensions


---

## Appendix A. Revision lineage and requirements preservation

### A.1 Authority and history

| Source | How v0.3 uses it |
| --- | --- |
| `Simon.md` (v0.1) | Historical origin of the product definition and controlled engineering workflow; not a competing active plan. |
| `Simon_v0.2.md` | Primary structural and engineering baseline. Its 36 numbered sections remain represented; safeguards, source register, customization and publication requirements are preserved or explicitly reconciled. |
| `SIENA_PLAN.md` | Intermediate architecture discussion emphasizing reuse. Retain the separation of UI, harness, model, engineering service, and bridge; retire mandatory VS Code and generic second-harness work. |
| Later user decisions in this conversation | Restore Simon naming/slogans; reuse `mcp-agent-chat`; select Pi and the Fanqi base; use SCL/XML chat diffs; retain self-improvement and recover v0.2 detail. |
| `mcp-agent-chat/handoff.md` | Referenced by the user but not supplied/inspected for this revision. Required implementation input, not an assumed source of facts. |
| S31-S35 | Narrow external mechanism checks made for v0.3; do not replace the source-derived product requirements. |

This handoff consolidates the currently accepted direction. A new explicit user decision can revise it, but a coding agent must not silently choose an older conflicting requirement from SIENA or reinterpret the user's preferences as permission to remove safeguards.

### A.2 Recovered engineering content

| v0.2 requirement family | v0.3 home |
| --- | --- |
| Exact environment/capability identity and safe deployment | Sections 10-11 and 22 |
| Project binding, source freshness, concurrent human edits | Section 12 |
| Original exports, parsed representations, source maps, metadata preservation | Sections 13-14 |
| Exact/structural retrieval, optional semantic retrieval, version-aware docs | Sections 15-16 |
| Approved conventions and instruction workflow | Section 17 |
| Exact change artifacts and independent authorization | Section 18 |
| Change state machine and separate validation outcomes | Section 19 |
| Transaction/compile separation, recovery, unknown outcome, bounded repair | Section 20 |
| PLC semantics and engineer-defined behavioral tests | Section 21 |
| Prompt injection, cloud data policy, path validation, isolation | Section 22 |
| Storage, audit, source provenance, Velocity independence | Section 23 |
| Qualification milestones, failure matrix, acceptance evidence | Sections 29-32 |
| Agent-led navigation, local packages, protected controls, preview/undo | Section 34 |
| Optional sanitized publication and maintainer-controlled releases | Section 35 |

### A.3 Explicit changes rather than silent omissions

- **Name:** Simon / SIMON. SIENA is history, not a separate required app.
- **Frontend:** reuse the existing chat app; TIA is the editor. VS Code may be a developer tool only.
- **Harness:** Pi only for the current plan. Codex is previous implementation/test context; no new second-harness deliverable is implied.
- **Bridge:** Fanqi is selected, not merely one candidate in an open shortlist. Audit/pin/qualify the selected code without discarding the useful baseline.
- **Review:** SCL source diffs and FBD/LAD XML diffs plus network explanations; graphical rendering later.
- **Self-improvement:** retained and made incremental. It is not unrestricted live self-modification, automatic deployment, or mandatory publication.
- **Manual/Auto controls:** retained as an interface concept; proposed scope is explicit in section 18.6. Original-project auto-write authority is not inferred from the generic toggle.
- **Performance:** Pi selection is a decision; numerical efficiency claims remain unmeasured.

### A.4 Immediate implementation checkpoint

Read the actual chat-app handoff and repository, capture the working Fanqi checkout, and prove one Pi-driven read-only question from that same UI. Preserve a source-linked answer and the correct project identity. Then work through the retained round-trip, review, and recovery gates before original-project writes.

---

**End of handoff. Reuse the existing chat application, run Pi behind it, build on the selected Fanqi bridge, keep TIA as the editor, and preserve the engineering, customization, and publication boundaries of Simon v0.2.**
