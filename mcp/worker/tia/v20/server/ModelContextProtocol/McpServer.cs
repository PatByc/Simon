using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ModelContextProtocol;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Linq;
using TiaMcpServer.Siemens;

namespace TiaMcpServer.ModelContextProtocol
{
    [McpServerToolType]
    public static class McpServer
    {
        private static IServiceProvider? _services;
        private static Portal? _portal;

        public static ILogger? Logger { get; set; }

        public static Portal Portal
        {
            get
            {
                if (_services != null)
                {
                    return _services.GetRequiredService<Portal>();
                }
                else
                {
                    if (_portal == null)
                    {
                        _portal = new Portal();
                    }
                    return _portal;
                }
            }
            set
            {
                _portal = value ?? throw new ArgumentNullException(nameof(value), "Portal cannot be null");
            }
        }

        public static void SetServiceProvider(IServiceProvider services)
        {
            _services = services;
        }

        private static JsonObject Meta(bool success = true)
        {
            return new JsonObject
            {
                ["timestamp"] = DateTime.Now,
                ["success"] = success
            };
        }

        private static List<ResponseIssue> ToResponseIssues(IEnumerable<PortalIssue> issues)
        {
            return issues.Select(DtoMapper.ToIssue).ToList();
        }

        private static JsonObject AnalysisMeta<T>(ProjectAnalysisResult<T> result, int issueCount)
        {
            return new JsonObject
            {
                ["timestamp"] = DateTime.Now,
                ["success"] = true,
                ["partial"] = issueCount > 0,
                ["snapshotReused"] = result.SnapshotReused,
                ["snapshotAgeMilliseconds"] = result.SnapshotAgeMilliseconds,
                ["issueCount"] = issueCount
            };
        }

        #region portal

        [McpServerTool(Name = "GetPortalProcesses"), Description("List attachable TIA Portal processes without attaching")]
        public static ResponsePortalProcesses GetPortalProcesses()
        {
            var processes = TiaPortal.GetProcesses()
                .Select(process =>
                {
                    var hasProject = false;
                    try { hasProject = process.ProjectPath != null; } catch { }
                    return new ResponsePortalProcessInfo
                    {
                        Id = process.Id,
                        HasProject = hasProject,
                        AcquisitionTime = process.AcquisitionTime
                    };
                })
                .ToList();

            return new ResponsePortalProcesses
            {
                Message = "Attachable TIA Portal processes retrieved",
                Processes = processes,
                Meta = Meta()
            };
        }

