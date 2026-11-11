# Installed TIA Portal V20 Help Discovery

**Observed:** 2026-11-11
**Method:** Authorized read-only inspection of installed package metadata, directory/file metadata, ZIP central-directory entries, and a bounded sample of HTML title/meta fields. No executable was launched, no archive was modified, and no proprietary help body was copied into the repository.

## Installation identity

- Siemens publisher metadata identifies TIA Portal V20 / STEP 7 V20.
- The installed STEP 7 package is labelled `V20.0 UPD7`.
- The installed package registry reports product version `20.00.0000`; update identity therefore comes from the package display label, not the numeric version field.
- Other installed V20 components may have different update labels. A STEP 7 claim must not be generalized to every component.

## Discovered local sources

Paths below are symbolic installation-relative locations, not captured machine paths.

### `%PROGRAMFILES%/Siemens/Automation/Portal V20/Help/en-US`

- 693 files; approximately 305 MB compressed/on-disk in the observed installation.
- 673 ZIP packages, 5 CHM files, 4 XML files, and 11 PNG files.
- ZIP package names partition topics by product area, including STEP 7 basics, PLC programming, SCL, tags, interfaces, instruction references, Openness, motion, and HMI/WinCC material.
- A bounded sample showed ordinary ZIP containers with HTML topic files and image/style assets. No encryption or proprietary container parser was required for the sampled packages.
- HTML metadata includes stable package/topic IDs, culture, component, documentation scope, TOC relationships/order, title, and topic-level `HelpScope` expressions such as CPU-family constraints.
- Sampled topic metadata did not contain an explicit TIA Portal release/update field. Source-level release identity must therefore come from the allowlisted installation/package record, while topic-level CPU/device applicability comes from topic metadata when present.

### `%PROGRAMFILES%/Siemens/Automation/Portal V20/Manuals/en-US`

- One observed PDF programming manual, approximately 8.3 MB.
- PDF extraction feasibility was not qualified in this step. It is a separate adapter/format decision and must not be assumed from the HTML ZIP result.

### Legacy/special formats

- Five CHM files were present for migration, installation, and readme material.
- CHM extraction was not qualified. Initial M3 ingestion should not depend on CHM support.
- The root `HelpParseInfo.xml` identifies a standalone master help package and a help-system configuration version; it is discovery metadata, not a complete version/applicability authority.

## Applicability findings

- **Source product/release:** known for the allowlisted STEP 7 installation as V20, Update 7.
- **Topic component/culture:** available in sampled HTML metadata.
- **Topic CPU/device scope:** available for some topics through `HelpScope`; absence means unknown, not universal.
- **Topic firmware/update/language applicability:** not established by this inspection unless explicitly present in a future topic record.
- **Cross-component applicability:** unknown unless the source package and topic metadata establish it.

## Rights and privacy posture

The installed files are Siemens product content. This inspection found no evidence that Simon may redistribute the corpus, commit it, upload it to an external model/provider, or expose raw installation paths. M3 must therefore default to local indexing and bounded local excerpts only. Any broader use requires separately verified rights. Generated indexes and extraction artifacts belong under ignored Simon runtime storage.

## Implementation constraints derived from inspection

1. Discover only an application-configured V20 installation root; never accept a caller-selected path.
2. Initially allowlist English ZIP/HTML packages needed for qualified STEP 7 instruction retrieval.
3. Validate ZIP entries against traversal, decompression size, entry count, and duration limits before reading.
4. Extract text and selected `Siemens.TIAHelp.*` metadata without executing scripts or resolving external resources.
5. Record package filename, internal topic ID, source-level product/update, topic scope expression, content hash, and extraction method.
6. Keep missing scope fields unknown and preserve the original scope expression as untrusted metadata.
7. Do not ingest CHM or PDF until each format has an independently tested bounded adapter.
8. Never copy the installed corpus or generated local index into committed evidence.

## Qualification result

Installed V20 help is technically discoverable and the sampled STEP 7 ZIP/HTML format is suitable for a bounded local-only adapter. Rights beyond local installed-product use remain unverified, and topic-level release/update applicability remains incomplete. Implementation may proceed only with those limitations encoded explicitly.
