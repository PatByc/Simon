# M3 Official Siemens Source Research

**Observed:** 2026-11-11
**Scope:** Current public source behavior, release labels, stable citation candidates, crawl signals, and terms relevant to automated ingestion. Only Siemens primary sources are used for conclusions.

## TIA Documentation Portal

- Root: <https://docs.tia.siemens.cloud/r/en-us/v20/>
- The portal exposes release-scoped readable URLs using `/r/{locale}/{version}/{topic-slug}`.
- The V20 instruction landing page identifies product `STEP 7`, version `V20`, publication date `11/2024`, and language `en-US`: <https://docs.tia.siemens.cloud/r/en-us/v20/instructions-s7-1200-s7-1500>.
- Topic pages can carry narrower applicability in their content, including CPU family, firmware, and instruction-version details. URL release labels alone do not establish those narrower dimensions.
- Direct HTTP retrieval returns a JavaScript application shell; rendered topic content is loaded separately. Search engines currently index rendered topic text and metadata, but that behavior is not an ingestion contract.
- `robots.txt` disallows by default while explicitly allowing `/r/*`, selected reader/viewer/API paths, and sitemaps: <https://docs.tia.siemens.cloud/robots.txt>. Robots rules describe crawler routing; they do not grant content-use rights.
- Stable human citations should use the release-scoped `/r/...` topic URL, not internal API or reader endpoints.

## Siemens Industry Online Support (SIOS)

- V20 update entry: <https://support.industry.siemens.com/cs/document/109963851/tia-portal-v20-updates?dti=0&lc=en-WW>.
- V20 installation manual attachment: <https://support.industry.siemens.com/cs/attachments/109963850/Install_STEP7_WinCC_V20_enUS.pdf>.
- SIOS document pages are JavaScript-rendered, while attachment URLs are directly retrievable and use stable numeric entry IDs.
- The support `robots.txt` publishes sitemaps and permits ordinary document/attachment routes, but disallows specific XML/PDF topic-download endpoints and account/interactive routes: <https://support.industry.siemens.com/robots.txt>.
- A stable SIOS citation should retain the document/item ID, title, publication/revision date, locale, and direct Siemens URL.

## Terms and rights result

Siemens' current general terms apply to Siemens websites and functionally related online services: <https://www.siemens.com/en-us/terms-of-use/>.

Relevant current clauses state that:

- use of information and documentation is limited to the agreed or Siemens-intended purpose for the user's own business purposes;
- information and documentation may not be distributed or otherwise made available to third parties unless separately allowed; and
- users must not engage in text or data mining, including automated scraping, reproduction, or extraction of content/data for analysis or for developing, training, or improving AI or machine-learning systems.

These terms are more restrictive than the portal robots allowlist. Simon therefore must not implement automated crawling/indexing of the public TIA Documentation Portal or SIOS for M3 without separately verified permission or specific controlling license terms. Simon also must not upload Siemens documentation to an external provider.

## M3 implementation decision from research

1. The initial real documentation adapter is local installed V20 help only.
2. Official online URLs may be retained as human citation/fallback links when supplied by a controlled source record, but Simon will not fetch or index their body automatically in M3.
3. The official-online ingestion adapter remains disabled with a rights-blocked status until explicit permission or applicable license terms are recorded.
4. Synthetic fixtures may model official-online metadata and retrieval behavior without copying Siemens text.
5. Live qualification uses installed local help; an inability to retrieve online content is reported as a deliberate rights boundary, not a service failure.
6. If rights are later established, online ingestion must still use allowlisted Siemens hosts, release-scoped URLs, bounded rates/bytes/duration, stable source IDs, and explicit applicability metadata.

## Source-behavior limitations

- Portal HTML/API implementation details can change and are not a supported public API contract.
- Publication date and release label do not prove CPU, firmware, language, or instruction-version applicability.
- Search indexing proves discoverability, not permission to bulk ingest.
- Robots permission does not override terms, copyright, product licenses, authentication, or rate limits.