        [McpServerTool(Name = "Connect"), Description("Connect to TIA-Portal")]
        public static ResponseConnect Connect(
            [Description("processId: optional trusted host-selected TIA Portal process ID; 0 uses automatic selection")] int processId = 0)
        {
            Logger?.LogInformation("Connecting to TIA Portal...");

            try
            {
                if (Portal.ConnectPortal(processId > 0 ? processId : (int?)null))
                {
                    return new ResponseConnect
                    {
                        Message = "Connected to TIA-Portal",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException(
                        Portal.LastConnectionError ?? "Failed to connect to TIA-Portal",
                        McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error connecting to TIA-Portal: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "Disconnect"), Description("Disconnect from TIA-Portal")]
        public static ResponseDisconnect Disconnect()
        {
            try
            {
                if (Portal.DisconnectPortal())
                {
                    return new ResponseDisconnect
                    {
                        Message = "Disconnected from TIA-Portal",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException("Failed disconnecting from TIA-Portal", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error disconnecting from TIA-Portal: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region state

        [McpServerTool(Name = "GetState"), Description("Get the state of the TIA-Portal MCP server")]
        public static ResponseState GetState()
        {
            try
            {
                var state = Portal.GetState();

                if (state != null)
                {
                    return new ResponseState
                    {
                        Message = "TIA-Portal MCP server state retrieved",
                        IsConnected = state.IsConnected,
                        Project = state.Project,
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException("Failed to retrieve TIA-Portal MCP server state", McpErrorCode.InternalError);
                }
                

            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving TIA-Portal MCP server state: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region project

        [McpServerTool(Name = "GetProject"), Description("Get open local projects")]
        public static ResponseGetProjects GetProjects()
        {
            try
            {
                var list = Portal.GetProjects();

                var responseList = new List<ResponseProjectInfo>();
                foreach (var project in list)
                {
                    if (project != null)
                    {
                        responseList.Add(DtoMapper.ToProjectInfo(project));
                    }
                }

                return new ResponseGetProjects
                {
                    Message = "Open projects retrieved",
                    Items = responseList,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = true
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving open projects: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "OpenProject"), Description("Open a TIA-Portal local project")]
        public static ResponseOpenProject OpenProject(
            [Description("path: defines the path to the project")] string path)
        {
            try
            {
                // get project extension
                string extension = Path.GetExtension(path).ToLowerInvariant();

                if (!Regex.IsMatch(extension, @"^\.ap\d+$"))
                {
                    throw new McpException("Invalid project file extension. Use .apXX for projects, where XX=18,19,20,....", McpErrorCode.InvalidParams);
                }

                bool success = Portal.OpenProject(path);

                if (success)
                {
                    return new ResponseOpenProject
                    {
                        Message = $"Project '{path}' opened",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed to open project '{path}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error opening project '{path}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "SaveProject"), Description("Save the current TIA-Portal local project")]
        public static ResponseSaveProject SaveProject()
        {
            try
            {
                if (Portal.SaveProject())
                {
                    return new ResponseSaveProject
                    {
                        Message = "Local project saved",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException("Failed to save project", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error saving local project: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "SaveAsProject"), Description("Save current TIA-Portal project with a new name")]
        public static ResponseSaveAsProject SaveAsProject(
            [Description("newProjectPath: defines the new path where to save the project")] string newProjectPath)
        {
            try
            {
                if (Portal.SaveAsProject(newProjectPath))
                {
                    return new ResponseSaveAsProject
                    {
                        Message = $"Local project saved as '{newProjectPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed saving local project as '{newProjectPath}'", McpErrorCode.InternalError);
                }

            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error saving local project as '{newProjectPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "CloseProject"), Description("Close the current TIA-Portal project")]
        public static ResponseCloseProject CloseProject()
        {
            try
            {
                bool success = Portal.CloseProject();
                if (success)
                {
                    return new ResponseCloseProject
                    {
                        Message = "Local project closed",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException("Failed closing project", McpErrorCode.InternalError);
                }

            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error closing local project: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region devices

        [McpServerTool(Name = "GetProjectTree"), Description("Get project structure as a tree view on current local project")]
        public static ResponseProjectTree GetProjectTree()
        {
            try
            {
                var tree = Portal.GetProjectTree();

                if (!string.IsNullOrEmpty(tree))
                {
                    return new ResponseProjectTree
                    {
                        Message = "Project tree retrieved",
                        Tree = "```\n" + tree + "\n```",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException("Failed retrieving project tree", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving project tree: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetDeviceInfo"), Description("Get info from a device from the current project")]
        public static ResponseDeviceInfo GetDeviceInfo(
            [Description("devicePath: defines the path in the project structure to the device")] string devicePath)
        {
            try
            {
                var device = Portal.GetDevice(devicePath);

                if (device != null)
                {
                    var response = DtoMapper.ToDeviceInfo(device, devicePath);
                    response.Message = $"Device info retrieved from '{devicePath}'";
                    response.Meta = Meta();
                    return response;
                }
                else
                {
                    throw new McpException($"Device not found at '{devicePath}'", McpErrorCode.InvalidParams);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving device info from '{devicePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetDeviceItemInfo"), Description("Get info from a device item from the current project")]
        public static ResponseDeviceItemInfo GetDeviceItemInfo(
            [Description("deviceItemPath: defines the path in the project structure to the device item")] string deviceItemPath)
        {
            try
            {
                var deviceItem = Portal.GetDeviceItem(deviceItemPath);

                if (deviceItem != null)
                {
                    var response = DtoMapper.ToDeviceItemInfo(deviceItem, deviceItemPath);
                    response.Message = $"Device item info retrieved from '{deviceItemPath}'";
                    response.Meta = Meta();
                    return response;
                }
                else
                {
                    throw new McpException($"Device item not found at '{deviceItemPath}'", McpErrorCode.InvalidParams);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving device item info from '{deviceItemPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetDevices"), Description("Get a list of all devices in the project")]
        public static ResponseDevices GetDevices()
        {
            try
            {
                var list = Portal.GetDevices();
                var responseList = new List<ResponseDeviceInfo>();

                if (list != null)
                {
                    foreach (var device in list)
                    {
                        if (device != null)
                        {
                            responseList.Add(DtoMapper.ToDeviceInfo(device));
                        }
                    }

                    return new ResponseDevices
                    {
                        Message = "Devices retrieved",
                        Items = responseList,
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed retrieving devices", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving devices: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region plc software

        [McpServerTool(Name = "GetSoftwareInfo"), Description("Get plc software info")]
        public static ResponseSoftwareInfo GetSoftwareInfo(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath)
        {
            try
            {
                var software = Portal.GetPlcSoftware(softwarePath);
                if (software != null)
                {
                    var response = DtoMapper.ToSoftwareInfo(software, softwarePath);
                    response.Message = $"Software info retrieved from '{softwarePath}'";
                    response.Meta = Meta();
                    return response;
                }
                else
                {
                    throw new McpException($"Software not found at '{softwarePath}'", McpErrorCode.InvalidParams);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving software info from '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "CompileSoftware"), Description("Compile the plc software")]
        public static ResponseCompileSoftware CompileSoftware(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("password: the password to access adminsitration, default: no password")] string password = "")
        {
            try
            {
                var result = Portal.CompileSoftware(softwarePath, password);
                if (result != null && !result.State.ToString().Equals("Error"))
                {
                    return new ResponseCompileSoftware
                    {
                        Message = $"Software '{softwarePath}' compiled with {result}",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed compiling software '{softwarePath}': {result}", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error compiling software '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetSoftwareTree"), Description("Get the structure/tree of a given PLC software showing blocks, types, and external sources")]
        public static ResponseSoftwareTree GetSoftwareTree(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath)
        {
            try
            {
                var tree = Portal.GetSoftwareTree(softwarePath);

                if (!string.IsNullOrEmpty(tree))
                {
                    return new ResponseSoftwareTree
                    {
                        Message = $"Software tree retrieved from '{softwarePath}'",
                        Tree = "```\n" + tree + "\n```",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed retrieving software tree from '{softwarePath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving software tree from '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region blocks

        [McpServerTool(Name = "GetBlockInfo"), Description("Get a block info, which is located in the plc software")]
        public static ResponseBlockInfo GetBlockInfo(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("blockPath: defines the path in the project structure to the block")] string blockPath)
        {
            try
            {
                var block = Portal.GetBlock(softwarePath, blockPath);
                if (block != null)
                {
                    var response = DtoMapper.ToBlockInfo(block, Portal.GetBlockPath);
                    response.Message = $"Block info retrieved from '{blockPath}' in '{softwarePath}'";
                    response.Meta = Meta();
                    return response;
                }
                else
                {
                    throw new McpException($"Block not found at '{blockPath}' in '{softwarePath}'", McpErrorCode.InvalidParams);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving block info from '{blockPath}' in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetBlocks"), Description("Get a list of blocks, which are located in plc software")]
        public static ResponseBlocks GetBlocks(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("regexName: defines the name or regular expression to find the block. Use empty string (default) to find all")] string regexName = "")
        {
            try
            {
                var list = Portal.GetBlocks(softwarePath, regexName);

                var responseList = new List<ResponseBlockInfo>();
                foreach (var block in list)
                {
                    if (block != null)
                    {
                        responseList.Add(DtoMapper.ToBlockInfo(block, Portal.GetBlockPath));
                    }
                }

                if (list != null)
                {
                    return new ResponseBlocks
                    {
                        Message = $"Blocks with regex '{regexName}' retrieved from '{softwarePath}'",
                        Items = responseList,
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed retrieving blocks with regex '{regexName}' in '{softwarePath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving blocks with regex '{regexName}' in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetBlocksWithHierarchy"), Description("Get a list of all blocks with their group hierarchy from the plc software.")]
        public static ResponseBlocksWithHierarchy GetBlocksWithHierarchy(
        [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath)
        {
            try
            {
                var rootGroup = Portal.GetBlockRootGroup(softwarePath);
                if (rootGroup != null)
                {
                    var hierarchy = Helper.BuildBlockHierarchy(rootGroup);
                    return new ResponseBlocksWithHierarchy
                    {
                        Message = $"Block hierarchy retrieved from '{softwarePath}'",
                        Root = hierarchy,
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    // Specific failure: root group could not be resolved
                    throw new McpException($"Block root group not found for '{softwarePath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                // Generic unexpected failure wrapper
                throw new McpException($"Unexpected error retrieving block hierarchy for '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }



        [McpServerTool(Name = "ExportBlock"), Description("Export a block from plc software to file")]
        public static ResponseExportBlock ExportBlock(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("blockPath: full path to the block in the project structure, e.g. 'Group/Subgroup/Name' (single names are ambiguous)")] string blockPath,
            [Description("exportPath: defines the path where to export the block")] string exportPath,
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            try
            {
                var block = Portal.ExportBlock(softwarePath, blockPath, exportPath, preservePath);
                if (block != null)
                {
                    return new ResponseExportBlock
                    {
                        Message = $"Block exported from '{blockPath}' to '{exportPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                // Should not be reachable because Portal.ExportBlock throws on failure
                throw new McpException($"Failed exporting block from '{blockPath}' to '{exportPath}'", McpErrorCode.InternalError);
            }
            catch (TiaMcpServer.Siemens.PortalException pex)
            {
                // Map known portal errors to sharper MCP errors and messages.
                switch (pex.Code)
                {
                    case TiaMcpServer.Siemens.PortalErrorCode.NotFound:
                        {
                            var suggestionNote = string.Empty;
                            // If the path has no '/', it may be incomplete; build suggestions using Portal's regex search and path resolver
                            if (!string.IsNullOrEmpty(blockPath) && !blockPath.Contains('/'))
                            {
                                try
                                {
                                    var escaped = Regex.Escape(blockPath);
                                    var blocks = Portal.GetBlocks(softwarePath, $"^{escaped}$");
                                    if (blocks == null || blocks.Count == 0)
                                    {
                                        blocks = Portal.GetBlocks(softwarePath, escaped);
                                    }

                                    var candidates = blocks
                                        .Take(10)
                                        .Select(b => Portal.GetBlockPath(b))
                                        .Where(p => !string.IsNullOrWhiteSpace(p))
                                        .Distinct(StringComparer.OrdinalIgnoreCase)
                                        .ToList();

                                    if (candidates.Count > 0)
                                    {
                                        suggestionNote = $" Did you mean: {string.Join(", ", candidates)}?";
                                    }
                                }
                                catch
                                {
                                    // Best-effort suggestions only
                                }
                            }

                            var msg = $"Block not found.{suggestionNote}".Trim();
                            throw new McpException(msg, McpErrorCode.InvalidParams);
                        }

                    case TiaMcpServer.Siemens.PortalErrorCode.ExportFailed:
                        {
                            // Relay underlying portal error with concise reason; log full details
                            var reason = pex.InnerException?.Message?.Trim();
                            var msg = "Failed to export block.";
                            if (!string.IsNullOrEmpty(reason)) msg += $" Reason: {reason}";

                            Logger?.LogError(pex, "MCP ExportBlock failed for {SoftwarePath} {BlockPath} -> {ExportPath}",
                                pex.Data?["softwarePath"], pex.Data?["blockPath"], pex.Data?["exportPath"]);

                            throw new McpException(msg, McpErrorCode.InternalError);
                        }

                    case TiaMcpServer.Siemens.PortalErrorCode.InvalidParams:
                    case TiaMcpServer.Siemens.PortalErrorCode.InvalidState:
                        {
                            throw new McpException(pex.Message, McpErrorCode.InvalidParams);
                        }
                }

                // Fallback
                throw new McpException(pex.Message, McpErrorCode.InternalError);
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error exporting block from '{blockPath}' to '{exportPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        private static string BuildBlockPathSuggestion(string softwarePath, string blockPath)
        {
            if (string.IsNullOrEmpty(blockPath) || blockPath.Contains('/')) return string.Empty;
            try
            {
                var escaped = Regex.Escape(blockPath);
                var blocks = Portal.GetBlocks(softwarePath, $"^{escaped}$");
                if (blocks == null || blocks.Count == 0)
                {
                    blocks = Portal.GetBlocks(softwarePath, escaped);
                }

                var candidates = blocks
                    .Take(10)
                    .Select(b =>
                    {
                        var name = b.Name;
                        var parts = new List<string> { name };
                        var parent = b.Parent;
                        while (parent != null)
                        {
                            if (parent is PlcBlockSystemGroup) break;
                            if (parent is PlcBlockGroup grp)
                            {
                                parts.Insert(0, grp.Name);
                                parent = grp.Parent;
                            }
                            else break;
                        }
                        if (parts.Count > 1) parts.RemoveAt(0);
                        return string.Join("/", parts);
                    })
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return candidates.Count > 0 ? $" Did you mean: {string.Join(", ", candidates)}?" : string.Empty;
            }
            catch
            {
                return string.Empty; // best effort only
            }
        }
        [McpServerTool(Name = "ImportBlock"), Description("Import a block file to plc software")]
        public static ResponseImportBlock ImportBlock(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("groupPath: defines the path in the project structure to the group, where to import the block")] string groupPath,
            [Description("importPath: defines the path of the xml file from where to import the block")] string importPath)
        {
            try
            {
                if (Portal.ImportBlock(softwarePath, groupPath, importPath))
                {
                    return new ResponseImportBlock
                    {
                        Message = $"Block imported from '{importPath}' to '{groupPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed importing block from '{importPath}' to '{groupPath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error importing block from '{importPath}' to '{groupPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ExportBlocks"), Description("Export all blocks from the plc software to path")]
        public static async Task<ResponseExportBlocks> ExportBlocks(
            IMcpServer server,
            RequestContext<CallToolRequestParams> context,
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("exportPath: defines the path where to export the blocks")] string exportPath,
            [Description("regexName: defines the name or regular expression to find the block. Use empty string (default) to find all")] string regexName = "",
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            var startTime = DateTime.Now;
            var progressToken = context.Params?.ProgressToken;
            
            try
            {
                Logger?.LogInformation($"Starting export of blocks from '{softwarePath}' to '{exportPath}'");

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = 0,
                        Total = 0,
                        Message = "Starting block export...",
                        progressToken
                    });
                }

                var batchResult = await Task.Run(() => Portal.ExportBlocksDetailed(softwarePath, exportPath, regexName, preservePath));
                var totalBlocks = batchResult.Total;

                if (totalBlocks == 0)
                {
                    if (progressToken != null)
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = "No blocks found to export",
                            progressToken
                        });
                    }
                    
                    return new ResponseExportBlocks
                    {
                        Message = $"No blocks found with regex '{regexName}' in '{softwarePath}'",
                        Items = new List<ResponseBlockInfo>(),
                        Inconsistent = new List<ResponseBlockInfo>(),
                        Issues = ToResponseIssues(batchResult.Issues),
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true,
                            ["totalBlocks"] = 0,
                            ["exportedBlocks"] = 0,
                            ["issueCount"] = batchResult.Issues.Count,
                            ["duration"] = (DateTime.Now - startTime).TotalSeconds
                        }
                    };
                }

                var exportedCount = batchResult.Items.Count;
                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalBlocks,
                        Message = $"Exported {exportedCount} of {totalBlocks} blocks",
                        progressToken
                    });
                }

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalBlocks,
                        Message = $"Export completed: {exportedCount} blocks exported, {batchResult.Issues.Count} issues",
                        progressToken
                    });
                }

                var responseList = batchResult.Items
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var inconsistentInfos = batchResult.Inconsistent
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var issues = ToResponseIssues(batchResult.Issues);
                var duration = (DateTime.Now - startTime).TotalSeconds;

                Logger?.LogInformation($"Export completed: {exportedCount} blocks exported in {duration:F2} seconds with {issues.Count} issues");

                return new ResponseExportBlocks
                {
                    Message = $"Export completed: {exportedCount} of {totalBlocks} blocks with regex '{regexName}' exported from '{softwarePath}' to '{exportPath}'",
                    Items = responseList,
                    Inconsistent = inconsistentInfos,
                    Issues = issues,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = true,
                        ["partial"] = issues.Count > 0,
                        ["totalBlocks"] = totalBlocks,
                        ["exportedBlocks"] = exportedCount,
                        ["inconsistentBlocks"] = inconsistentInfos.Count,
                        ["issueCount"] = issues.Count,
                        ["duration"] = duration
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                // Send error progress notification if we have a progress token
                if (progressToken != null)
                {
                    try
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = $"Export failed: {ex.Message}",
                            Error = true,
                            progressToken
                        });
                    }
                    catch
                    {
                        // Ignore notification errors during error handling
                    }
                }
                
                Logger?.LogError(ex, $"Failed exporting blocks with '{regexName}' from '{softwarePath}' to {exportPath}");
                throw new McpException($"Unexpected error exporting blocks with '{regexName}' from '{softwarePath}' to {exportPath}: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region project analysis

        [McpServerTool(Name = "AnalyzeDbMembers"), Description("Export PLC blocks to XML and return complete DB member definitions")]
        public static ResponseDbMembers AnalyzeDbMembers(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("dbNameRegex: optional DB name regex filter; empty returns every DB")] string dbNameRegex = "",
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.AnalyzeDbMembers(softwarePath, dbNameRegex, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var memberCount = result.Items.Sum(item => item.MemberCount);
                var meta = AnalysisMeta(result, issues.Count);
                meta["dbCount"] = result.Items.Count;
                meta["memberCount"] = memberCount;

                return new ResponseDbMembers
                {
                    Message = $"DB analysis completed: {result.Items.Count} DBs, {memberCount} members",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error analyzing DB members in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "AnalyzeParameterDbs"), Description("Export PLC blocks to XML and return parameter DB members with their exact tag usages")]
        public static ResponseParameterDbs AnalyzeParameterDbs(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("dbNameRegex: DB name regex filter; default targets SET, PIDParameters, and SettingsAndFaults")] string dbNameRegex = "",
            [Description("memberNameRegex: optional member name regex filter, for example ROOM7|XZ_|GAIN")] string memberNameRegex = "",
            [Description("maxMembers: maximum indexed member rows to return; 0 means unlimited")] int maxMembers = 500,
            [Description("maxUsagesPerMember: maximum usage rows embedded for each member")] int maxUsagesPerMember = 5,
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.AnalyzeParameterDbs(softwarePath, dbNameRegex, memberNameRegex, maxMembers, maxUsagesPerMember, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var memberCount = result.Items.Sum(item => item.Members.Count);
                var usedMemberCount = result.Items.Sum(item => item.UsedMemberCount);
                var meta = AnalysisMeta(result, issues.Count);
                meta["dbCount"] = result.Items.Count;
                meta["indexedMemberCount"] = memberCount;
                meta["usedMemberCount"] = usedMemberCount;

                return new ResponseParameterDbs
                {
                    Message = $"Parameter DB analysis completed: {result.Items.Count} DBs, {memberCount} indexed members, {usedMemberCount} members with usages",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error analyzing parameter DBs in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "FindTagUsages"), Description("Export PLC blocks to XML and find tag usages across networks")]
        public static ResponseTagUsages FindTagUsages(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("tagPattern: regex matched against symbols such as SET.XZ_ROOM1_T or AnalogInput.T_ROOM1")] string tagPattern,
            [Description("maxResults: maximum usage rows to return; 0 means unlimited")] int maxResults = 500,
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.FindTagUsages(softwarePath, tagPattern, maxResults, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var meta = AnalysisMeta(result, issues.Count);
                meta["usageCount"] = result.Items.Count;

                return new ResponseTagUsages
                {
                    Message = $"Tag usage search completed: {result.Items.Count} usages matched '{tagPattern}'",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error finding tag usages in '{softwarePath}' with pattern '{tagPattern}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "AnalyzeAnalogInputs"), Description("Export analog input blocks to XML and return Convert_IW channel wiring")]
        public static ResponseAnalogChannels AnalyzeAnalogInputs(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("blockNameRegex: optional block name regex; default targets AnalogInput and AirDataAcquisition")] string blockNameRegex = "",
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.AnalyzeAnalogInputs(softwarePath, blockNameRegex, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var meta = AnalysisMeta(result, issues.Count);
                meta["channelCount"] = result.Items.Count;

                return new ResponseAnalogChannels
                {
                    Message = $"Analog input analysis completed: {result.Items.Count} Convert_IW channels",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error analyzing analog inputs in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "AnalyzeAnalogOutputs"), Description("Export analog output blocks to XML and return Convert_QW channel wiring")]
        public static ResponseAnalogChannels AnalyzeAnalogOutputs(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("blockNameRegex: optional block name regex; default targets AnalogOutput")] string blockNameRegex = "",
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.AnalyzeAnalogOutputs(softwarePath, blockNameRegex, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var meta = AnalysisMeta(result, issues.Count);
                meta["channelCount"] = result.Items.Count;

                return new ResponseAnalogChannels
                {
                    Message = $"Analog output analysis completed: {result.Items.Count} Convert_QW channels",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error analyzing analog outputs in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "PreviewAnalogInputPatches"), Description("Dry-run analog input channel changes against exported Convert_IW XML; no project data is modified")]
        public static ResponseAnalogPatchPreview PreviewAnalogInputPatches(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("changesJson: JSON array with selectors block/networkTitle/rawInput/engineeringOutput and new rawHigh/rawLow/engineeringHigh/engineeringLow/correction values")] string changesJson,
            [Description("blockNameRegex: optional block name regex; default targets AnalogInput and AirDataAcquisition")] string blockNameRegex = "",
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.PreviewAnalogInputPatches(softwarePath, changesJson, blockNameRegex, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var meta = AnalysisMeta(result, issues.Count);
                meta["previewCount"] = result.Items.Count;
                meta["readyCount"] = result.Items.Count(item => item.Status == "Ready");
                meta["modified"] = false;

                return new ResponseAnalogPatchPreview
                {
                    Message = $"Analog input patch preview completed: {result.Items.Count} requested changes checked",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error previewing analog input patches in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "PreviewAnalogOutputPatches"), Description("Dry-run analog output channel changes against exported Convert_QW XML; no project data is modified")]
        public static ResponseAnalogPatchPreview PreviewAnalogOutputPatches(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("changesJson: JSON array with selectors block/networkTitle/engineeringInput/rawOutput and new rawHigh/rawLow/engineeringHigh/engineeringLow values")] string changesJson,
            [Description("blockNameRegex: optional block name regex; default targets AnalogOutput")] string blockNameRegex = "",
            [Description("snapshotRoot: optional root directory for the timestamped XML snapshot")] string snapshotRoot = "",
            [Description("forceRefresh: bypass the 30-second session snapshot cache and export fresh XML")] bool forceRefresh = false)
        {
            try
            {
                var result = Portal.PreviewAnalogOutputPatches(softwarePath, changesJson, blockNameRegex, snapshotRoot, forceRefresh);
                var issues = ToResponseIssues(result.Issues);
                var meta = AnalysisMeta(result, issues.Count);
                meta["previewCount"] = result.Items.Count;
                meta["readyCount"] = result.Items.Count(item => item.Status == "Ready");
                meta["modified"] = false;

                return new ResponseAnalogPatchPreview
                {
                    Message = $"Analog output patch preview completed: {result.Items.Count} requested changes checked",
                    SnapshotPath = result.SnapshotPath,
                    ExportedBlockCount = result.ExportedBlockCount,
                    SnapshotReused = result.SnapshotReused,
                    SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                    Items = result.Items,
                    Issues = issues,
                    Meta = meta
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error previewing analog output patches in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ApplyAnalogInputPatches"), Description("Apply Convert_IW channel patches through the Openness XML import/compile/save flow; apply must be true to modify TIA")]
        public static ResponseAnalogPatchApply ApplyAnalogInputPatches(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("changesJson: JSON array with selectors block/networkTitle/rawInput/engineeringOutput and new rawHigh/rawLow/engineeringHigh/engineeringLow/correction values")] string changesJson,
            [Description("apply: must be true to import patched XML into TIA; false returns dry-run preview only")] bool apply = false,
            [Description("compileAfterImport: compile PLC software after patched XML import")] bool compileAfterImport = true,
            [Description("saveProject: save the TIA project after successful import/compile; keep false for dry field checks")] bool saveProject = false,
            [Description("rollbackOnFailure: import backup XML if import or compile fails")] bool rollbackOnFailure = true,
            [Description("rollbackAfterCompile: test the write path, then import backup XML and compile again")] bool rollbackAfterCompile = false,
            [Description("blockNameRegex: optional block name regex; default targets AnalogInput and AirDataAcquisition")] string blockNameRegex = "",
            [Description("groupPath: target PLC block group for ImportBlock; empty means root program blocks")] string groupPath = "",
            [Description("snapshotRoot: optional root directory for timestamped backup and patched XML snapshots")] string snapshotRoot = "")
        {
            try
            {
                var result = Portal.ApplyAnalogInputPatches(softwarePath, changesJson, blockNameRegex, groupPath, snapshotRoot, apply, compileAfterImport, saveProject, rollbackOnFailure, rollbackAfterCompile);
                return ToAnalogPatchApplyResponse(result, "Analog input patch transaction completed");
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error applying analog input patches in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ApplyAnalogOutputPatches"), Description("Apply Convert_QW channel patches through the Openness XML import/compile/save flow; apply must be true to modify TIA")]
        public static ResponseAnalogPatchApply ApplyAnalogOutputPatches(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("changesJson: JSON array with selectors block/networkTitle/engineeringInput/rawOutput and new rawHigh/rawLow/engineeringHigh/engineeringLow values")] string changesJson,
            [Description("apply: must be true to import patched XML into TIA; false returns dry-run preview only")] bool apply = false,
            [Description("compileAfterImport: compile PLC software after patched XML import")] bool compileAfterImport = true,
            [Description("saveProject: save the TIA project after successful import/compile; keep false for dry field checks")] bool saveProject = false,
            [Description("rollbackOnFailure: import backup XML if import or compile fails")] bool rollbackOnFailure = true,
            [Description("rollbackAfterCompile: test the write path, then import backup XML and compile again")] bool rollbackAfterCompile = false,
            [Description("blockNameRegex: optional block name regex; default targets AnalogOutput")] string blockNameRegex = "",
            [Description("groupPath: target PLC block group for ImportBlock; empty means root program blocks")] string groupPath = "",
            [Description("snapshotRoot: optional root directory for timestamped backup and patched XML snapshots")] string snapshotRoot = "")
        {
            try
            {
                var result = Portal.ApplyAnalogOutputPatches(softwarePath, changesJson, blockNameRegex, groupPath, snapshotRoot, apply, compileAfterImport, saveProject, rollbackOnFailure, rollbackAfterCompile);
                return ToAnalogPatchApplyResponse(result, "Analog output patch transaction completed");
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error applying analog output patches in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        private static ResponseAnalogPatchApply ToAnalogPatchApplyResponse(AnalogPatchTransactionResult result, string message)
        {
            var issues = ToResponseIssues(result.Issues);
            return new ResponseAnalogPatchApply
            {
                Message = $"{message}: {result.Items.Count} requested changes, {result.PatchedFiles.Count} patched files, {issues.Count} issues",
                SnapshotPath = result.SnapshotPath,
                PatchedPath = result.PatchedPath,
                ExportedBlockCount = result.ExportedBlockCount,
                SnapshotReused = result.SnapshotReused,
                SnapshotAgeMilliseconds = result.SnapshotAgeMilliseconds,
                ApplyRequested = result.ApplyRequested,
                Applied = result.Applied,
                Compiled = result.Compiled,
                Saved = result.Saved,
                RolledBack = result.RolledBack,
                CompileState = result.CompileState,
                RollbackCompileState = result.RollbackCompileState,
                ImportedFiles = result.ImportedFiles,
                PatchedFiles = result.PatchedFiles,
                Items = result.Items,
                Issues = issues,
                Meta = new JsonObject
                {
                    ["timestamp"] = DateTime.Now,
                    ["success"] = issues.Count == 0,
                    ["partial"] = issues.Count > 0,
                    ["applyRequested"] = result.ApplyRequested,
                    ["snapshotReused"] = result.SnapshotReused,
                    ["snapshotAgeMilliseconds"] = result.SnapshotAgeMilliseconds,
                    ["applied"] = result.Applied,
                    ["compiled"] = result.Compiled,
                    ["saved"] = result.Saved,
                    ["rolledBack"] = result.RolledBack,
                    ["previewCount"] = result.Items.Count,
                    ["readyCount"] = result.Items.Count(item => item.Status == "Ready"),
                    ["patchedFileCount"] = result.PatchedFiles.Count,
                    ["importedFileCount"] = result.ImportedFiles.Count,
                    ["issueCount"] = issues.Count
                }
            };
        }

        #endregion

        #region types

        [McpServerTool(Name = "GetTypeInfo"), Description("Get a type info from the plc software")]
        public static ResponseTypeInfo GetTypeInfo(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("typePath: defines the path in the project structure to the type")] string typePath)
        {
            try
            {
                var type = Portal.GetType(softwarePath, typePath);
                if (type != null)
                {
                    var response = DtoMapper.ToTypeInfo(type, Portal.GetTypePath);
                    response.Message = $"Type info retrieved from '{typePath}' in '{softwarePath}'";
                    response.Meta = Meta();
                    return response;
                }
                else
                {
                    throw new McpException($"Type not found at '{typePath}' in '{softwarePath}'", McpErrorCode.InvalidParams);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving type info from '{typePath}' in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GetTypes"), Description("Get a list of types from the plc software")]
        public static ResponseTypes GetTypes(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("regexName: defines the name or regular expression to find the block. Use empty string (default) to find all")] string regexName = "")
        {
            try
            {
                var list = Portal.GetTypes(softwarePath, regexName);

                var responseList = new List<ResponseTypeInfo>();
                foreach (var type in list)
                {
                    if (type != null)
                    {
                        responseList.Add(DtoMapper.ToTypeInfo(type, Portal.GetTypePath));
                    }
                }

                if (list != null)
                {
                    return new ResponseTypes
                    {
                        Message = $"Types with regex '{regexName}' retrieved from '{softwarePath}'",
                        Items = responseList,
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed retrieving user defined types with regex '{regexName}' in '{softwarePath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error retrieving user defined types with regex '{regexName}' in '{softwarePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ExportType"), Description("Export a type from the plc software")]
        public static ResponseExportType ExportType(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("exportPath: defines the path where export the type")] string exportPath,
            [Description("typePath: defines the path in the project structure to the type")] string typePath,
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            try
            {
                var type = Portal.ExportType(softwarePath, typePath, exportPath, preservePath);
                if (type != null)
                {
                    return new ResponseExportType
                    {
                        Message = $"Type exported from '{typePath}' to '{exportPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed exporting type from '{typePath}' to '{exportPath}'", McpErrorCode.InternalError);
                }
            }
            catch (TiaMcpServer.Siemens.PortalException pex)
            {
                switch (pex.Code)
                {
                    case TiaMcpServer.Siemens.PortalErrorCode.NotFound:
                        throw new McpException("Type not found.", McpErrorCode.InvalidParams);
                    case TiaMcpServer.Siemens.PortalErrorCode.InvalidState:
                    case TiaMcpServer.Siemens.PortalErrorCode.InvalidParams:
                        throw new McpException(pex.Message, McpErrorCode.InvalidParams);
                    case TiaMcpServer.Siemens.PortalErrorCode.ExportFailed:
                        {
                            var reason = pex.InnerException?.Message?.Trim();
                            var msg = "Failed to export type.";
                            if (!string.IsNullOrEmpty(reason)) msg += $" Reason: {reason}";
                            Logger?.LogError(pex, "MCP ExportType failed for {SoftwarePath} {TypePath} -> {ExportPath}",
                                pex.Data?["softwarePath"], pex.Data?["typePath"], pex.Data?["exportPath"]);
                            throw new McpException(msg, McpErrorCode.InternalError);
                        }
                }
                throw new McpException(pex.Message, McpErrorCode.InternalError);
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error exporting type from '{typePath}' to '{exportPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ImportType"), Description("Import a type from file into the plc software")]
        public static ResponseImportType ImportType(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("groupPath: defines the path in the project structure to the group, where to import the type")] string groupPath,
            [Description("importPath: defines the path of the xml file from where to import the type")] string importPath)
        {
            try
            {
                if (Portal.ImportType(softwarePath, groupPath, importPath))
                {
                    return new ResponseImportType
                    {
                        Message = $"Type imported from '{importPath}' to '{groupPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed importing type from '{importPath}' to '{groupPath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error importing type from '{importPath}' to '{groupPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ExportTypes"), Description("Export types from the plc software to path")]
        public static async Task<ResponseExportTypes> ExportTypes(
            IMcpServer server,
            RequestContext<CallToolRequestParams> context,
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("exportPath: defines the path where to export the types")] string exportPath,
            [Description("regexName: defines the name or regular expression to find the block. Use empty string (default) to find all")] string regexName = "",
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            var startTime = DateTime.Now;
            var progressToken = context.Params?.ProgressToken;
            
            try
            {
                Logger?.LogInformation($"Starting export of types from '{softwarePath}' to '{exportPath}'");

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = 0,
                        Total = 0,
                        Message = "Starting PLC data type export...",
                        progressToken
                    });
                }

                var batchResult = await Task.Run(() => Portal.ExportTypesDetailed(softwarePath, exportPath, regexName, preservePath));
                var totalTypes = batchResult.Total;

                if (totalTypes == 0)
                {
                    if (progressToken != null)
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = "No types found to export",
                            progressToken
                        });
                    }
                    
                    return new ResponseExportTypes
                    {
                        Message = $"No types found with regex '{regexName}' in '{softwarePath}'",
                        Items = new List<ResponseTypeInfo>(),
                        Inconsistent = new List<ResponseTypeInfo>(),
                        Issues = ToResponseIssues(batchResult.Issues),
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true,
                            ["totalTypes"] = 0,
                            ["exportedTypes"] = 0,
                            ["issueCount"] = batchResult.Issues.Count,
                            ["duration"] = (DateTime.Now - startTime).TotalSeconds
                        }
                    };
                }

                var exportedCount = batchResult.Items.Count;
                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalTypes,
                        Message = $"Exported {exportedCount} of {totalTypes} types",
                        progressToken
                    });
                }

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalTypes,
                        Message = $"Type export completed: {exportedCount} types exported, {batchResult.Issues.Count} issues",
                        progressToken
                    });
                }

                var responseList = batchResult.Items
                    .Select(type => DtoMapper.ToTypeInfo(type, Portal.GetTypePath))
                    .ToList();
                var inconsistentTypeInfos = batchResult.Inconsistent
                    .Select(type => DtoMapper.ToTypeInfo(type, Portal.GetTypePath))
                    .ToList();
                var issues = ToResponseIssues(batchResult.Issues);
                var duration = (DateTime.Now - startTime).TotalSeconds;

                Logger?.LogInformation($"Type export completed: {exportedCount} types exported in {duration:F2} seconds with {issues.Count} issues");

                return new ResponseExportTypes
                {
                    Message = $"Export completed: {exportedCount} of {totalTypes} types with regex '{regexName}' exported from '{softwarePath}' to '{exportPath}'",
                    Items = responseList,
                    Inconsistent = inconsistentTypeInfos,
                    Issues = issues,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = true,
                        ["partial"] = issues.Count > 0,
                        ["totalTypes"] = totalTypes,
                        ["exportedTypes"] = exportedCount,
                        ["inconsistentTypes"] = inconsistentTypeInfos.Count,
                        ["issueCount"] = issues.Count,
                        ["duration"] = duration
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                // Send error progress notification if we have a progress token
                if (progressToken != null)
                {
                    try
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = $"Type export failed: {ex.Message}",
                            Error = true,
                            progressToken
                        });
                    }
                    catch
                    {
                        // Ignore notification errors during error handling
                    }
                }
                
                Logger?.LogError(ex, $"Failed exporting types '{regexName}' from '{softwarePath}' to {exportPath}");
                throw new McpException($"Unexpected error exporting types '{regexName}' from '{softwarePath}' to {exportPath}: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        #endregion

        #region documents

        [McpServerTool(Name = "ExportAsDocuments"), Description("Export as documents (.s7dcl/.s7res) from a block in the plc software to path")]
        public static ResponseExportAsDocuments ExportAsDocuments(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("blockPath: defines the path in the project structure to the block")] string blockPath,
            [Description("exportPath: defines the path where to export the documents")] string exportPath,
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            try
            {
                if (Engineering.TiaMajorVersion < 20)
                {
                    throw new McpException("ExportAsDocuments requires TIA Portal V20 or newer", McpErrorCode.InvalidParams);
                }
                if (Portal.ExportAsDocuments(softwarePath, blockPath, exportPath, preservePath))
                {
                    return new ResponseExportAsDocuments
                    {
                        Message = $"Documents exported from '{blockPath}' to '{exportPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed exporting documents from '{blockPath}' to '{exportPath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error exporting documents from '{blockPath}' to '{exportPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ExportBlocksAsDocuments"), Description("Export as documents (.s7dcl/.s7res) from blocks in the plc software to path")]
        public static async Task<ResponseExportBlocksAsDocuments> ExportBlocksAsDocuments(
            IMcpServer server,
            RequestContext<CallToolRequestParams> context,
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("exportPath: defines the path where to export the documents")] string exportPath,
            [Description("regexName: defines the name or regular expression to find the block. Use empty string (default) to find all")] string regexName = "",
            [Description("preservePath: preserves the path/structure of the plc software")] bool preservePath = false)
        {
            var startTime = DateTime.Now;
            var progressToken = context.Params?.ProgressToken;
            
            try
            {
                if (Engineering.TiaMajorVersion < 20)
                {
                    throw new McpException("ExportBlocksAsDocuments requires TIA Portal V20 or newer", McpErrorCode.InvalidParams);
                }
                Logger?.LogInformation($"Starting export of blocks as documents from '{softwarePath}' to '{exportPath}'");

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = 0,
                        Total = 0,
                        Message = "Starting document export...",
                        progressToken
                    });
                }

                var batchResult = await Task.Run(() => Portal.ExportBlocksAsDocumentsDetailed(softwarePath, exportPath, regexName, preservePath));
                var totalBlocks = batchResult.Total;

                if (totalBlocks == 0)
                {
                    if (progressToken != null)
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = "No blocks found to export as documents",
                            progressToken
                        });
                    }
                    
                    return new ResponseExportBlocksAsDocuments
                    {
                        Message = $"No blocks found with regex '{regexName}' in '{softwarePath}'",
                        Items = new List<ResponseBlockInfo>(),
                        Inconsistent = new List<ResponseBlockInfo>(),
                        Issues = ToResponseIssues(batchResult.Issues),
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true,
                            ["totalBlocks"] = 0,
                            ["exportedBlocks"] = 0,
                            ["issueCount"] = batchResult.Issues.Count,
                            ["duration"] = (DateTime.Now - startTime).TotalSeconds
                        }
                    };
                }

                var exportedCount = batchResult.Items.Count;
                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalBlocks,
                        Message = $"Exported {exportedCount} of {totalBlocks} blocks as documents",
                        progressToken
                    });
                }

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = exportedCount,
                        Total = totalBlocks,
                        Message = $"Document export completed: {exportedCount} blocks exported, {batchResult.Issues.Count} issues",
                        progressToken
                    });
                }

                var responseList = batchResult.Items
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var inconsistentInfos = batchResult.Inconsistent
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var issues = ToResponseIssues(batchResult.Issues);
                var duration = (DateTime.Now - startTime).TotalSeconds;

                Logger?.LogInformation($"Document export completed: {exportedCount} blocks exported in {duration:F2} seconds with {issues.Count} issues");

                return new ResponseExportBlocksAsDocuments
                {
                    Message = $"Document export completed: {exportedCount} of {totalBlocks} blocks with regex '{regexName}' exported from '{softwarePath}' to '{exportPath}'",
                    Items = responseList,
                    Inconsistent = inconsistentInfos,
                    Issues = issues,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = true,
                        ["partial"] = issues.Count > 0,
                        ["totalBlocks"] = totalBlocks,
                        ["exportedBlocks"] = exportedCount,
                        ["inconsistentBlocks"] = inconsistentInfos.Count,
                        ["issueCount"] = issues.Count,
                        ["duration"] = duration
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                // Send error progress notification if we have a progress token
                if (progressToken != null)
                {
                    try
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = $"Document export failed: {ex.Message}",
                            Error = true,
                            progressToken
                        });
                    }
                    catch
                    {
                        // Ignore notification errors during error handling
                    }
                }
                
                Logger?.LogError(ex, $"Failed exporting documents to '{exportPath}'");
                throw new McpException($"Unexpected error exporting documents to '{exportPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "GenerateBlocksFromSource"), Description("Generate PLC blocks from an external source file such as .scl using TIA Openness external sources")]
        public static ResponseGenerateBlocksFromSource GenerateBlocksFromSource(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("groupPath: optional target user block group path, empty for root program blocks")] string groupPath,
            [Description("sourcePath: full path to an external source file, for example a .scl file")] string sourcePath,
            [Description("externalSourceName: optional TIA external source name; defaults to the source file name without extension")] string externalSourceName = "",
            [Description("generateOption: GenerateBlockOption value (None, KeepOnError)")] string generateOption = "None",
            [Description("deleteExternalSourceAfterGenerate: delete the temporary external source after blocks are generated")] bool deleteExternalSourceAfterGenerate = false)
        {
            try
            {
                var option = ParseGenerateBlockOption(generateOption);
                var batchResult = Portal.GenerateBlocksFromSource(softwarePath, groupPath, sourcePath, externalSourceName, option, deleteExternalSourceAfterGenerate);
                var responseList = batchResult.Items
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var issues = ToResponseIssues(batchResult.Issues);

                return new ResponseGenerateBlocksFromSource
                {
                    Message = $"Generated {responseList.Count} block(s) from source '{sourcePath}'",
                    Items = responseList,
                    Issues = issues,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = responseList.Count > 0 && issues.Count == 0,
                        ["partial"] = responseList.Count > 0 && issues.Count > 0,
                        ["totalObjects"] = batchResult.Total,
                        ["generatedBlocks"] = responseList.Count,
                        ["issueCount"] = issues.Count
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                Logger?.LogError(ex, "Failed generating blocks from source '{SourcePath}'", sourcePath);
                throw new McpException($"Unexpected error generating blocks from source '{sourcePath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ImportFromDocuments"), Description("Import program block from SIMATIC SD documents (.s7dcl/.s7res) into PLC software (V20+)")]
        public static ResponseImportFromDocuments ImportFromDocuments(
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("groupPath: optional path within the PLC program where the block should be placed (empty for root)")] string groupPath,
            [Description("importPath: directory containing the document files (.s7dcl/.s7res)")] string importPath,
            [Description("fileNameWithoutExtension: name of the block file without extension") ] string fileNameWithoutExtension,
            [Description("importOption: ImportDocumentOptions value (None, Override, SkipInactiveCultures, ActivateInactiveCultures)")] string importOption = "Override")
        {
            try
            {
                if (Engineering.TiaMajorVersion < 20)
                {
                    throw new McpException("ImportFromDocuments requires TIA Portal V20 or newer", McpErrorCode.InvalidParams);
                }

                var option = ParseImportDocumentOption(importOption);

                // Pre-check .s7res for missing en-US tags
                var warnings = new JsonArray();
                try
                {
                    var missingIds = GetResMissingEnUsIds(importPath, fileNameWithoutExtension);
                    if (missingIds != null && missingIds.Count > 0)
                    {
                        Logger?.LogWarning($".s7res for '{fileNameWithoutExtension}' missing en-US tags for {missingIds.Count} items: {string.Join(", ", missingIds)}");
                        warnings.Add(new JsonObject
                        {
                            ["name"] = fileNameWithoutExtension,
                            ["missingEnUsIds"] = new JsonArray(missingIds.Select(id => (JsonNode)id).ToArray())
                        });
                    }
                }
                catch (Exception ex)
                {
                    Logger?.LogDebug(ex, "Failed to evaluate .s7res warnings");
                }

                var ok = Portal.ImportFromDocuments(softwarePath, groupPath, importPath, fileNameWithoutExtension, option);
                if (ok)
                {
                    return new ResponseImportFromDocuments
                    {
                        Message = $"Imported '{fileNameWithoutExtension}' from '{importPath}'",
                        Meta = new JsonObject
                        {
                            ["timestamp"] = DateTime.Now,
                            ["success"] = true,
                            ["warnings"] = warnings
                        }
                    };
                }
                else
                {
                    throw new McpException($"Failed importing '{fileNameWithoutExtension}' from '{importPath}'", McpErrorCode.InternalError);
                }
            }
            catch (Exception ex) when (ex is not McpException)
            {
                throw new McpException($"Unexpected error importing from documents: {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        [McpServerTool(Name = "ImportBlocksFromDocuments"), Description("Import program blocks from SIMATIC SD documents (.s7dcl/.s7res) into PLC software (V20+)")]
        public static async Task<ResponseImportBlocksFromDocuments> ImportBlocksFromDocuments(
            IMcpServer server,
            RequestContext<CallToolRequestParams> context,
            [Description("softwarePath: defines the path in the project structure to the plc software")] string softwarePath,
            [Description("groupPath: optional path within the PLC program where the blocks should be placed (empty for root)")] string groupPath,
            [Description("importPath: directory containing the document files (.s7dcl/.s7res)")] string importPath,
            [Description("regexName: name or regular expression to select block files (empty for all)")] string regexName = "",
            [Description("importOption: ImportDocumentOptions value (None, Override, SkipInactiveCultures, ActivateInactiveCultures)")] string importOption = "Override")
        {
            var startTime = DateTime.Now;
            var progressToken = context.Params?.ProgressToken;

            try
            {
                if (Engineering.TiaMajorVersion < 20)
                {
                    throw new McpException("ImportBlocksFromDocuments requires TIA Portal V20 or newer", McpErrorCode.InvalidParams);
                }

                // Determine total by scanning .s7dcl files matching regex
                int total = 0;
                var scanWarnings = new JsonArray();
                try
                {
                    if (Directory.Exists(importPath))
                    {
                        var rx = string.IsNullOrWhiteSpace(regexName) ? null : new Regex(regexName, RegexOptions.Compiled);
                        var files = Directory.GetFiles(importPath, "*.s7dcl", SearchOption.TopDirectoryOnly);
                        foreach (var f in files)
                        {
                            var name = Path.GetFileNameWithoutExtension(f);
                            if (rx != null && !rx.IsMatch(name))
                                continue;
                            total++;

                            try
                            {
                                var missingIds = GetResMissingEnUsIds(importPath, name);
                                if (missingIds != null && missingIds.Count > 0)
                                {
                                    scanWarnings.Add(new JsonObject
                                    {
                                        ["name"] = name,
                                        ["missingEnUsIds"] = new JsonArray(missingIds.Select(id => (JsonNode)id).ToArray())
                                    });
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { /* ignore pre-scan errors */ }

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = 0,
                        Total = total,
                        Message = total > 0 ? $"Starting import of {total} blocks from documents..." : "Scanning import directory...",
                        progressToken
                    });
                }

                var option = ParseImportDocumentOption(importOption);
                var batchResult = await Task.Run(() => Portal.ImportBlocksFromDocumentsDetailed(softwarePath, groupPath, importPath, regexName, option));
                total = batchResult.Total == 0 ? total : batchResult.Total;

                var responseList = batchResult.Items
                    .Select(block => DtoMapper.ToBlockInfo(block, Portal.GetBlockPath))
                    .ToList();
                var issues = ToResponseIssues(batchResult.Issues);
                int processed = batchResult.Items.Count;

                if (progressToken != null)
                {
                    await server.SendNotificationAsync("notifications/progress", new
                    {
                        Progress = processed,
                        Total = total,
                        Message = $"Document import completed: {processed} blocks imported, {issues.Count} issues",
                        progressToken
                    });
                }

                var duration = (DateTime.Now - startTime).TotalSeconds;
                Logger?.LogInformation($"Document import completed: {processed} blocks imported in {duration:F2} seconds with {issues.Count} issues");

                return new ResponseImportBlocksFromDocuments
                {
                    Message = $"Document import completed: {processed} of {total} blocks imported from '{importPath}'",
                    Items = responseList,
                    Issues = issues,
                    Meta = new JsonObject
                    {
                        ["timestamp"] = DateTime.Now,
                        ["success"] = true,
                        ["partial"] = issues.Count > 0,
                        ["totalBlocks"] = total,
                        ["importedBlocks"] = processed,
                        ["issueCount"] = issues.Count,
                        ["duration"] = duration,
                        ["warnings"] = scanWarnings
                    }
                };
            }
            catch (Exception ex) when (ex is not McpException)
            {
                if (progressToken != null)
                {
                    try
                    {
                        await server.SendNotificationAsync("notifications/progress", new
                        {
                            Progress = 0,
                            Total = 0,
                            Message = $"Document import failed: {ex.Message}",
                            Error = true,
                            progressToken
                        });
                    }
                    catch { }
                }

                Logger?.LogError(ex, $"Failed importing documents from '{importPath}'");
                throw new McpException($"Unexpected error importing documents from '{importPath}': {ex.Message}", ex, McpErrorCode.InternalError);
            }
        }

        private static ImportDocumentOptions ParseImportDocumentOption(string option)
        {
            if (string.IsNullOrWhiteSpace(option)) return ImportDocumentOptions.Override;

            var normalized = option.Trim();

            // Primary: accept exact enum names (case-insensitive)
            if (Enum.TryParse<ImportDocumentOptions>(normalized, ignoreCase: true, out var parsed))
            {
                return parsed;
            }

            // Aliases and common misspellings
            switch (normalized.ToLowerInvariant())
            {
                case "override": return ImportDocumentOptions.Override;
                case "none": return ImportDocumentOptions.None;
                case "skipinactiveculture":
                case "skipinactivecultures":
                case "skipinactive":
                case "skipinactivecult":
                    return ImportDocumentOptions.SkipInactiveCultures;
                case "activeinactiveculture":
                case "activateinactivecultures":
                case "activeinactivecultures":
                case "activateinactive":
                    return ImportDocumentOptions.ActivateInactiveCultures;
                default:
                    throw new McpException($"Invalid importOption '{option}'. Allowed: None, Override, SkipInactiveCultures, ActivateInactiveCultures", McpErrorCode.InvalidParams);
            }
        }

        private static GenerateBlockOption ParseGenerateBlockOption(string option)
        {
            if (string.IsNullOrWhiteSpace(option)) return GenerateBlockOption.None;

            var normalized = option.Trim();
            if (Enum.TryParse<GenerateBlockOption>(normalized, ignoreCase: true, out var parsed))
            {
                return parsed;
            }

            switch (normalized.ToLowerInvariant())
            {
                case "none":
                    return GenerateBlockOption.None;
                case "keeponerror":
                case "keep-on-error":
                case "keep_on_error":
                    return GenerateBlockOption.KeepOnError;
                default:
                    throw new McpException($"Invalid generateOption '{option}'. Allowed: None, KeepOnError", McpErrorCode.InvalidParams);
            }
        }

        private static List<string> GetResMissingEnUsIds(string directory, string baseName)
        {
            var resPath = Path.Combine(directory, baseName + ".s7res");
            var missing = new List<string>();
            if (!File.Exists(resPath))
            {
                return missing;
            }
            var xdoc = XDocument.Load(resPath);
            XNamespace ns = xdoc.Root?.Name.Namespace ?? XNamespace.None;
            foreach (var comment in xdoc.Descendants(ns + "Comment"))
            {
                var hasEnUs = comment.Elements(ns + "MultiLanguageText")
                                     .Any(e => string.Equals((string?)e.Attribute("Lang"), "en-US", StringComparison.OrdinalIgnoreCase));
                if (!hasEnUs)
                {
                    var id = (string?)comment.Attribute("Id") ?? "";
                    missing.Add(id);
                }
            }
            return missing;
        }

        #endregion
    }
}
