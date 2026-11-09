# Local TIA Portal Openness V20 artifact evidence

Generated: 2026-11-08T09:29:01Z

This file records read-only observations from the locally installed, licensed TIA Portal V20 PublicAPI. It does not copy Siemens binaries, XML documentation, manuals, or schemas into the repository.

## Installation observed

- Root: `C:\Program Files\Siemens\Automation\Portal V20\PublicAPI`
- Versioned API directories present: `V17`, `V18`, `V19`, `V20`, with corresponding Add-In directories.
- Primary inspected assembly: `V20\Siemens.Engineering.dll`
- Companion API documentation: `V20\Siemens.Engineering.xml`
- Companion HMI API: `V20\Siemens.Engineering.Hmi.dll` and `.xml`
- Hardware parameter reference: `V20\HW Parameter description\TIA Portal Openness Hardware parameters.pdf`
- PLC XML schemas: `V20\Schemas\*.xsd`

## Primary assembly identity

| Field | Observation |
|---|---|
| SHA-256 | `94fa4550e591469842a38cd7a63625770787142607f71a9e0eec5907734c529f` |
| File size | 2,724,352 bytes |
| Assembly name | `Siemens.Engineering` |
| Assembly version | `20.0.0.0` |
| File/product version | `2000.7.201.2` |
| Module MVID | `1c1171fa-f5d8-4a1c-b822-c46b4ea0bcb3` |
| Classification | Managed PE, .NET Framework, CIL, AnyCPU |
| Company/product metadata | Siemens / Totally Integrated Automation Portal |
| REA metadata coverage | Complete; no reported issues |

Assembly references observed by REA:

- `Siemens.Engineering.Contract` 20.0.0.0
- `Siemens.Engineering.Hmi` 20.0.0.0
- `Siemens.Engineering.ClientAdapter.Interfaces` 20.0.0.0
- `mscorlib`, `System`, `System.Core`, `System.Drawing`, and `System.Runtime.Remoting` 4.0.0.0

## REA evidence

- Managed artifact identity: `ev_1ca310e4e0f665b337808d567df45b9f83209d7139bc70df07a155d3f25999a7`
- Focused managed member inventory: `ev_9924163593006676228390ade2409c76c0955ecbe357a6427d0059178b65cded`
- Focused selection: 9 types, 10 fields, 228 methods, 359 call edges, and 227 field accesses.
- Selected types were all matched:
  - `Siemens.Engineering.TiaPortal`
  - `Siemens.Engineering.ExclusiveAccess`
  - `Siemens.Engineering.Transaction`
  - `Siemens.Engineering.Compiler.ICompilable`
  - `Siemens.Engineering.Compiler.CompilerResult`
  - `Siemens.Engineering.CrossReference.CrossReferenceService`
  - `Siemens.Engineering.SW.ExternalSources.IGenerateSource`
  - `Siemens.Engineering.SW.Blocks.PlcBlock`
  - `Siemens.Engineering.SW.Blocks.PlcBlockComposition`

REA inspection was static and execution-free. It did not load the assembly through the CLR, resolve dependencies at runtime, execute TIA Portal, or observe a project.

A V19-to-V20 `compare-managed-members` attempt returned partial/unavailable member coverage and therefore established no API differences. Evidence: `ev_aeb395c71673db12d332897dd06a36ab89e3f81f2c939d4ce7ee2eb60a130971`. Do not interpret its zero added/removed counts as API equality.

## XML documentation and schema identity

- `Siemens.Engineering.xml` SHA-256: `76e2e3901611bd0754d18e19b7bbc3c8713ce13572ae062a7a25f5571e8d597b`
- The XML documentation explicitly describes the selected public APIs, including attachment, transactions, compile results, block import/export, source generation, cross references, project save, and save-as.
- V20 contains 24 PLC-related XSD files.
- V20 retains both old and newer schema generations for several block formats:
  - Access v4 and v5
  - CompileUnitCommon v4 and v5
  - GRAPH v5 and v6
  - LAD/FBD v4 and v5
  - SCL v3 and v4
  - STL v4 and v5
- This coexistence is evidence that consumers must preserve and validate the schema version declared by each exported document rather than assuming one global V20 schema generation.

## Boundaries

These observations establish installed file identity and declared static API shape only. They do not prove:

- that the current Windows account belongs to the required Openness group;
- that a connection prompt will be approved;
- that a TIA process or project can currently be attached;
- that a specific project object supports every service;
- that an import, compile, save, or online operation will succeed;
- runtime side effects, performance, exception behavior, or project compatibility.
