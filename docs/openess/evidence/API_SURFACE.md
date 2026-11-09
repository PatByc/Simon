# Verified Openness V20 API surface

This is a focused static inventory from the installed V20 `Siemens.Engineering.dll` and its companion XML documentation. Signatures are declarations, not runtime observations.

## Portal lifecycle and attachment

```csharp
new TiaPortal(TiaPortalMode.WithUserInterface)
new TiaPortal(TiaPortalMode.WithoutUserInterface)
TiaPortal.GetProcesses()
TiaPortalProcess.Attach()
tiaPortal.ExclusiveAccess()
tiaPortal.ExclusiveAccess(string text)
```

Observed process/session metadata includes process ID/path/mode/project path, installed software, attached sessions, access level, trust authority, and attach timing.

## Transactions

```csharp
ExclusiveAccess.Transaction(ITransactionSupport target, string text)
Transaction.CommitOnDispose()
Transaction.CanCommit
Transaction.CommitRequested
```

The API model is an explicit exclusive-access session containing a transaction. `CommitOnDispose()` requests commit; disposal without that request is the rollback-oriented pattern described by Siemens documentation. Compile and project save must be treated as later workflow stages, outside the mutation transaction.

## Compilation

```csharp
ICompilable compileService = engineeringObject.GetService<ICompilable>();
CompilerResult result = compileService.Compile();
```

Verified result fields:

- `State`
- `ErrorCount`
- `WarningCount`
- `Messages`

Compiler states declared by the V20 API: `Success`, `Information`, `Warning`, and `Error`. A returned result must be inspected; invoking `Compile()` alone is not evidence of success.

## Project persistence

```csharp
project.Save();
project.SaveAs(DirectoryInfo destination);
```

Saving is distinct from transaction commit and compilation. Simon should model mutation, transaction completion, compile, readback verification, and save as separate stages with separate failure outcomes.

## PLC block exchange

SIMATIC ML/XML:

```csharp
plcBlock.Export(FileInfo file, ExportOptions options);
plcBlock.Export(FileInfo file, ExportOptions options, DocumentInfoOptions documentInfo);
plcBlockComposition.Import(FileInfo file, ImportOptions options);
plcBlockComposition.Import(FileInfo file, ImportOptions options, SWImportOptions swOptions);
```

Document exchange:

```csharp
plcBlock.ExportAsDocuments(DirectoryInfo directory, string baseName);
plcBlockComposition.ImportFromDocuments(
    DirectoryInfo directory,
    string baseName,
    ImportDocumentOptions options);
```

The V20 API also declares block properties useful for verification and policy, including `Name`, `Number`, `ProgrammingLanguage`, `IsConsistent`, `IsKnowHowProtected`, compile/modified dates, and interface/code modification state.

## Source generation

The API declares marker interface `Siemens.Engineering.SW.ExternalSources.IGenerateSource` and generation methods on `PlcExternalSourceSystemGroup`:

```csharp
GenerateSource(IEnumerable<IGenerateSource> objects, FileInfo destination);
GenerateSource(
    IEnumerable<IGenerateSource> objects,
    FileInfo destination,
    GenerateOptions options);
```

This route is separate from SIMATIC ML/XML block export and document export. Generated source must not be assumed to be a lossless backup of every engineering property.

## Cross references

```csharp
CrossReferenceResult result =
    crossReferenceService.GetCrossReferences(CrossReferenceFilter filter);
```

The assembly declares source objects, reference objects, locations, access/reference types, and result compositions. Siemens documentation notes that textual reference information can exist when no engineering object is returned for a member-level result; callers must preserve both forms.

## Version and schema handling

The installed V20 PublicAPI ships multiple schema generations side by side. Code should:

1. Read the namespace/schema declarations from each export.
2. Validate against the matching installed XSD when validation is required.
3. Preserve unknown elements and version identity where round-tripping matters.
4. Avoid rewriting an export to a newer schema merely because V20 includes it.
5. Treat XML/document/source routes as different representations with different fidelity and supported objects.

## Evidence and limitations

- Assembly identity evidence: `ev_1ca310e4e0f665b337808d567df45b9f83209d7139bc70df07a155d3f25999a7`
- Focused member evidence: `ev_9924163593006676228390ade2409c76c0955ecbe357a6427d0059178b65cded`
- Artifact SHA-256: `94fa4550e591469842a38cd7a63625770787142607f71a9e0eec5907734c529f`
- Module MVID: `1c1171fa-f5d8-4a1c-b822-c46b4ea0bcb3`

The analysis was static. It does not establish runtime eligibility, supported services for a particular project object, or successful execution against a project.
