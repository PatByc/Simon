# Simon TIA Portal V20 worker

This is Simon's incorporated, version-specific .NET Framework 4.8 worker for Siemens TIA Portal V20 Openness.

It is derived from `Fanqi-dev/tia-v20-unified-mcp`, base commit `ad235bb009145e1d8acc38b604a401f5906ff8d9`, with local reviewed changes for Simon. The upstream MIT notice is retained in `LICENSE.upstream-heilingbrunner.txt`.

The worker is built and launched only through Simon. It is not exposed directly to Pi or the browser. Simon's TypeScript MCP façade controls tool exposure and blocks mutation tools during read-only operation.

Do not add generated binaries, Siemens proprietary assemblies, real projects, project archives, or engineering exports to version control.
