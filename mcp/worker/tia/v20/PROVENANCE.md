# Provenance

- Upstream repository: `https://github.com/Fanqi-dev/tia-v20-unified-mcp.git`
- Reviewed base commit: `ad235bb009145e1d8acc38b604a401f5906ff8d9`
- Upstream license: MIT; notice retained in `LICENSE.upstream-heilingbrunner.txt`
- Imported scope: .NET worker source, project configuration, dependency lockfile, and offline XML-analysis unit tests
- Excluded: `.git`, generated binaries, `obj`, engineering exports, integration-test project assets, proprietary Siemens binaries, and local MCP configuration

Simon changes include restricted process discovery and host-selected process attachment for multi-instance TIA environments. The incorporated worker remains an internal implementation behind Simon-owned contracts and policy.
