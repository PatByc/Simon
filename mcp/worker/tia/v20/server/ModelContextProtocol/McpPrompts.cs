using ModelContextProtocol.Server;
using System.ComponentModel;

namespace TiaMcpServer.ModelContextProtocol
{
    [McpServerPromptType]
    public static class McpPrompts
    {
        #region Basic Connection Templates

        [McpServerPrompt(Name = "Connect"), Description("Connect to TIA Portal")]
        public static string Connect()
        {
            return @"Connect to TIA Portal.

This will establish a connection to either a running TIA Portal instance or start a new one.

Use the Connect tool to initiate the connection.";
        }

        [McpServerPrompt(Name = "OpenProject"), Description("Open a TIA Portal project")]
        public static string OpenProject(string projectPath)
        {
            return $@"Open the TIA Portal project.

Common parameter values:
- projectPath: the full path to the project file (.ap18, .ap19, .ap20, etc.).

Use the OpenProject tool with this parameter:
- projectPath: {projectPath}";
        }

        [McpServerPrompt(Name = "CloseProject"), Description("Close the currently open TIA Portal project")]
        public static string CloseProject()
        {
            return @"Close the currently open TIA Portal project.

This will close the active project and return TIA Portal to the main screen.

Use the CloseProject tool to close the current project.";
        }

        [McpServerPrompt(Name = "Disconnect"), Description("Disconnect from TIA Portal")]
        public static string Disconnect()
        {
            return @"Disconnect from TIA Portal.

Use the Disconnect tool to remove the connection.";
        }

        #endregion

        #region Project Information Templates

        [McpServerPrompt(Name = "GetProjectTree"), Description("Get the project structure/tree on the current TIA Portal project")]
        public static string GetProjectTree()
        {
            return @"Retrieve the complete structure of the current TIA Portal project.

The hierarchical tree will display:
- All devices
- Device items
- Groups
- PLC/HMI software

Use the GetProjectTree tool to display the project organization and locate software paths for other operations.";
        }

        [McpServerPrompt(Name = "GetSoftwareTree"), Description("Get the structure/tree of a specific PLC software showing blocks and types")]
        public static string GetSoftwareTree(string softwarePath)
        {
            return $@"Retrieve the complete structure of PLC software.

The hierarchical tree will display:
- Function (OB, FB, FC) and data (ArrayDB, GlobalDB, InstanceDB) blocks (organized by groups and subgroups)
- User-defined data types (organized by groups and subgroups)
- Hierarchical organization with proper tree formatting

Common parameter values:
- softwarePath: normally something like 'PLC_1' for hardware PLC, 'PC-System_1/Software PLC_1' for PC based PLC

Use the GetSoftwareTree tool with these parameters:
- softwarePath: {softwarePath}";
        }

        #endregion

        #region Export Templates

        [McpServerPrompt(Name = "ExportBlocks"), Description("Export blocks from PLC software")]
        public static string ExportBlocks(string softwarePath, string exportPath, string regexName, bool preservePath)
        {
            return $@"Export blocks from PLC software.

Common parameter values:
- softwarePath: normally something like 'PLC_1' for hardware PLC, 'PC-System_1/Software PLC_1' for PC based PLC
- exportPath: '${{workspacefolder}}/export/Program blocks' is a good default
- regexName: Use empty string """" for all blocks, or patterns like ""FB_.*"" for function blocks
- preservePath: Use false for flat export, true to maintain folder structure

Use the ExportBlocks tool with these parameters:
- softwarePath: {softwarePath}
- exportPath: {exportPath}
- regexName: {regexName}
- preservePath: {preservePath.ToString().ToLower()}";
        }

        [McpServerPrompt(Name = "ExportTypes"), Description("Export types from PLC software")]
        public static string ExportTypes(string softwarePath, string exportPath, string regexName, bool preservePath)
        {
            return $@"Export user-defined types from PLC software.

Common parameter values:
- softwarePath: normally something like 'PLC_1' for hardware PLC, 'PC-System_1/Software PLC_1' for PC based PLC
- exportPath: '${{workspacefolder}}/export/Plc data types' is a good default
- regexName: Use empty string """" for all types, or patterns like ""Typ_.*""
- preservePath: Use false for flat export, true to maintain folder structure

Use the ExportTypes tool with these parameters:
- softwarePath: {softwarePath}
- exportPath: {exportPath}
- regexName: {regexName}
- preservePath: {preservePath.ToString().ToLower()}";
        }

