# M3.1 Startup and Index Baseline

**Date:** 2026-11-11
**Baseline under measurement:** M3 `e88dd31` plus M3.1 authority-boundary changes through Step 21
**Environment:** Production server build on the target Windows host, isolated ignored data directories, loopback ports, synthetic engineering mode

Raw logs and generated databases remain under ignored `tmp/` and `data/`. Results below contain only aggregate timing, count, and byte measurements.

## Before optimization

| Scenario | Runtime | Loopback documentation-status ready | Topics | Exact search | Runtime bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| Clean installed help | Fake | 41.7 s | 556 | 61.4 ms | 14,316,824 |
| Warm unchanged installed help | Fake | 36.4 s | 556 | 130.5 ms | 15,468,712 |
| Warm unchanged installed help | Pi | 43.3 s | 556 | 138.2 ms | 15,476,952 |
| Missing installed root | Fake | 32.9 s | 0 | 69.0 ms | 349,648 |
| Corrupt configured packages | Fake | 39.7 s | 0 | 97.5 ms | 349,648 |

All scenarios reported the official-online source as rights-blocked. Missing/corrupt local sources reported partial status and zero current local sources.

## Attribution measurements

- Importing the compiled application module took about 4.2 seconds.
- Importing the compiled Pi adapter took about 30.0 seconds.
- Importing documentation-ingestion code took about 4.0 seconds.
- The production entry point imports Pi eagerly even in fake runtime.
- Installed-help initialization runs synchronously before Fastify listens.
- An unchanged warm start performs ingestion/source replacement again rather than proving and reusing an unchanged index.

The dominant fake-runtime delay is therefore eager Pi loading, followed by synchronous source initialization. Exact indexed searches are already comfortably sub-second.

## Engineer-approved M3.1 budgets

The project owner approved execution of the M3.1 plan, including measured startup budgets before optimization. The release-candidate budgets are:

1. **Loopback application readiness:** `/api/v1/status` responds within 15 seconds for fake runtime and within 60 seconds for default Pi runtime. Pi initialization completes before the listener opens so the product does not become temporarily unresponsive after first paint.
2. **Assistant readiness:** Default Pi reaches its normal ready/configuration result when the loopback application opens, within the same 60-second target-host budget.
3. **Missing/corrupt documentation:** The application serves within 15 seconds and exposes a bounded failed/partial terminal source state within five seconds after the listener opens.
4. **Warm unchanged documentation:** Existing indexed evidence remains queryable immediately when the application opens; background fingerprint confirmation reaches terminal state within 15 seconds without full source replacement.
5. **Clean installed documentation:** After the application listener opens, the three-package background index reaches ready/partial terminal state within 25 seconds without blocking browser/Pi request handling.
6. **Search latency:** Exact and lexical documentation requests complete within 500 ms each for the current 556-topic source set, excluding intentional ambiguity errors.
7. **Privacy:** Timing/status output contains no raw installed root, user path, package body, credential, session, project identity, or machine identifier.

Budgets are target-host release gates, not universal hardware guarantees. Any miss must be fixed or recorded as an explicit accepted limitation before M3.1 acceptance.

## After M3.1 startup/index changes

| Scenario | Application ready | Documentation terminal after listener | Assistant ready | Exact search | Runtime bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clean installed help, fake | 11.6 s | 10.9 s | 11.6 s | 98.9 ms | 14,333,304 |
| Warm unchanged help, fake | 13.3 s | 42 ms | 13.3 s | 108.2 ms | 14,333,304 |
| Warm unchanged help, Pi | 55.4 s | 19 ms | 55.4 s | 92.8 ms | 14,333,304 |
| Missing installed root, fake | 10.3 s | 3.6 s | 10.3 s | n/a | 374,368 |
| Corrupt configured packages, fake | 13.0 s | 3.3 s | 13.0 s | n/a | 374,368 |

Results meet the final target-host budgets. The unchanged warm index kept identical runtime bytes and became available immediately after the listener opened. Clean indexing moved to a local worker and completed without delaying initial application readiness. Pi initialization remains the dominant default-runtime startup cost, so it completes before the listener opens; measured post-listener status response time was 43 ms rather than a temporary multi-second event-loop stall.
