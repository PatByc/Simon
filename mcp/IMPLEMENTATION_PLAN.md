# Simon MCP implementation progress

Updated: 2026-11-09

## Safety preflight

- [x] **Step 0 — Audit and incorporate the TIA V20 MCP worker.** The reviewed source was incorporated under `Simon/mcp/worker/tia/v20/` with locked dependencies and retained MIT attribution. Generated binaries, exports, proprietary Siemens files, and project assets were excluded.

## Completed package work

- [x] 1. Organize `Simon/mcp/` around responsibilities.
- [x] 2. Establish the top-level workspace structure.
- [x] 3. Place MCP protocol hosting under `server/`.
- [x] 4. Place the authoritative tool catalog under `registry/`.
- [x] 5. Add domain-oriented contracts.
- [x] 6. Place security and effect classification under `policy/`.
- [x] 7. Define effects independently from integrations.
- [x] 8. Group tools by engineering capability.
- [x] 9. Keep tool implementations separated by practical capability files.
- [x] 10. Add generic connector interfaces.
- [x] 11. Name the implementation `connectors/tia/v20`, not `fanqi`.
- [x] 12. Preserve a versioned TIA connector seam.
- [x] 13. Preserve generic connector extension seams.
- [x] 14. Keep process/MCP stdio management reusable.
- [x] 15. Keep the complete upstream map in the TIA V20 connector.
- [x] 16. Keep Simon exposure in the registry and policy.
- [x] 17. Record upstream, connector, and Simon names separately.
- [x] 18. Record complete effect/exposure/state/artifact metadata.
- [x] 19. Add connector capability contracts.
- [x] 20. Report unsupported connector capabilities explicitly.
- [x] 21. Add an opaque artifact subsystem.
- [x] 22. Keep local artifact paths out of public records.
- [x] 23. Add observability and redaction contracts.
- [x] 24. Add stable correlation identifier contracts.
- [x] 25. Add fake connector and test support.
- [x] 26. Keep tests outside production source.
- [x] 27. Generate the overall `TOOL_MAPPING.md` matrix.
- [x] 28. Validate mapping documentation from registry metadata.
- [x] 29. Limit connector identity to provenance.
- [x] 30. Centralize trusted configuration.
- [x] 31. Deny arbitrary connector commands and environments.
- [x] 32. Follow dependency-ordered implementation.
- [x] 33. Implement common contracts.
- [x] 34. Implement effect and exposure policy.
- [x] 35. Implement connector interfaces.
- [x] 36. Implement deterministic fake connector.
- [x] 37. Implement the denied-by-default registry.
- [x] 38. Implement 18 initial read-only tools.
- [x] 39. Implement generic MCP stdio client/process support.
- [x] 40. Implement the TIA V20 connector and project-change guard.
- [x] 41. Implement controlled artifacts.
- [x] 42. Implement Simon MCP SDK/stdin-stdout server transport.
- [x] 43. Integrate the Simon backend/Pi adapter behind explicit `tia-readonly` configuration.

## Live gate and final boundaries

- [x] **44. Live TIA qualification.** The incorporated worker attached through Siemens Openness to the `aiagent` TIA V20 instance with an open local project. State, open-project listing, and project-tree retrieval succeeded.
- [x] 45. Workflows remain in the Simon application/Pi layer; the connector exposes atomic capabilities only.
- [x] 46. Approval authority remains in the Simon application backend; no approval or proposal authority exists in `Simon/mcp`.
- [x] 47. The initial read-only mapping was compared with the live MCP catalog: 18 model tools and three host-only lifecycle tools.
- [x] 48. `README.md` documents the incorporated architecture and exact live evidence.
- [x] 49. The expansion checklist was applied to host-only process discovery and selected-process attachment.
- [x] 50. A direct unclassified `SaveProject` call was rejected by the Simon MCP façade.
- [x] 51. Application-owned process discovery and explicit attachment endpoints were added; lifecycle tools remain hidden from Pi.
- [x] 52. Process identity now includes the stable Windows process start time rather than relying on Siemens discovery acquisition time.
- [x] 53. Conversation-scoped project bindings and connection epochs guard every Pi engineering tool call.
- [x] 54. Bounded inventory, capability coverage, diagnostics, safe detach, and reconnect-required restart behavior were application-live-qualified.

## Last automated verification

- MCP TypeScript tests: 17 passed.
- Incorporated worker tests: 2 passed.
- Server tests: 34 passed.
- Web tests: 15 passed.
- Contract tests: 9 passed.
- Full workspace typecheck: passed.
- Production build: passed.
- npm audit: 0 vulnerabilities.
- `git diff --check`: passed with line-ending warnings only.
