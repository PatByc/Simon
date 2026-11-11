# Simon MCP Tool Mapping

Generated from `src/connectors/tia/v20/tool-map.ts`. Unclassified upstream tools are denied.

| TIA V20 upstream tool | Connector operation | Simon MCP tool | Effect | Exposure | Connection | Project binding | Artifacts | Live status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GetPortalProcesses` | `tia.connection.listProcesses` | `simon_tia_list_processes` | status-read | host-only | no | no | no | implemented |
| `Connect` | `tia.connection.attach` | `simon_tia_connect` | process-control | host-only | no | no | no | implemented |
| `Disconnect` | `tia.connection.disconnect` | `simon_tia_disconnect` | process-control | host-only | yes | no | no | implemented |
| `GetState` | `tia.connection.status` | `simon_tia_get_state` | status-read | model | no | no | no | live-tested |
| `GetProject` | `tia.project.listOpen` | `simon_tia_get_open_projects` | project-read | model | yes | no | no | live-tested |
| `OpenProject` | `tia.project.open` | — | process-control | blocked | yes | no | no | denied by façade |
| `SaveProject` | `tia.project.save` | — | save | blocked | yes | yes | no | denied by façade |
| `SaveAsProject` | `tia.project.saveAs` | — | save | blocked | yes | yes | no | denied by façade |
| `CloseProject` | `tia.project.close` | — | process-control | blocked | yes | yes | no | denied by façade |
| `GetProjectTree` | `tia.project.getTree` | `simon_tia_get_project_tree` | project-read | model | yes | yes | no | live-tested |
| `GetDeviceInfo` | `tia.device.get` | `simon_tia_get_device` | project-read | model | yes | yes | no | live-tested |
| `GetDeviceItemInfo` | `tia.device.getItem` | `simon_tia_get_device_item` | project-read | model | yes | yes | no | live-tested |
| `GetDevices` | `tia.device.list` | `simon_tia_list_devices` | project-read | model | yes | yes | no | live-tested |
| `GetSoftwareInfo` | `tia.software.get` | `simon_tia_get_software` | project-read | model | yes | yes | no | live-tested |
| `CompileSoftware` | `tia.software.compile` | — | compile | blocked | yes | yes | no | denied by façade |
| `GetSoftwareTree` | `tia.software.getTree` | `simon_tia_get_software_tree` | project-read | model | yes | yes | no | live-tested |
| `GetTagTables` | `tia.tagTable.list` | `simon_tia_list_tag_tables` | project-read | model | yes | yes | no | live-tested |
| `GetTags` | `tia.tag.list` | `simon_tia_list_tags` | project-read | model | yes | yes | no | live-tested |
| `GetBlockInfo` | `tia.block.get` | `simon_tia_get_block` | project-read | model | yes | yes | no | live-tested |
| `GetBlocks` | `tia.block.search` | `simon_tia_find_blocks` | project-read | model | yes | yes | no | live-tested |
| `GetBlocksWithHierarchy` | `tia.block.getTree` | `simon_tia_get_block_tree` | project-read | model | yes | yes | no | live-tested |
| `ExportBlock` | `tia.block.export` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `ImportBlock` | `tia.block.import` | — | project-mutation | blocked | yes | yes | no | denied by façade |
| `ExportBlocks` | `tia.block.exportMany` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `AnalyzeDbMembers` | `tia.analysis.dbMembers` | `simon_tia_analyze_db_members` | artifact-producing-read | model | yes | yes | yes | live-tested |
| `AnalyzeParameterDbs` | `tia.analysis.parameterDbs` | `simon_tia_analyze_parameter_dbs` | artifact-producing-read | model | yes | yes | yes | live-tested |
| `FindTagUsages` | `tia.analysis.tagUsages` | `simon_tia_find_tag_usages` | artifact-producing-read | model | yes | yes | yes | live-tested |
| `AnalyzeAnalogInputs` | `tia.analysis.analogInputs` | `simon_tia_analyze_analog_inputs` | artifact-producing-read | model | yes | yes | yes | live-tested |
| `AnalyzeAnalogOutputs` | `tia.analysis.analogOutputs` | `simon_tia_analyze_analog_outputs` | artifact-producing-read | model | yes | yes | yes | live-tested |
| `PreviewAnalogInputPatches` | `tia.preview.analogInputs` | — | preview | blocked | yes | yes | yes | denied by façade |
| `PreviewAnalogOutputPatches` | `tia.preview.analogOutputs` | — | preview | blocked | yes | yes | yes | denied by façade |
| `ApplyAnalogInputPatches` | `tia.mutation.analogInputs` | — | project-mutation | blocked | yes | yes | yes | denied by façade |
| `ApplyAnalogOutputPatches` | `tia.mutation.analogOutputs` | — | project-mutation | blocked | yes | yes | yes | denied by façade |
| `GetTypeInfo` | `tia.type.get` | `simon_tia_get_plc_type` | project-read | model | yes | yes | no | live-tested |
| `GetTypes` | `tia.type.search` | `simon_tia_find_plc_types` | project-read | model | yes | yes | no | live-tested |
| `ExportType` | `tia.type.export` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `ImportType` | `tia.type.import` | — | project-mutation | blocked | yes | yes | no | denied by façade |
| `ExportTypes` | `tia.type.exportMany` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `ExportAsDocuments` | `tia.document.export` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `ExportBlocksAsDocuments` | `tia.document.exportMany` | — | artifact-producing-read | internal | yes | yes | yes | denied by façade |
| `GenerateBlocksFromSource` | `tia.block.generateFromSource` | — | project-mutation | blocked | yes | yes | yes | denied by façade |
| `ImportFromDocuments` | `tia.document.import` | — | project-mutation | blocked | yes | yes | no | denied by façade |
| `ImportBlocksFromDocuments` | `tia.document.importMany` | — | project-mutation | blocked | yes | yes | no | denied by façade |
