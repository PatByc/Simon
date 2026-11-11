# M2 Read-Only Live Qualification

## Rules

- Record capability, object class, result state, coverage, and sanitized evidence only.
- Do not record project names, project paths, source text, tag names, device identifiers, process IDs, usernames, or export directories.
- `live-tested` requires invocation through the Simon MCP façade against the explicitly selected TIA V20 project.
- `partial` means useful evidence was returned with known omissions.
- `unsupported` is an acceptable qualified result when the limitation is explicit.
- No compile, import, save, source generation, project lifecycle mutation, or online PLC operation may be invoked.

## Existing model-tool matrix

| Simon tool | Object class | Expected evidence | Status | Sanitized result |
| --- | --- | --- | --- | --- |
| `simon_tia_get_state` | connection | attached state and active project presence | live-tested (M1) | Connected state returned. |
| `simon_tia_get_open_projects` | project | one unambiguous open project | live-tested (M1) | Bound project matched without retaining its identity. |
| `simon_tia_get_project_tree` | project hierarchy | bounded project tree | live-tested (M1) | Tree returned with partial nested coverage. |
| `simon_tia_list_devices` | device | bounded device collection | live-tested | Device collection returned. |
| `simon_tia_get_device` | device | attributes for one discovered path | partial | Addressable top-level device returned; names containing the path delimiter require a resolver fix. |
| `simon_tia_get_device_item` | device item | attributes for one discovered child path | live-tested | Discovered child item returned. |
| `simon_tia_get_software` | PLC software | software metadata for one discovered path | live-tested | Two discovered PLC software containers were readable. |
| `simon_tia_get_software_tree` | software hierarchy | blocks, types, and sources tree | live-tested | Software hierarchy returned for both representative containers. |
| `simon_tia_get_block` | block | metadata for one full block path | partial | Block metadata returned after removing the display-only root-group prefix. |
| `simon_tia_find_blocks` | blocks | bounded block enumeration | partial | Smaller software completed; the larger software exceeded the current 30-second operation timeout. |
| `simon_tia_get_block_tree` | block hierarchy | grouped block paths | partial | Smaller software completed; the larger software exceeded the current 30-second operation timeout. |
| `simon_tia_analyze_db_members` | DB definitions | exported count, member count, issues, freshness | partial | Smaller software completed; the larger software exceeded the current 120-second operation timeout. |
| `simon_tia_analyze_parameter_dbs` | parameter DBs | bounded members and usage counts | live-tested | Bounded parameter DB analysis completed from a controlled snapshot. |
| `simon_tia_find_tag_usages` | references | bounded exact symbol references | live-tested | Bounded reference analysis completed from the cached snapshot. |
| `simon_tia_analyze_analog_inputs` | analog references | bounded channel evidence or explicit zero coverage | live-tested | Operation completed with bounded result metadata. |
| `simon_tia_analyze_analog_outputs` | analog references | bounded channel evidence or explicit zero coverage | live-tested | Operation completed with bounded result metadata. |
| `simon_tia_get_plc_type` | PLC type | metadata for one full type path | partial | Type metadata returned after removing the display-only root-group prefix. |
| `simon_tia_find_plc_types` | PLC types | bounded type enumeration | live-tested | Type enumeration completed for both representative containers. |

## New M2 object matrix

| Object/source class | Required operation | Qualification state | Coverage notes |
| --- | --- | --- | --- |
| PLC tag tables | direct Openness enumeration | live-tested | Two PLC software containers returned stable engineering paths and direct tag counts; response limits and truncation are explicit. |
| PLC tags | direct Openness enumeration | live-tested | Two PLC software containers returned bounded name, data type, logical address, comment, and table-path fields; one response demonstrated explicit truncation. |
| OB/FB/FC metadata | existing block reads | live-tested | Representative OB, FB, and FC objects were discovered by metadata and exported through controlled internal operations. |
| DB definitions/interfaces | controlled XML export | live-tested | Representative DB XML contained the declared interface sections and members. |
| UDT/type definitions | type read plus controlled export | live-tested | A representative UDT was read by engineering path and exported as bounded XML with interface members. |
| SCL source | controlled internal export | live-tested | XML retained structured-text nodes and the V20 document export produced one human-readable `s7dcl` artifact. |
| LAD source/document | V20 document export | live-tested | XML retained structured graphical-network data; V20 document export produced the paired textual declaration and binary resource artifacts. Treat the pair as a vendor document, not reconstructed source. |
| FBD source/document | V20 document export | partial | XML retained structured graphical-network data, including mixed-language nodes. V20 document export was rejected because this project requires vendor SD-export enablement; no reconstruction was attempted. |
| Symbol references | snapshot analysis | live-tested | Exact symbol lookup returned one bounded reference with a source-linked citation and current freshness. |
| Devices/device items | direct Openness reads | partial | Direct reads succeeded, with a known path-delimiter limitation and nested-hardware omissions still to investigate. |

## Qualified format interpretation

- XML exports are treated as Siemens engineering documents, not normalized source text.
- SCL is the only qualified format with a standalone human-readable `s7dcl` source artifact.
- LAD requires its textual declaration and binary `s7res` resource to remain paired; Simon must not claim to reconstruct the diagram from prose.
- FBD is currently XML-only for the selected project. Its structured graphical network is indexable as metadata and references, but not as exact textual source.
- DB and UDT XML qualify interface/member extraction, not executable source.
- Unsupported or rejected document export remains a coverage limitation and never triggers generation, import, compilation, or project mutation.

## Application-level M2 matrix

| Flow | Required result | Status |
| --- | --- | --- |
| Create snapshot | immutable binding-scoped snapshot with limits and coverage | live-tested: partial snapshot completed with bounded objects, documents, bytes, and explicit complete/partial/failed coverage states |
| Exact retrieval | path/name/identifier/address lookup with ambiguity handling | live-tested: exact engineering-path, unique object-name, unique tag-name, and logical-address queries returned current cited hits; a colliding tag/table name failed closed as ambiguous |
| Lexical retrieval | FTS5 results after exact matches | live-tested: lexical fallback returned a current cited source hit |
| Citation retrieval | stable source-linked citation with freshness | live-tested: search and reference results included engineering path, observation time, freshness, and coverage |
| Pi grounded answer | answer cites snapshot evidence and limitations | live-tested: Pi used only snapshot status/search tools, cited an engineering path, disclosed freshness and partial coverage, and made no mutation claim |
| Detach guard | refresh and retrieval rejected after detach | live-tested: retrieval returned conflict after detach and persisted snapshot state changed to stale |
| Project safety | TIA and project remain open and unchanged | live-tested: attachable process still reported an open project and a post-flow read observed the project as unmodified |