        [McpServerPrompt(Name = "ExportBlocksAsDocuments"), Description("Export blocks as documents (.s7dcl/.s7res format)")]
        public static string ExportBlocksAsDocuments(string softwarePath, string exportPath, string regexName, bool preservePath)
        {
            return $@"Export blocks as SIMATIC SD documents (.s7dcl/.s7res format) from PLC software.
Requires TIA Portal V20 or newer.

Common parameter values:
- softwarePath: normally something like 'PLC_1' for hardware PLC, 'PC-System_1/Software PLC_1' for PC based PLC
- exportPath: '${{workspacefolder}}/export/Plc' is a good default
- regexName: Use empty string """" for all blocks, or patterns like ""FB_.*""
- preservePath: Use false for flat export, true to maintain folder structure

Use the ExportBlocksAsDocuments tool with these parameters:
- softwarePath: {softwarePath}
- exportPath: {exportPath}
- regexName: {regexName}
- preservePath: {preservePath.ToString().ToLower()}";
        }

        #endregion

        #region Convenience Export Templates

        [McpServerPrompt(Name = "ExportAllBlocksFlattened"), Description("Export all blocks from PLC software (flattened)")]
        public static string ExportAllBlocksFlattened(string softwarePath, string exportPath)
        {
            return ExportBlocks(softwarePath, exportPath, "", false);
        }

        [McpServerPrompt(Name = "ExportAllBlocksStructured"), Description("Export all blocks from PLC software (structured)")]
        public static string ExportAllBlocksStructured(string softwarePath, string exportPath)
        {
            return ExportBlocks(softwarePath, exportPath, "", true);
        }

        [McpServerPrompt(Name = "ExportAllTypesFlattened"), Description("Export all types from PLC software (flattened)")]
        public static string ExportAllTypesFlattened(string softwarePath, string exportPath)
        {
            return ExportTypes(softwarePath, exportPath, "", false);
        }

        [McpServerPrompt(Name = "ExportAllTypesStructured"), Description("Export all types from PLC software (structured)")]
        public static string ExportAllTypesStructured(string softwarePath, string exportPath)
        {
            return ExportTypes(softwarePath, exportPath, "", true);
        }

        [McpServerPrompt(Name = "ExportAllBlocksAsDocumentsFlattened"), Description("Export all blocks as documents from PLC software (flattened)")]
        public static string ExportAllBlocksAsDocumentsFlattened(string softwarePath, string exportPath)
        {
            return ExportBlocksAsDocuments(softwarePath, exportPath, "", false);
        }

        [McpServerPrompt(Name = "ExportAllBlocksAsDocumentsStructured"), Description("Export all blocks as documents from PLC software (structured)")]
        public static string ExportAllBlocksAsDocumentsStructured(string softwarePath, string exportPath)
        {
            return ExportBlocksAsDocuments(softwarePath, exportPath, "", true);
        }

        #endregion

        #region External Source Templates

        [McpServerPrompt(Name = "GenerateBlocksFromSource"), Description("Generate PLC blocks from an external source file such as .scl")]
        public static string GenerateBlocksFromSource(string softwarePath, string groupPath, string sourcePath, string externalSourceName, string generateOption, bool deleteExternalSourceAfterGenerate)
        {
            return $@"Generate one or more PLC blocks from a TIA Openness external source file.

Use this for newly written SCL source files such as .scl. Do not use ImportFromDocuments for hand-written SCL; ImportFromDocuments is for TIA-exported SIMATIC SD .s7dcl/.s7res documents.

Common parameter values:
- softwarePath: e.g. 'PLC_1' for hardware PLC
- groupPath: empty for root program blocks, or a user-created block group path
- sourcePath: full path to a .scl external source file
- externalSourceName: optional; normally the file name without extension
- generateOption: 'None' (default) or 'KeepOnError'
- deleteExternalSourceAfterGenerate: true to remove the external source entry after generation

The server normalizes the source file to a UTF-8 BOM temporary copy before passing it to TIA Portal, so source comments are decoded consistently by the TIA external-source parser.

Use the GenerateBlocksFromSource tool with these parameters:
- softwarePath: {softwarePath}
- groupPath: {groupPath}
- sourcePath: {sourcePath}
- externalSourceName: {externalSourceName}
- generateOption: {generateOption}
- deleteExternalSourceAfterGenerate: {deleteExternalSourceAfterGenerate}";
        }

        #endregion

        #region Import From Documents Templates

        [McpServerPrompt(Name = "ImportFromDocuments"), Description("Import a single block from SIMATIC SD documents (.s7dcl/.s7res) (V20+)")]
        public static string ImportFromDocuments(string softwarePath, string groupPath, string importPath, string fileNameWithoutExtension, string importOption)
        {
            return $@"Import a single program block from SIMATIC SD documents into PLC software (requires TIA Portal V20 or newer).

Common parameter values:
- softwarePath: e.g. 'PLC_1' for hardware PLC
- groupPath: optional, e.g. 'Program blocks/FBs'
- importPath: folder containing .s7dcl/.s7res files
- fileNameWithoutExtension: e.g. 'FC_DateTime'
- importOption: 'Override' (default), 'None', 'SkipInactiveCultures', 'ActivateInactiveCultures'

Note: As of 2025-09-02, importing Ladder (LAD) blocks requires the companion .s7res to contain en-US tags for all items; otherwise import may fail.
For newly written SCL source files, use GenerateBlocksFromSource instead.

Use the ImportFromDocuments tool with these parameters:
- softwarePath: {softwarePath}
- groupPath: {groupPath}
- importPath: {importPath}
- fileNameWithoutExtension: {fileNameWithoutExtension}
- importOption: {importOption}";
        }

        [McpServerPrompt(Name = "ImportBlocksFromDocuments"), Description("Import blocks from SIMATIC SD documents (.s7dcl/.s7res) (V20+)")]
        public static string ImportBlocksFromDocuments(string softwarePath, string groupPath, string importPath, string regexName, string importOption)
        {
            return $@"Import multiple program blocks from SIMATIC SD documents into PLC software (requires TIA Portal V20 or newer).

Common parameter values:
- softwarePath: e.g. 'PLC_1' for hardware PLC
- groupPath: optional target group path, empty for root
- importPath: folder containing .s7dcl/.s7res files
- regexName: empty for all, or e.g. 'FB_.*'
- importOption: 'Override' (default), 'None', 'SkipInactiveCultures', 'ActivateInactiveCultures'

Note: As of 2025-09-02, importing Ladder (LAD) blocks requires the companion .s7res to contain en-US tags for all items; otherwise import may fail.
For newly written SCL source files, use GenerateBlocksFromSource instead.

Use the ImportBlocksFromDocuments tool with these parameters:
- softwarePath: {softwarePath}
- groupPath: {groupPath}
- importPath: {importPath}
- regexName: {regexName}
- importOption: {importOption}";
        }

        #endregion
    }
}
