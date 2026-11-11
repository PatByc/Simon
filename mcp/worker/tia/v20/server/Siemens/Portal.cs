using Microsoft.Extensions.Logging;
using Siemens.Engineering;
using Siemens.Engineering.Compiler;
using Siemens.Engineering.Hmi;
using Siemens.Engineering.HmiUnified;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Safety;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;

namespace TiaMcpServer.Siemens
{
    public class Portal
    {
        // Closing parentheses for regex characters omitted because they are not relevant for regex detection.
        private readonly char[] _regexChars = ['.', '^', '$', '*', '+', '?', '(', '[', '{', '\\', '|'];

        private TiaPortal? _portal;
        private ProjectBase? _project;
        private readonly ILogger<Portal>? _logger;
        private readonly object _analysisSnapshotLock = new object();
        private readonly Dictionary<string, AnalysisSnapshot> _analysisSnapshots = new Dictionary<string, AnalysisSnapshot>(StringComparer.OrdinalIgnoreCase);
        private int _analysisRevision;

        private const int AnalysisSnapshotCacheSeconds = 30;

        public string? LastConnectionError { get; private set; }

        private sealed class AnalysisSnapshot
        {
            public string ProjectIdentity { get; set; } = "";
            public string SoftwarePath { get; set; } = "";
            public string BlockRegex { get; set; } = "";
            public string SnapshotRoot { get; set; } = "";
            public string SnapshotPath { get; set; } = "";
            public int ExportedBlockCount { get; set; }
            public int Revision { get; set; }
            public DateTime CreatedAtUtc { get; set; }
            public bool Reused { get; set; }
            public long AgeMilliseconds { get; set; }
            public List<PortalIssue> Issues { get; } = new List<PortalIssue>();
        }

        #region ctor

        public Portal(ILogger<Portal>? logger = null)
        {
            _logger = logger;
        }

        #endregion

        #region helper for mcp server

        public bool ProjectIsValid
        {
            get
            {
                if (_project == null)
                {
                    return false;
                }

                return _project is Project;
            }
        }

        #endregion

        #region helper for unit tests

        public static bool IsLocalProjectFile(string projectPath)
        {
            // Check if the path ends with '.ap\d+' using regex
            var regex = new Regex(@"\.ap\d+$", RegexOptions.IgnoreCase);
            return regex.IsMatch(projectPath);
        }

        public void Dispose()
        {
            InvalidateAnalysisSnapshots("portal disposed");

            try
            {
                (_project as Project)?.Close();
            }
            catch (Exception)
            {
                // Console.WriteLine($"Error closing the project: {ex.Message}");
            }

            try
            {
                _portal?.Dispose();
            }
            catch (Exception)
            {
                // Console.WriteLine($"Error closing the portal: {ex.Message}");
            }
        }

        #endregion

        #region portal

        public bool ConnectPortal(int? processId = null)
        {
            _logger?.LogInformation("Connecting to TIA Portal{ProcessSelection}...", processId.HasValue ? $" process {processId.Value}" : string.Empty);
            LastConnectionError = null;

            try
            {
                if (_portal != null)
                {
                    try
                    {
                        _project = _portal.Projects.FirstOrDefault();
                        return true;
                    }
                    catch (EngineeringObjectDisposedException)
                    {
                        _portal = null;
                        _project = null;
                    }
                }

                // connect to running TIA Portal
                var discoveryWatch = Stopwatch.StartNew();
                _logger?.LogInformation("Discovering running TIA Portal processes...");
                var processes = TiaPortal.GetProcesses().ToList();
                if (processId.HasValue)
                {
                    processes = processes.Where(process => process.Id == processId.Value).ToList();
                    if (processes.Count == 0)
                    {
                        LastConnectionError = $"TIA Portal process {processId.Value} was not found.";
                        return false;
                    }
                }
                _logger?.LogInformation(
                    "Discovered {ProcessCount} eligible TIA Portal process(es) in {ElapsedMilliseconds} ms",
                    processes.Count,
                    discoveryWatch.ElapsedMilliseconds);
                if (processes.Any())
                {
                    TiaPortal? fallbackPortal = null;
                    var processProjectPaths = new Dictionary<TiaPortalProcess, FileInfo?>();
                    foreach (var process in processes)
                    {
                        var pathWatch = Stopwatch.StartNew();
                        _logger?.LogInformation(
                            "Reading project path for TIA Portal process {ProcessId}...",
                            process.Id);
                        var projectPath = GetPortalProcessProjectPath(process);
                        processProjectPaths[process] = projectPath;
                        _logger?.LogInformation(
                            "Read project path for TIA Portal process {ProcessId} in {ElapsedMilliseconds} ms: {ProjectPath}",
                            process.Id,
                            pathWatch.ElapsedMilliseconds,
                            projectPath?.FullName ?? "no project");
                    }

                    var projectProcesses = processes
                        .Where(process => processProjectPaths[process] != null)
                        .OrderByDescending(process => process.AcquisitionTime)
                        .ToList();
                    var candidates = projectProcesses.Count > 0
                        ? projectProcesses
                        : processes.OrderByDescending(process => process.AcquisitionTime).ToList();

                    foreach (var process in candidates)
                    {
                        TiaPortal? attachedPortal = null;
                        try
                        {
                            var attachWatch = Stopwatch.StartNew();
                            _logger?.LogInformation(
                                "Attaching to TIA Portal process {ProcessId} ({ProjectPath})...",
                                process.Id,
                                processProjectPaths[process]?.FullName ?? "no project");
                            attachedPortal = process.Attach();
                            _logger?.LogInformation(
                                "Attached to TIA Portal process {ProcessId} in {ElapsedMilliseconds} ms; reading open projects...",
                                process.Id,
                                attachWatch.ElapsedMilliseconds);

                            var hasProject = attachedPortal.Projects.Any();
                            _logger?.LogInformation(
                                "TIA Portal process {ProcessId} project enumeration completed in {ElapsedMilliseconds} ms; has project: {HasProject}",
                                process.Id,
                                attachWatch.ElapsedMilliseconds,
                                hasProject);
                            if (hasProject)
                            {
                                fallbackPortal?.Dispose();
                                _portal = attachedPortal;
                                _project = _portal.Projects.First();
                                attachedPortal = null;
                                InvalidateAnalysisSnapshots("portal connection changed");
                                return true;
                            }

                            if (fallbackPortal == null)
                            {
                                fallbackPortal = attachedPortal;
                                attachedPortal = null;
                            }
                        }
                        catch (Exception ex)
                        {
                            LastConnectionError = ex is EngineeringSecurityException
                                ? $"TIA Openness authorization was denied or timed out for process {process.Id}. Run Connect again and keep the same request active while approving the 'Openness access' dialog."
                                : $"Could not attach to TIA Portal process {process.Id}: {ex.GetType().Name}: {ex.Message}";
                            _logger?.LogWarning(
                                ex,
                                "Could not attach to TIA Portal process {ProcessId} ({ProjectPath})",
                                process.Id,
                                processProjectPaths[process]?.FullName ?? "no project");
                        }
                        finally
                        {
                            attachedPortal?.Dispose();
                        }
                    }

                    if (fallbackPortal != null)
                    {
                        _portal = fallbackPortal;
                        _project = null;
                        InvalidateAnalysisSnapshots("portal connection changed");
                        return true;
                    }

                    _logger?.LogWarning("TIA Portal processes are running, but none could be attached. A new Portal instance will not be started.");
                    if (string.IsNullOrWhiteSpace(LastConnectionError))
                    {
                        LastConnectionError = "TIA Portal processes are running, but none could be attached.";
                    }
                    return false;
                }

                // start new TIA Portal
                _portal = new TiaPortal(TiaPortalMode.WithUserInterface);
                _project = null;
                InvalidateAnalysisSnapshots("portal connection changed");
                return true;
            }
            catch (Exception ex)
            {
                LastConnectionError = $"Failed connecting to TIA Portal: {ex.GetType().Name}: {ex.Message}";
                _logger?.LogError(ex, "Failed connecting to TIA Portal");
                return false;
            }
        }

        private static FileInfo? GetPortalProcessProjectPath(TiaPortalProcess process)
        {
            try
            {
                return process.ProjectPath;
            }
            catch
            {
                return null;
            }
        }

        public bool IsConnected()
        {
            return _portal != null;
        }

        public bool DisconnectPortal()
        {
            _logger?.LogInformation("Disconnecting from TIA Portal...");
            InvalidateAnalysisSnapshots("portal disconnected");

            try
            {
                _project = null;

                _portal?.Dispose();
                _portal = null;

                return true;
            }
            catch (Exception)
            {
                // Handle exception if needed, e.g., log it
            }

            return false;
        }

        #endregion

        #region status

        public State GetState()
        {
            _logger?.LogInformation("Getting TIA Portal state...");
            if (_portal != null)
            {
                if (_portal.Projects.Any())
                {
                    _project = _portal.Projects.First();
                }
            }

            return new State
            {
                IsConnected = IsConnected(),
                Project = _project != null ? _project.Name : "-"
            };
        }

        #endregion

        #region project

        public List<ProjectBase> GetProjects()
        {
            _logger?.LogInformation("Getting open projects...");

            if (_portal == null)
            {
                _logger?.LogWarning("No TIA Portal instance available.");

                return [];
            }

            var projects = new List<ProjectBase>();

            if (_portal.Projects != null)
            {
                foreach (var project in _portal.Projects)
                {
                    projects.Add(project);
                }
            }

            return projects;
        }

        public bool OpenProject(string projectPath)
        {
            _logger?.LogInformation($"Opening project: {projectPath}");

            if (IsPortalNull())
            {
                return false;
            }

            try
            {
                var projectName = Path.GetFileNameWithoutExtension(projectPath);
                var requestedProjectPath = Path.GetFullPath(projectPath);
                if (string.IsNullOrEmpty(projectName))
                {
                    return false;
                }

                if (_project != null)
                {
                    try
                    {
                        if (string.Equals(GetProjectFullPath(_project), requestedProjectPath, StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                    }
                    catch (EngineeringObjectDisposedException)
                    {
                        _project = null;
                    }
                }

                if (_project != null)
                {
                    CloseProject();
                }

                var projects = GetProjects();
                var openProject = projects.FirstOrDefault(project =>
                    string.Equals(GetProjectFullPath(project), requestedProjectPath, StringComparison.OrdinalIgnoreCase));

                if (openProject != null)
                {
                    // Project is already open
                    _project = openProject;
                    if (_project != null)
                    {
                        InvalidateAnalysisSnapshots("project opened");
                    }
                    return _project != null;
                }
                else
                {
                    // See section 5.3.1, "Open project", p. 113.
                    _project = _portal?.Projects.OpenWithUpgrade(new FileInfo(projectPath));
                    if (_project != null)
                    {
                        InvalidateAnalysisSnapshots("project opened");
                    }
                    return _project != null;
                }
            }
            catch (Exception)
            {
                return false;
            }
        }

        public object? GetProjectInfo()
        {
            _logger?.LogInformation("Getting project info...");

            if (IsPortalNull())
            {
                return null;
            }

            if (IsProjectNull())
            {
                return null;
            }

            var project = _project!;

            var info = new
            {
                Name = project.Name,
                Path = project.Path,
                Type = project.GetType().Name
            };

            return info;
        }

        public bool SaveProject()
        {
            _logger?.LogInformation("Saving project...");

            if (IsProjectNull())
            {
                return false;
            }

            (_project as Project)?.Save();

            return true;
        }

        public bool SaveAsProject(string path)
        {
            _logger?.LogInformation($"Saving project as: {path}");

            if (IsProjectNull())
            {
                return false;
            }

            var di = new DirectoryInfo(path);

            (_project as Project)?.SaveAs(di);
            InvalidateAnalysisSnapshots("project saved as a new copy");

            return true;
        }

        public bool CloseProject()
        {
            _logger?.LogInformation("Closing project...");

            if (IsProjectNull())
            {
                return false;
            }

            try
            {
                (_project as Project)?.Close();
            }
            catch (EngineeringObjectDisposedException ex)
            {
                _logger?.LogWarning(ex, "TIA project object was already disposed while closing; clearing local project state.");
            }
            finally
            {
                _project = null;
                InvalidateAnalysisSnapshots("project closed");
            }

            return true;
        }

        #endregion

        #region devices

        public string GetProjectTree()
        {
            _logger?.LogInformation("Getting project tree...");

            if (IsProjectNull())
            {
                return string.Empty;
            }

            StringBuilder sb = new();

            sb.AppendLine($"{_project?.Name}");

            var ancestorStates = new List<bool>();
            var sections = new List<Action>();
            
            if (_project?.Devices != null && _project.Devices.Count > 0)
            {
                sections.Add(() => GetProjectTreeDevices(sb, _project.Devices, ancestorStates));
            }
            
            if (_project?.DeviceGroups != null && _project.DeviceGroups.Count > 0)
            {
                sections.Add(() => GetProjectTreeGroups(sb, _project.DeviceGroups, ancestorStates));
            }
            
            if (_project?.UngroupedDevicesGroup != null)
            {
                sections.Add(() => GetProjectTreeUngroupedDeviceGroup(sb, _project.UngroupedDevicesGroup, ancestorStates));
            }
            
            foreach (var section in sections)
            {
                section();
            }

            return sb.ToString();
        }

        

        public List<Device> GetDevices(string regexName = "")
        {
            _logger?.LogInformation("Getting devices...");

            if (IsProjectNull())
            {
                return [];
            }

            var list = new List<Device>();

            if (_project?.Devices != null)
            {
                foreach (Device device in _project.Devices)
                {
                    list.Add(device);
                }

                foreach (var group in _project.DeviceGroups)
                {
                    GetDevicesRecursive(group, list, regexName);
                }

                //foreach (var group in _project.UngroupedDevicesGroup)
                //{
                //    GetDevicesRecursive(_project.UngroupedDevicesGroup, list, regexName);
                //}
            }

            return list;
        }

        public Device? GetDevice(string devicePath)
        {
            _logger?.LogInformation($"Getting device by path: {devicePath}");

            if (IsProjectNull())
            {
                return null;
            }

            // Retrieve the device by its path
            return GetDeviceByPath(devicePath);
        }

        public DeviceItem? GetDeviceItem(string deviceItemPath)
        {
            _logger?.LogInformation($"Getting device item by path: {deviceItemPath}");

            if (IsProjectNull())
            {
                return null;
            }

            // Retrieve the device by its path
            return GetDeviceItemByPath(deviceItemPath);

        }

        #endregion

        #region software

        public PlcSoftware? GetPlcSoftware(string softwarePath)
        {
            _logger?.LogInformation($"Getting software by path: {softwarePath}");

            if (IsProjectNull())
            {
                return null;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);

            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                return plcSoftware;
            }

            return null;
        }

        public CompilerResult? CompileSoftware(string softwarePath, string password = "")
        {
            _logger?.LogInformation($"Compiling software by path: {softwarePath}");

            if (IsProjectNull())
            {
                return null; // "Error, no project";
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);

            if (!string.IsNullOrEmpty(password))
            {
                var deviceItem = softwareContainer?.Parent as DeviceItem;

                var admin = deviceItem?.GetService<SafetyAdministration>();
                if (admin != null)
                {
                    if (!admin.IsLoggedOnToSafetyOfflineProgram)
                    {
                        SecureString secString = new NetworkCredential("", password).SecurePassword;
                        try
                        {
                            admin.LoginToSafetyOfflineProgram(secString);
                        }
                        catch (Exception)
                        {
                            return null; // "Error, login to safety offline program failed";
                        }
                    }
                }
            }

            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                try
                {
                    InvalidateAnalysisSnapshots("PLC software compile started");
                    ICompilable compileService = plcSoftware.GetService<ICompilable>();

                    CompilerResult result = compileService.Compile();

                    return result;
                }
                catch (Exception)
                {
                    return null; // "Error, compiling failed";
                }
            }

            return null; // "Error";
        }

        #endregion

        #region tags

        public List<PlcTagTable> GetTagTables(string softwarePath)
        {
            _logger?.LogInformation("Getting PLC tag tables...");

            var list = new List<PlcTagTable>();
            if (IsProjectNull())
            {
                return list;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware && plcSoftware.TagTableGroup != null)
            {
                GetTagTablesRecursive(plcSoftware.TagTableGroup, list);
            }

            return list;
        }

        public string GetTagTablePath(PlcTagTable table)
        {
            if (table == null)
            {
                return string.Empty;
            }

            if (table.Parent is PlcTagTableGroup parentGroup)
            {
                var groupPath = GetPlcTagTableGroupPath(parentGroup);
                return string.IsNullOrEmpty(groupPath) ? table.Name : $"{groupPath}/{table.Name}";
            }

            return table.Name;
        }

        #endregion

        #region blocks/types

        public PlcBlock? GetBlock(string softwarePath, string blockPath)
        {
            _logger?.LogInformation($"Getting block by path: {blockPath}");

            if (IsProjectNull())
            {
                return null;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                var blockGroup = plcSoftware?.BlockGroup;

                if (blockGroup != null)
                {
                    var path = blockPath.Contains("/") ? blockPath.Substring(0, blockPath.LastIndexOf("/")) : string.Empty;
                    var regexName = blockPath.Contains("/") ? blockPath.Substring(blockPath.LastIndexOf("/") + 1) : blockPath;

                    PlcBlock? block = null;

                    var group = GetPlcBlockGroupByPath(softwarePath, path);
                    if (group != null)
                    {
                        if (regexName.IndexOfAny(_regexChars) >= 0)
                        {
                            try
                            {
                                var regex = new Regex(regexName, RegexOptions.IgnoreCase);
                                block = group.Blocks.FirstOrDefault(b => regex.IsMatch(b.Name)) as PlcBlock;
                            }
                            catch (Exception)
                            {
                                // Invalid regex, return null
                                return null;
                            }
                        }
                        else
                        {
                            block = group.Blocks.FirstOrDefault(b => b.Name.Equals(regexName, StringComparison.OrdinalIgnoreCase));
                        }

                        return block;
                    }
                }
            }

            return null;
        }

        public PlcType? GetType(string softwarePath, string typePath)
        {
            _logger?.LogInformation($"Getting type by path: {typePath}");

            if (IsProjectNull())
            {
                return null;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                var typeGroup = plcSoftware?.TypeGroup;

                if (typeGroup != null)
                {
                    var path = typePath.Contains("/") ? typePath.Substring(0, typePath.LastIndexOf("/")) : string.Empty;
                    var regexName = typePath.Contains("/") ? typePath.Substring(typePath.LastIndexOf("/") + 1) : typePath;

                    PlcType? type = null;

                    var group = GetPlcTypeGroupByPath(softwarePath, path);
                    if (group != null)
                    {
                        if (regexName.IndexOfAny(_regexChars) >= 0)
                        {
                            try
                            {
                                var regex = new Regex(regexName, RegexOptions.IgnoreCase);
                                type = group.Types.FirstOrDefault(t => regex.IsMatch(t.Name)) as PlcType;
                            }
                            catch (Exception)
                            {
                                // Invalid regex, return null
                                return null;
                            }
                        }
                        else
                        {
                            type = group.Types.FirstOrDefault(t => t.Name.Equals(regexName, StringComparison.OrdinalIgnoreCase));
                        }

                        return type;
                    }
                }
            }

            return null;
        }

        public string GetBlockPath(PlcBlock block)
        {
            if (block == null)
            {
                return string.Empty;
            }

            if (block.Parent is PlcBlockGroup parentGroup)
            {
                var groupPath = GetPlcBlockGroupPath(parentGroup);
                return string.IsNullOrEmpty(groupPath) ? block.Name : $"{groupPath}/{block.Name}";
            }

            return block.Name;
        }

        public string GetTypePath(PlcType type)
        {
            if (type == null)
            {
                return string.Empty;
            }

            if (type.Parent is PlcTypeGroup parentGroup)
            {
                var groupPath = GetPlcTypeGroupPath(parentGroup);
                return string.IsNullOrEmpty(groupPath) ? type.Name : $"{groupPath}/{type.Name}";
            }

            return type.Name;
        }

        public List<PlcBlock> GetBlocks(string softwarePath, string regexName = "")
        {
            _logger?.LogInformation("Getting blocks...");

            if (IsProjectNull())
            {
                return [];
            }

            var list = new List<PlcBlock>();

            try
            {
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    var group = plcSoftware?.BlockGroup;

                    if (group != null)
                    {
                        GetBlocksRecursive(group, list, regexName);
                    }
                }
            }
            catch (Exception)
            {
                // Console.WriteLine($"Error getting blocks: {ex.Message}");
            }

            return list;
        }

        public PlcBlockGroup? GetBlockRootGroup(string softwarePath)
        {
            _logger?.LogInformation("Getting block root group...");

            if (IsProjectNull())
            {
                return null;
            }

            try
            {
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    return plcSoftware.BlockGroup;
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error getting block root group");
            }

            return null;
        }

        public List<PlcType> GetTypes(string softwarePath, string regexName = "")
        {
            _logger?.LogInformation("Getting types...");

            if (IsProjectNull())
            {
                return [];
            }

            var list = new List<PlcType>();

            try
            {
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    var group = plcSoftware?.TypeGroup;

                    if (group != null)
                    {
                        GetTypesRecursive(group, list, regexName);
                    }
                }
            }
            catch (Exception)
            {
                // Console.WriteLine($"Error getting user defined types: {ex.Message}");
            }

            return list;
        }

        public PlcBlock? ExportBlock(string softwarePath, string blockPath, string exportPath, bool preservePath = false)
        {
            _logger?.LogInformation($"Exporting block by path: {blockPath}");

            try
            {
                if (IsProjectNull())
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
                }

                var block = GetBlock(softwarePath, blockPath);

                if (block == null)
                {
                    throw new PortalException(PortalErrorCode.NotFound, "Block not found");
                }

                if (preservePath)
                {
                    var groupPath = "";
                    if (block.Parent is PlcBlockGroup parentGroup)
                    {
                        groupPath = GetPlcBlockGroupPath(parentGroup);
                    }

                    exportPath = Path.Combine(exportPath, groupPath.Replace('/', '\\'), $"{block.Name}.xml");
                }
                else
                {
                    exportPath = Path.Combine(exportPath, $"{block.Name}.xml");
                }

                // TIA Portal never exports inconsistent blocks
                if (!block.IsConsistent)
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "Block is inconsistent; TIA Portal does not export inconsistent blocks.");
                }

                var exportDir = Path.GetDirectoryName(exportPath);
                if (!string.IsNullOrEmpty(exportDir) && !Directory.Exists(exportDir))
                {
                    Directory.CreateDirectory(exportDir);
                }

                if (File.Exists(exportPath))
                {
                    File.Delete(exportPath);
                }

                block.Export(new FileInfo(exportPath), ExportOptions.None);

                return block;
            }
            catch (Exception ex)
            {
                //If the exception is already a PortalException, use it; otherwise, wrap it in a new PortalException
                var pex = ex as PortalException ?? new PortalException(PortalErrorCode.ExportFailed, "Export failed", null, ex);

                pex.Data["softwarePath"] = softwarePath;
                pex.Data["blockPath"] = blockPath;
                pex.Data["exportPath"] = exportPath;

                _logger?.LogError(pex, "ExportBlock failed for {SoftwarePath} {BlockPath} -> {ExportPath}", softwarePath, blockPath, exportPath);
                throw pex;
            }
        }

        public PlcType? ExportType(string softwarePath, string typePath, string exportPath, bool preservePath = false)
        {
            _logger?.LogInformation($"Exporting type by path: {typePath}");

            try
            {
                if (IsProjectNull())
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
                }

                var type = GetType(softwarePath, typePath);

                if (type == null)
                {
                    throw new PortalException(PortalErrorCode.NotFound, "Type not found");
                }

                // TIA Portal never exports inconsistent types
                if (!type.IsConsistent)
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "Type is inconsistent; TIA Portal does not export inconsistent types.");
                }

                if (preservePath)
                {
                    var groupPath = "";
                    if (type.Parent is PlcTypeGroup parentGroup)
                    {
                        groupPath = GetPlcTypeGroupPath(parentGroup);
                    }

                    exportPath = Path.Combine(exportPath, groupPath.Replace('/', '\\'), $"{type.Name}.xml");
                }
                else
                {
                    exportPath = Path.Combine(exportPath, $"{type.Name}.xml");
                }

                var exportDir = Path.GetDirectoryName(exportPath);
                if (!string.IsNullOrEmpty(exportDir) && !Directory.Exists(exportDir))
                {
                    Directory.CreateDirectory(exportDir);
                }

                if (File.Exists(exportPath))
                {
                    File.Delete(exportPath);
                }

                type.Export(new FileInfo(exportPath), ExportOptions.None);

                return type;
            }
            catch (Exception ex)
            {
                var pex = ex as PortalException ?? new PortalException(PortalErrorCode.ExportFailed, "Export failed", null, ex);

                if (!pex.Data.Contains("softwarePath")) pex.Data["softwarePath"] = softwarePath;
                if (!pex.Data.Contains("typePath")) pex.Data["typePath"] = typePath;
                if (!pex.Data.Contains("exportPath")) pex.Data["exportPath"] = exportPath;

                _logger?.LogError(pex, "ExportType failed for {SoftwarePath} {TypePath} -> {ExportPath}", softwarePath, typePath, exportPath);
                throw pex;
            }
        }

        public bool ImportBlock(string softwarePath, string groupPath, string importPath)
        {
            return TryImportBlock(softwarePath, groupPath, importPath, out _);
        }

        private bool TryImportBlock(string softwarePath, string groupPath, string importPath, out string errorMessage)
        {
            _logger?.LogInformation($"Importing block from path: {importPath}");
            errorMessage = "";

            if (IsProjectNull())
            {
                errorMessage = "No project is open in TIA Portal.";
                return false;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                var blockGroup = plcSoftware?.BlockGroup;

                if (blockGroup != null)
                {

                    var group = GetPlcBlockGroupByPath(softwarePath, groupPath);
                    if (group == null)
                    {
                        errorMessage = $"PLC block group '{groupPath}' was not found.";
                        return false;
                    }

                    try
                    {
                        InvalidateAnalysisSnapshots("PLC block import started");
                        // Correct the argument type by using FileInfo instead of FileStream  
                        var fileInfo = new FileInfo(importPath);
                        if (fileInfo.Exists)
                        {
                            var list = group.Blocks.Import(fileInfo, ImportOptions.Override);
                            if (list != null && list.Count > 0)
                            {
                                return true;
                            }

                            errorMessage = "TIA Openness returned no imported blocks.";
                        }
                        else
                        {
                            errorMessage = $"Import XML file does not exist: {importPath}";
                        }

                    }
                    catch (Exception ex)
                    {
                        errorMessage = $"{ex.GetType().Name}: {ex.Message}";
                        _logger?.LogError(ex, "ImportBlock failed for {SoftwarePath} {GroupPath} <- {ImportPath}", softwarePath, groupPath, importPath);
                        return false;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(errorMessage))
            {
                errorMessage = $"PLC software was not found at '{softwarePath}'.";
            }

            return false;
        }

        public bool ImportType(string softwarePath, string groupPath, string importPath)
        {
            _logger?.LogInformation($"Importing type from path: {importPath}");

            var success = false;

            if (IsProjectNull())
            {
                return success;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                var typeGroup = plcSoftware?.TypeGroup;

                if (typeGroup != null)
                {
                    var group = GetPlcTypeGroupByPath(softwarePath, groupPath);
                    if (group == null)
                    {
                        return false;
                    }

                    try
                    {
                        InvalidateAnalysisSnapshots("PLC type import started");
                        // Correct the argument type by using FileInfo instead of FileStream  
                        var fileInfo = new FileInfo(importPath);
                        if (fileInfo.Exists)
                        {
                            var list = group.Types.Import(fileInfo, ImportOptions.Override);
                            if (list != null && list.Count > 0)
                            {
                                return true;
                            }
                        }
                    }
                    catch (Exception)
                    {
                        return false;
                    }
                }
            }

            return success;
        }

        public PortalBatchResult<PlcBlock> ExportBlocksDetailed(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            _logger?.LogInformation("Exporting blocks...");

            if (IsProjectNull())
            {
                throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
            }

            var result = new PortalBatchResult<PlcBlock>();
            PlcBlock[] list;

            try
            {
                list = GetBlocks(softwarePath, regexName).ToArray();
                result.Total = list.Length;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to retrieve block list for {SoftwarePath}", softwarePath);
                throw new PortalException(PortalErrorCode.InvalidState, "Failed to retrieve block list", null, ex);
            }

            for (int k = 0; k < list.Count(); k++)
            {
                var block = list[k];

                _logger?.LogDebug($"- Exporting block {k}/{list.Count()} : {block.Name}");

                string path;
                if (preservePath)
                {
                    var groupPath = "";
                    if (block.Parent is PlcBlockGroup parentGroup)
                    {
                        groupPath = GetPlcBlockGroupPath(parentGroup);
                    }
                    path = Path.Combine(exportPath, groupPath.Replace('/', '\\'), $"{block.Name}.xml");
                }
                else
                {
                    path = Path.Combine(exportPath, $"{block.Name}.xml");
                }

                try
                {
                    if (!block.IsConsistent)
                    {
                        _logger?.LogWarning("Skipping inconsistent block {Name}", block.Name);
                        result.Inconsistent.Add(block);
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "Inconsistent",
                            Item = block.Name,
                            Path = GetBlockPath(block),
                            Message = "TIA Portal does not export inconsistent blocks. Compile the PLC software first."
                        });
                        continue;
                    }

                    var dir = Path.GetDirectoryName(path);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    if (File.Exists(path))
                    {
                        try { File.Delete(path); }
                        catch (Exception ioEx)
                        {
                            result.Issues.Add(new PortalIssue
                            {
                                Code = "FileDeleteFailed",
                                Item = block.Name,
                                Path = path,
                                Message = ioEx.Message
                            });
                            _logger?.LogError(ioEx, "Delete failed for {File}", path);

                            continue;
                        }
                    }

                    try
                    {
                        block.Export(new FileInfo(path), ExportOptions.None);
                    }
                    catch (LicenseNotFoundException licEx)
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "LicenseNotFound",
                            Item = block.Name,
                            Path = path,
                            Message = licEx.Message
                        });
                        _logger?.LogError(licEx, "License issue exporting {Block}", block.Name);

                        continue;
                    }
                    catch (EngineeringTargetInvocationException engEx)
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "EngineeringTargetInvocation",
                            Item = block.Name,
                            Path = path,
                            Message = engEx.Message
                        });
                        _logger?.LogError(engEx, "TargetInvocationException exporting {Block}", block.Name);

                        continue;
                    }
                    catch (Exception ex)
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "ExportFailed",
                            Item = block.Name,
                            Path = path,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, "Export failed for {Block}", block.Name);

                        continue;
                    }

                    result.Items.Add(block);
                }
                catch (Exception ex)
                {
                    // Catch only truly unexpected wrapper-level errors
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "Unexpected",
                        Item = block.Name,
                        Path = path,
                        Message = ex.Message
                    });
                    _logger?.LogError(ex, "Unexpected error at block {Block}", block.Name);
                    // continue with next block
                }
            }

            if (result.Issues.Count > 0)
            {
                _logger?.LogWarning("ExportBlocks completed with {IssueCount} issues out of {Total}. First issue: {FirstIssue}",
                    result.Issues.Count, list.Count(), result.Issues[0].Message);
                // Optionally: _logger?.LogDebug("All failures: {Failures}", string.Join("; ", failures));
            }
            else
            {
                _logger?.LogInformation("ExportBlocks completed successfully. Exported {Count} blocks.", result.Items.Count);
            }

            return result;
        }

        public IEnumerable<PlcBlock>? ExportBlocks(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            return ExportBlocksDetailed(softwarePath, exportPath, regexName, preservePath).Items;
        }

        public ProjectAnalysisResult<DbBlockDefinition> AnalyzeDbMembers(
            string softwarePath,
            string dbNameRegex = "",
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var snapshot = GetAnalysisSnapshot(softwarePath, "", snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<DbBlockDefinition>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.AnalyzeDbMembers(snapshot.SnapshotPath, dbNameRegex));

            return result;
        }

        public ProjectAnalysisResult<ParameterDbAnalysis> AnalyzeParameterDbs(
            string softwarePath,
            string dbNameRegex = "",
            string memberNameRegex = "",
            int maxMembers = 500,
            int maxUsagesPerMember = 5,
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var snapshot = GetAnalysisSnapshot(softwarePath, "", snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<ParameterDbAnalysis>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.AnalyzeParameterDbs(snapshot.SnapshotPath, dbNameRegex, memberNameRegex, maxMembers, maxUsagesPerMember));

            return result;
        }

        public ProjectAnalysisResult<TagUsage> FindTagUsages(
            string softwarePath,
            string tagPattern,
            int maxResults = 500,
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var snapshot = GetAnalysisSnapshot(softwarePath, "", snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<TagUsage>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.FindTagUsages(snapshot.SnapshotPath, tagPattern, maxResults));

            return result;
        }

        public ProjectAnalysisResult<AnalogChannel> AnalyzeAnalogInputs(
            string softwarePath,
            string blockNameRegex = "",
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^(AnalogInput|AirDataAcquisition)$" : blockNameRegex;
            var snapshot = GetAnalysisSnapshot(softwarePath, regex, snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<AnalogChannel>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.AnalyzeAnalogChannels(snapshot.SnapshotPath, "Convert_IW"));

            return result;
        }

        public ProjectAnalysisResult<AnalogChannel> AnalyzeAnalogOutputs(
            string softwarePath,
            string blockNameRegex = "",
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^AnalogOutput$" : blockNameRegex;
            var snapshot = GetAnalysisSnapshot(softwarePath, regex, snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<AnalogChannel>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.AnalyzeAnalogChannels(snapshot.SnapshotPath, "Convert_QW"));

            return result;
        }

        public ProjectAnalysisResult<AnalogChannelPatchPreview> PreviewAnalogInputPatches(
            string softwarePath,
            string changesJson,
            string blockNameRegex = "",
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^(AnalogInput|AirDataAcquisition)$" : blockNameRegex;
            var snapshot = GetAnalysisSnapshot(softwarePath, regex, snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<AnalogChannelPatchPreview>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.PreviewAnalogChannelPatches(snapshot.SnapshotPath, "Convert_IW", changesJson));

            return result;
        }

        public ProjectAnalysisResult<AnalogChannelPatchPreview> PreviewAnalogOutputPatches(
            string softwarePath,
            string changesJson,
            string blockNameRegex = "",
            string snapshotRoot = "",
            bool forceRefresh = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^AnalogOutput$" : blockNameRegex;
            var snapshot = GetAnalysisSnapshot(softwarePath, regex, snapshotRoot, forceRefresh);
            var result = CreateAnalysisResult<AnalogChannelPatchPreview>(snapshot);

            result.Items.AddRange(ProjectXmlAnalysis.PreviewAnalogChannelPatches(snapshot.SnapshotPath, "Convert_QW", changesJson));

            return result;
        }

        public AnalogPatchTransactionResult ApplyAnalogInputPatches(
            string softwarePath,
            string changesJson,
            string blockNameRegex = "",
            string groupPath = "",
            string snapshotRoot = "",
            bool apply = false,
            bool compileAfterImport = true,
            bool saveProject = false,
            bool rollbackOnFailure = true,
            bool rollbackAfterCompile = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^(AnalogInput|AirDataAcquisition)$" : blockNameRegex;
            return ApplyAnalogPatches(softwarePath, changesJson, regex, "Convert_IW", groupPath, snapshotRoot, apply, compileAfterImport, saveProject, rollbackOnFailure, rollbackAfterCompile);
        }

        public AnalogPatchTransactionResult ApplyAnalogOutputPatches(
            string softwarePath,
            string changesJson,
            string blockNameRegex = "",
            string groupPath = "",
            string snapshotRoot = "",
            bool apply = false,
            bool compileAfterImport = true,
            bool saveProject = false,
            bool rollbackOnFailure = true,
            bool rollbackAfterCompile = false)
        {
            var regex = string.IsNullOrWhiteSpace(blockNameRegex) ? "^AnalogOutput$" : blockNameRegex;
            return ApplyAnalogPatches(softwarePath, changesJson, regex, "Convert_QW", groupPath, snapshotRoot, apply, compileAfterImport, saveProject, rollbackOnFailure, rollbackAfterCompile);
        }

        private AnalogPatchTransactionResult ApplyAnalogPatches(
            string softwarePath,
            string changesJson,
            string blockRegex,
            string converterName,
            string groupPath,
            string snapshotRoot,
            bool apply,
            bool compileAfterImport,
            bool saveProject,
            bool rollbackOnFailure,
            bool rollbackAfterCompile)
        {
            var snapshot = apply
                ? ExportFreshAnalysisSnapshot(softwarePath, blockRegex, snapshotRoot)
                : GetAnalysisSnapshot(softwarePath, blockRegex, snapshotRoot, false);
            var result = new AnalogPatchTransactionResult
            {
                SnapshotPath = snapshot.SnapshotPath,
                ExportedBlockCount = snapshot.ExportedBlockCount,
                SnapshotReused = snapshot.Reused,
                SnapshotAgeMilliseconds = snapshot.AgeMilliseconds,
                ApplyRequested = apply
            };
            result.Issues.AddRange(snapshot.Issues);

            if (!apply)
            {
                result.Items.AddRange(ProjectXmlAnalysis.PreviewAnalogChannelPatches(snapshot.SnapshotPath, converterName, changesJson));
                return result;
            }

            var patchedPath = snapshot.SnapshotPath + "_patched";
            CopyDirectory(snapshot.SnapshotPath, patchedPath);
            result.PatchedPath = patchedPath;

            var patchResult = ProjectXmlAnalysis.PatchAnalogChannelPatches(patchedPath, converterName, changesJson);
            result.Items.AddRange(patchResult.Items);
            result.PatchedFiles.AddRange(patchResult.PatchedFiles);
            result.Issues.AddRange(patchResult.Issues);

            if (result.Issues.Count > 0)
            {
                return result;
            }

            foreach (var patchedFile in result.PatchedFiles.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (!TryImportBlock(softwarePath, groupPath, patchedFile, out var importError))
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "ImportFailed",
                        Item = Path.GetFileNameWithoutExtension(patchedFile),
                        Path = patchedFile,
                        Message = importError
                    });

                    if (rollbackOnFailure)
                    {
                        RollbackAnalogPatchFiles(softwarePath, groupPath, result);
                        CompileAnalogPatchRollback(softwarePath, result);
                    }

                    return result;
                }

                result.ImportedFiles.Add(patchedFile);
            }

            result.Applied = result.ImportedFiles.Count > 0;

            if (compileAfterImport)
            {
                var compileResult = CompileSoftware(softwarePath);
                result.CompileState = compileResult?.State.ToString();
                result.Compiled = compileResult != null && !string.Equals(result.CompileState, "Error", StringComparison.OrdinalIgnoreCase);

                if (!result.Compiled)
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "CompileFailed",
                        Item = softwarePath,
                        Message = $"Compile state: {result.CompileState ?? "<null>"}"
                    });

                    if (rollbackOnFailure)
                    {
                        RollbackAnalogPatchFiles(softwarePath, groupPath, result);
                        CompileAnalogPatchRollback(softwarePath, result);
                    }

                    return result;
                }
            }

            if (rollbackAfterCompile)
            {
                RollbackAnalogPatchFiles(softwarePath, groupPath, result);
                result.Compiled = CompileAnalogPatchRollback(softwarePath, result);
                result.Applied = false;
            }

            if (saveProject)
            {
                result.Saved = SaveProject();
                if (!result.Saved)
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "SaveFailed",
                        Item = softwarePath,
                        Message = "TIA Openness SaveProject returned false."
                    });
                }
            }

            return result;
        }

        private void RollbackAnalogPatchFiles(string softwarePath, string groupPath, AnalogPatchTransactionResult result)
        {
            if (string.IsNullOrWhiteSpace(result.SnapshotPath))
            {
                return;
            }

            foreach (var patchedFile in result.PatchedFiles.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var backupFile = Path.Combine(result.SnapshotPath, Path.GetFileName(patchedFile));
                if (!File.Exists(backupFile))
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "RollbackBackupMissing",
                        Item = Path.GetFileNameWithoutExtension(patchedFile),
                        Path = backupFile,
                        Message = "Backup XML file does not exist."
                    });
                    continue;
                }

                if (!TryImportBlock(softwarePath, groupPath, backupFile, out var rollbackError))
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "RollbackImportFailed",
                        Item = Path.GetFileNameWithoutExtension(backupFile),
                        Path = backupFile,
                        Message = rollbackError
                    });
                    continue;
                }

                result.RolledBack = true;
            }
        }

        private bool CompileAnalogPatchRollback(string softwarePath, AnalogPatchTransactionResult result)
        {
            if (!result.RolledBack)
            {
                return false;
            }

            var rollbackCompileResult = CompileSoftware(softwarePath);
            result.RollbackCompileState = rollbackCompileResult?.State.ToString();
            var rollbackCompiled = rollbackCompileResult != null
                && !string.Equals(result.RollbackCompileState, "Error", StringComparison.OrdinalIgnoreCase);

            if (!rollbackCompiled)
            {
                result.Issues.Add(new PortalIssue
                {
                    Code = "RollbackCompileFailed",
                    Item = softwarePath,
                    Message = $"Rollback compile state: {result.RollbackCompileState ?? "<null>"}"
                });
            }

            return rollbackCompiled;
        }

        private static ProjectAnalysisResult<T> CreateAnalysisResult<T>(AnalysisSnapshot snapshot)
        {
            var result = new ProjectAnalysisResult<T>
            {
                SnapshotPath = snapshot.SnapshotPath,
                ExportedBlockCount = snapshot.ExportedBlockCount,
                SnapshotReused = snapshot.Reused,
                SnapshotAgeMilliseconds = snapshot.AgeMilliseconds
            };

            result.Issues.AddRange(snapshot.Issues);

            return result;
        }

        private AnalysisSnapshot GetAnalysisSnapshot(string softwarePath, string blockRegex, string snapshotRoot, bool forceRefresh)
        {
            var normalizedRoot = GetAnalysisSnapshotRoot(snapshotRoot);
            var projectIdentity = GetCurrentProjectIdentity();
            var now = DateTime.UtcNow;

            lock (_analysisSnapshotLock)
            {
                if (!forceRefresh)
                {
                    var cached = _analysisSnapshots.Values
                        .Where(item =>
                            item.Revision == _analysisRevision
                            && string.Equals(item.ProjectIdentity, projectIdentity, StringComparison.OrdinalIgnoreCase)
                            && string.Equals(item.SoftwarePath, softwarePath, StringComparison.OrdinalIgnoreCase)
                            && string.Equals(item.SnapshotRoot, normalizedRoot, StringComparison.OrdinalIgnoreCase)
                            && Directory.Exists(item.SnapshotPath)
                            && (now - item.CreatedAtUtc).TotalSeconds <= AnalysisSnapshotCacheSeconds
                            && (string.Equals(item.BlockRegex, blockRegex, StringComparison.OrdinalIgnoreCase)
                                || string.IsNullOrWhiteSpace(item.BlockRegex)))
                        .OrderByDescending(item => string.Equals(item.BlockRegex, blockRegex, StringComparison.OrdinalIgnoreCase))
                        .ThenByDescending(item => item.CreatedAtUtc)
                        .FirstOrDefault();

                    if (cached != null)
                    {
                        return CloneAnalysisSnapshot(cached, true, now);
                    }
                }

                var fresh = ExportFreshAnalysisSnapshot(softwarePath, blockRegex, normalizedRoot);
                var key = BuildAnalysisSnapshotKey(projectIdentity, softwarePath, blockRegex, normalizedRoot);
                _analysisSnapshots[key] = fresh;
                RemoveExpiredAnalysisSnapshots(now);
                return CloneAnalysisSnapshot(fresh, false, now);
            }
        }

        private AnalysisSnapshot ExportFreshAnalysisSnapshot(string softwarePath, string blockRegex, string snapshotRoot)
        {
            var normalizedRoot = GetAnalysisSnapshotRoot(snapshotRoot);
            var snapshotPath = CreateAnalysisSnapshotPath(normalizedRoot);
            var exportResult = ExportBlocksDetailed(softwarePath, snapshotPath, blockRegex, false);
            var snapshot = new AnalysisSnapshot
            {
                ProjectIdentity = GetCurrentProjectIdentity(),
                SoftwarePath = softwarePath,
                BlockRegex = blockRegex,
                SnapshotRoot = normalizedRoot,
                SnapshotPath = snapshotPath,
                ExportedBlockCount = exportResult.Items.Count,
                Revision = _analysisRevision,
                CreatedAtUtc = DateTime.UtcNow
            };
            snapshot.Issues.AddRange(exportResult.Issues);
            return snapshot;
        }

        private static AnalysisSnapshot CloneAnalysisSnapshot(AnalysisSnapshot snapshot, bool reused, DateTime now)
        {
            var clone = new AnalysisSnapshot
            {
                ProjectIdentity = snapshot.ProjectIdentity,
                SoftwarePath = snapshot.SoftwarePath,
                BlockRegex = snapshot.BlockRegex,
                SnapshotRoot = snapshot.SnapshotRoot,
                SnapshotPath = snapshot.SnapshotPath,
                ExportedBlockCount = snapshot.ExportedBlockCount,
                Revision = snapshot.Revision,
                CreatedAtUtc = snapshot.CreatedAtUtc,
                Reused = reused,
                AgeMilliseconds = Math.Max(0, (long)(now - snapshot.CreatedAtUtc).TotalMilliseconds)
            };
            clone.Issues.AddRange(snapshot.Issues);
            return clone;
        }

        private string BuildAnalysisSnapshotKey(string projectIdentity, string softwarePath, string blockRegex, string snapshotRoot)
        {
            return $"{_analysisRevision}|{projectIdentity}|{softwarePath}|{blockRegex}|{snapshotRoot}";
        }

        private void RemoveExpiredAnalysisSnapshots(DateTime now)
        {
            var expiredKeys = _analysisSnapshots
                .Where(item =>
                    item.Value.Revision != _analysisRevision
                    || !Directory.Exists(item.Value.SnapshotPath)
                    || (now - item.Value.CreatedAtUtc).TotalSeconds > AnalysisSnapshotCacheSeconds)
                .Select(item => item.Key)
                .ToArray();

            foreach (var key in expiredKeys)
            {
                _analysisSnapshots.Remove(key);
            }
        }

        private void InvalidateAnalysisSnapshots(string reason)
        {
            lock (_analysisSnapshotLock)
            {
                _analysisRevision++;
                _analysisSnapshots.Clear();
            }

            _logger?.LogDebug("Analysis snapshot cache invalidated: {Reason}", reason);
        }

        private string GetCurrentProjectIdentity()
        {
            if (_project == null)
            {
                return "";
            }

            return $"{_project.Name}|{GetProjectFullPath(_project)}";
        }

        private static string GetProjectFullPath(ProjectBase project)
        {
            try
            {
                return project.Path?.FullName ?? "";
            }
            catch
            {
                return "";
            }
        }

        private static string GetAnalysisSnapshotRoot(string snapshotRoot)
        {
            return Path.GetFullPath(string.IsNullOrWhiteSpace(snapshotRoot)
                ? Path.Combine(Path.GetTempPath(), "TiaV20UnifiedMcpServer", "ProjectAnalysis")
                : snapshotRoot);
        }

        private static string CreateAnalysisSnapshotPath(string normalizedRoot)
        {
            var snapshotPath = Path.Combine(normalizedRoot, DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));
            Directory.CreateDirectory(snapshotPath);

            return snapshotPath;
        }

        private static void CopyDirectory(string sourceDirectory, string destinationDirectory)
        {
            Directory.CreateDirectory(destinationDirectory);

            foreach (var file in Directory.EnumerateFiles(sourceDirectory))
            {
                File.Copy(file, Path.Combine(destinationDirectory, Path.GetFileName(file)), true);
            }

            foreach (var directory in Directory.EnumerateDirectories(sourceDirectory))
            {
                CopyDirectory(directory, Path.Combine(destinationDirectory, Path.GetFileName(directory)));
            }
        }

        public PortalBatchResult<PlcType> ExportTypesDetailed(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            _logger?.LogInformation("Exporting types...");

            if (IsProjectNull())
            {
                throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
            }

            var result = new PortalBatchResult<PlcType>();

            PlcType[] list;

            try
            {
                list = GetTypes(softwarePath, regexName).ToArray();
                result.Total = list.Length;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to retrieve type list for {SoftwarePath}", softwarePath);
                throw new PortalException(PortalErrorCode.InvalidState, "Failed to retrieve type list", null, ex);
            }

            for (int i = 0; i < list.Count(); i++)
            {
                var type = list[i];

                _logger?.LogDebug("- Exporting type {Index}/{Total} : {Name}", i, list.Count(), type.Name);

                string path;
                if (preservePath)
                {
                    var groupPath = "";
                    if (type.Parent is PlcTypeGroup parentGroup)
                    {
                        groupPath = GetPlcTypeGroupPath(parentGroup);
                    }
                    path = Path.Combine(exportPath, groupPath.Replace('/', '\\'), $"{type.Name}.xml");
                }
                else
                {
                    path = Path.Combine(exportPath, $"{type.Name}.xml");
                }

                try
                {
                    if (!type.IsConsistent)
                    {
                        _logger?.LogWarning("Skipping inconsistent type {Name}", type.Name);
                        result.Inconsistent.Add(type);
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "Inconsistent",
                            Item = type.Name,
                            Path = GetTypePath(type),
                            Message = "TIA Portal does not export inconsistent PLC data types. Compile the PLC software first."
                        });
                        continue;
                    }

                    var dir = Path.GetDirectoryName(path);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    if (File.Exists(path))
                    {
                        try
                        {
                            File.Delete(path);
                        }
                        catch (Exception ioEx)
                        {
                            result.Issues.Add(new PortalIssue
                            {
                                Code = "FileDeleteFailed",
                                Item = type.Name,
                                Path = path,
                                Message = ioEx.Message
                            });
                            _logger?.LogError(ioEx, "Delete failed for {File}", path);
                            continue;
                        }
                    }

                    try
                    {
                        type.Export(new FileInfo(path), ExportOptions.None);
                    }
                    catch (Exception ex)
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "ExportFailed",
                            Item = type.Name,
                            Path = path,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, "Export failed for type {Type}", type.Name);
                        continue;
                    }

                    result.Items.Add(type);
                }
                catch (Exception ex)
                {
                    result.Issues.Add(new PortalIssue
                    {
                        Code = "Unexpected",
                        Item = type.Name,
                        Path = path,
                        Message = ex.Message
                    });
                    _logger?.LogError(ex, "Unexpected error at type {Type}", type.Name);
                }
            }

            if (result.Issues.Count > 0)
            {
                _logger?.LogWarning("ExportTypes completed with {IssueCount} issues out of {Total}. First issue: {FirstIssue}",
                    result.Issues.Count, list.Count(), result.Issues[0].Message);
            }
            else
            {
                _logger?.LogInformation("ExportTypes completed successfully. Exported {Count} types.", result.Items.Count);
            }

            return result;
        }

        public IEnumerable<PlcType>? ExportTypes(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            return ExportTypesDetailed(softwarePath, exportPath, regexName, preservePath).Items;
        }
        

        public bool ExportAsDocuments(string softwarePath, string blockPath, string exportPath, bool preservePath = false)
        {
            _logger?.LogInformation($"Exporting block as documents by path: {blockPath}");
            var success = false;
            try
            {
                if (IsProjectNull())
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
                }

                if (Engineering.TiaMajorVersion < 20)
                {
                    throw new PortalException(PortalErrorCode.InvalidState, "ExportAsDocuments requires TIA Portal V20 or newer");
                }

                
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    if (plcSoftware != null)
                    {
                        // Export code blocks as documents
                        // https://docs.tia.siemens.cloud/r/en-us/v20/creating-and-managing-blocks/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500/exporting-and-importing-blocks-in-simatic-sd-format-s7-1200-s7-1500

                        var groupPath = blockPath.Contains("/") ? blockPath.Substring(0, blockPath.LastIndexOf("/")) : string.Empty;
                        var blockName = blockPath.Contains("/") ? blockPath.Substring(blockPath.LastIndexOf("/") + 1) : blockPath;

                        var group = GetPlcBlockGroupByPath(softwarePath, groupPath);

                        //group?.Blocks.ForEach(b => Console.WriteLine($"Block: {b.Name}, Type: {b.GetType().Name}"));

                        // join exportPath and groupPath
                        if (!Directory.Exists(exportPath))
                        {
                            Directory.CreateDirectory(exportPath);
                        }

                        if (preservePath && !string.IsNullOrEmpty(groupPath))
                        {
                            exportPath = Path.Combine(exportPath, groupPath);

                            if (!Directory.Exists(exportPath))
                            {
                                Directory.CreateDirectory(exportPath);
                            }
                        }

                        try
                        {
                            // delete files s7dcl/s7res if already exists
                            var blockFiles7dclPath = Path.Combine(exportPath, $"{blockName}.s7dcl");
                            if (File.Exists(blockFiles7dclPath))
                            {
                                File.Delete(blockFiles7dclPath);
                            }
                            var blockFiles7resPath = Path.Combine(exportPath, $"{blockName}.s7res");
                            if (File.Exists(blockFiles7resPath))
                            {
                                File.Delete(blockFiles7resPath);
                            }

                            var result = group?.Blocks.Find(blockName)?.ExportAsDocuments(new DirectoryInfo(exportPath), blockName);

                            if (result != null && result.State == DocumentResultState.Success)
                            {
                                success = true;
                            }
                        }
                        catch (EngineeringNotSupportedException ex)
                        {
                            // The export or import of blocks with mixed programming languages is not possible
                            throw new PortalException(PortalErrorCode.ExportFailed, $"EngineeringNotSupportedException at block '{blockName}'. {ex.Message}", null, ex);
                        }
                        catch (Exception ex)
                        {
                            throw new PortalException(PortalErrorCode.ExportFailed, $"Exception at block '{blockName}'. {ex.Message}", null, ex);
                        }

                    }

                }


            }
            catch (Exception ex)
            {
                var pex = ex as PortalException ?? new PortalException(PortalErrorCode.ExportFailed, "Export failed", null, ex);

                pex.Data["softwarePath"] = softwarePath;
                pex.Data["blockPath"] = blockPath;
                pex.Data["exportPath"] = exportPath;

                _logger?.LogError(pex, "ExportAsDocuments failed for {SoftwarePath} {BlockPath} -> {ExportPath}", softwarePath, blockPath, exportPath);
                throw pex;
            }
            return success;
        }

        // TIA Portal V20 document export is useful but can be fragile on some LAD/mixed-language projects.
        public PortalBatchResult<PlcBlock> ExportBlocksAsDocumentsDetailed(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            _logger?.LogInformation("Exporting blocks as documents...");

            if (IsProjectNull())
            {
                throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
            }

            if (Engineering.TiaMajorVersion < 20)
            {
                throw new PortalException(PortalErrorCode.InvalidState, "ExportBlocksAsDocuments requires TIA Portal V20 or newer");
            }

            var batchResult = new PortalBatchResult<PlcBlock>();

            PlcBlock[] list;
            try
            {
                list = GetBlocks(softwarePath, regexName).ToArray();
                batchResult.Total = list.Length;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, $"Failed to retrieve block list for {softwarePath}");
                throw new PortalException(PortalErrorCode.InvalidState, "Failed to retrieve block list", null, ex);
            }

            string SafeBlockName(PlcBlock currentBlock, int currentIndex)
            {
                try
                {
                    return currentBlock.Name;
                }
                catch (Exception ex)
                {
                    return $"block[{currentIndex}] ({ex.GetType().Name})";
                }
            }

            string SafeBlockPath(PlcBlock currentBlock, string fallbackName)
            {
                try
                {
                    var path = GetBlockPath(currentBlock);
                    return string.IsNullOrWhiteSpace(path) ? fallbackName : path;
                }
                catch
                {
                    return fallbackName;
                }
            }

            for (int i = 0; i < list.Length; i++)
            {
                var block = list[i];
                var blockName = SafeBlockName(block, i);
                var blockPath = SafeBlockPath(block, blockName);

                _logger?.LogDebug($"- Exporting block as document {i}/{list.Length} : {blockName}");

                // Skip inconsistent blocks (TIA generally won’t export them)
                bool isConsistent;
                try
                {
                    isConsistent = block.IsConsistent;
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed reading consistency for {Block}", blockName);
                    batchResult.Issues.Add(new PortalIssue
                    {
                        Code = "MetadataReadFailed",
                        Item = blockName,
                        Path = blockPath,
                        Message = ex.Message
                    });
                    continue;
                }

                if (!isConsistent)
                {
                    _logger?.LogWarning($"Skipping inconsistent block {blockName}");
                    batchResult.Inconsistent.Add(block);
                    batchResult.Issues.Add(new PortalIssue
                    {
                        Code = "Inconsistent",
                        Item = blockName,
                        Path = blockPath,
                        Message = "TIA Portal does not export inconsistent blocks as documents. Compile the PLC software first."
                    });
                    continue;
                }

                // Determine base directory (preserve group path if requested)
                string targetDir = exportPath;
                if (preservePath)
                {
                    try
                    {
                        if (block.Parent is PlcBlockGroup parentGroup)
                        {
                            var groupPath = GetPlcBlockGroupPath(parentGroup);
                            if (!string.IsNullOrWhiteSpace(groupPath))
                            {
                                targetDir = Path.Combine(exportPath, groupPath.Replace('/', '\\'));
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "PathResolveFailed",
                            Item = blockName,
                            Path = blockPath,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, $"Path resolution failed for {blockName}");
                        continue;
                    }
                }

                try
                {
                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }
                }
                catch (Exception ex)
                {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "DirectoryCreateFailed",
                            Item = blockName,
                            Path = targetDir,
                            Message = ex.Message
                        });
                    _logger?.LogError(ex, $"Directory creation failed for {targetDir}");
                    continue;
                }

                var fileDcl = Path.Combine(targetDir, $"{blockName}.s7dcl");
                var fileRes = Path.Combine(targetDir, $"{blockName}.s7res");

                // Clean previous artifacts
                foreach (var f in new[] { fileDcl, fileRes })
                {
                    try
                    {
                        if (File.Exists(f))
                        {
                            File.Delete(f);
                        }
                    }
                    catch (Exception ex)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "FileDeleteFailed",
                            Item = blockName,
                            Path = f,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, $"Failed deleting existing file {f}");
                        // Continue anyway; export might overwrite.
                    }
                }

                try
                {
                    DocumentExportResult? documentResult = null;
                    try
                    {
                        documentResult = block.ExportAsDocuments(new DirectoryInfo(targetDir), blockName);
                    }
                    catch (EngineeringNotSupportedException ex)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "EngineeringNotSupported",
                            Item = blockName,
                            Path = targetDir,
                            Message = ex.Message
                        });
                        _logger?.LogWarning(ex, $"EngineeringNotSupported exporting {blockName}");
                        continue;
                    }
                    catch (LicenseNotFoundException ex)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "LicenseNotFound",
                            Item = blockName,
                            Path = targetDir,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, $"License issue exporting {blockName}");
                        continue;
                    }
                    catch (Exception ex)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "ExportFailed",
                            Item = blockName,
                            Path = targetDir,
                            Message = ex.Message
                        });
                        _logger?.LogError(ex, $"ExportAsDocuments failed for {blockName}");
                        continue;
                    }

                    if (documentResult == null)
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "NoResult",
                            Item = blockName,
                            Path = targetDir,
                            Message = "TIA Portal returned no document export result."
                        });
                        continue;
                    }

                    if (documentResult.State == DocumentResultState.Success)
                    {
                        batchResult.Items.Add(block);
                    }
                    else
                    {
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "ExportResult",
                            Item = blockName,
                            Path = targetDir,
                            Message = $"TIA Portal document export state: {documentResult.State}"
                        });
                    }
                }
                catch (Exception ex)
                {
                    batchResult.Issues.Add(new PortalIssue
                    {
                        Code = "Unexpected",
                        Item = blockName,
                        Path = targetDir,
                        Message = ex.Message
                    });
                    _logger?.LogError(ex, $"Unexpected wrapper error for {blockName}");
                }
            }

            if (batchResult.Issues.Count > 0)
            {
                _logger?.LogWarning("ExportBlocksAsDocuments completed with {IssueCount} issues out of {Total}. First issue: {FirstIssue}",
                    batchResult.Issues.Count, list.Count(), batchResult.Issues[0].Message);
                // Optional verbose list:
                // _logger?.LogDebug("All failures: {Failures}", string.Join("; ", failures));
            }
            else
            {
                _logger?.LogInformation("ExportBlocksAsDocuments completed successfully. Exported {Count} blocks.", batchResult.Items.Count);
            }

            return batchResult;
        }

        public IEnumerable<PlcBlock>? ExportBlocksAsDocuments(string softwarePath, string exportPath, string regexName = "", bool preservePath = false)
        {
            return ExportBlocksAsDocumentsDetailed(softwarePath, exportPath, regexName, preservePath).Items;
        }

        public PortalBatchResult<PlcBlock> GenerateBlocksFromSource(string softwarePath, string groupPath, string sourcePath, string externalSourceName, GenerateBlockOption option, bool deleteExternalSourceAfterGenerate = false)
        {
            _logger?.LogInformation("Generating blocks from external source: {SourcePath}", sourcePath);

            if (IsProjectNull())
            {
                throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
            }

            var result = new PortalBatchResult<PlcBlock>();
            var sourceFile = new FileInfo(sourcePath);
            if (!sourceFile.Exists)
            {
                throw new PortalException(PortalErrorCode.InvalidParams, $"Source file does not exist: {sourcePath}");
            }

            var sourceName = string.IsNullOrWhiteSpace(externalSourceName)
                ? Path.GetFileNameWithoutExtension(sourceFile.Name)
                : externalSourceName.Trim();

            if (string.IsNullOrWhiteSpace(sourceName))
            {
                throw new PortalException(PortalErrorCode.InvalidParams, "External source name is required.");
            }

            try
            {
                InvalidateAnalysisSnapshots("external source generation started");
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is not PlcSoftware plcSoftware)
                {
                    throw new PortalException(PortalErrorCode.NotFound, $"PLC software not found at '{softwarePath}'");
                }

                var externalSources = plcSoftware.ExternalSourceGroup.ExternalSources;
                var existingSource = externalSources.Find(sourceName);
                existingSource?.Delete();

                using var preparedSourceFile = PrepareExternalSourceFile(sourceFile);
                if (preparedSourceFile.IsTemporary)
                {
                    _logger?.LogInformation(
                        "Prepared external source as UTF-8 BOM temp file: {PreparedSourcePath} from {EncodingDescription}",
                        preparedSourceFile.File.FullName,
                        preparedSourceFile.EncodingDescription);
                }

                var source = externalSources.CreateFromFile(sourceName, preparedSourceFile.File.FullName);
                IList<IEngineeringObject> generatedObjects;

                if (string.IsNullOrWhiteSpace(groupPath))
                {
                    generatedObjects = source.GenerateBlocksFromSource(option);
                }
                else
                {
                    var group = GetPlcBlockGroupByPath(softwarePath, groupPath);
                    if (group == null)
                    {
                        throw new PortalException(PortalErrorCode.NotFound, $"PLC block group not found at '{groupPath}'");
                    }

                    if (group is not PlcBlockUserGroup userGroup)
                    {
                        throw new PortalException(PortalErrorCode.InvalidParams, "groupPath must be empty for the root block group or point to a user-created block group.");
                    }

                    generatedObjects = source.GenerateBlocksFromSource(userGroup, option);
                }

                result.Total = generatedObjects.Count;
                foreach (var item in generatedObjects)
                {
                    if (item is PlcBlock block)
                    {
                        result.Items.Add(block);
                    }
                    else
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "GeneratedObjectNotBlock",
                            Item = item?.ToString(),
                            Path = sourcePath,
                            Message = "TIA generated an object that is not a PLC block."
                        });
                    }
                }

                if (deleteExternalSourceAfterGenerate)
                {
                    try
                    {
                        source.Delete();
                    }
                    catch (Exception ex)
                    {
                        result.Issues.Add(new PortalIssue
                        {
                            Code = "ExternalSourceDeleteFailed",
                            Item = sourceName,
                            Path = sourcePath,
                            Message = ex.Message
                        });
                    }
                }

                return result;
            }
            catch (PortalException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new PortalException(PortalErrorCode.ExportFailed, $"Failed generating blocks from source '{sourcePath}'. {ex.Message}", null, ex);
            }
        }

        private PreparedExternalSourceFile PrepareExternalSourceFile(FileInfo sourceFile)
        {
            var bytes = File.ReadAllBytes(sourceFile.FullName);
            if (HasUtf8Bom(bytes))
            {
                return new PreparedExternalSourceFile(sourceFile, "utf-8-bom", isTemporary: false);
            }

            string text;
            string sourceEncoding;

            if (HasUtf16LittleEndianBom(bytes) || HasUtf16BigEndianBom(bytes))
            {
                using var reader = new StreamReader(sourceFile.FullName, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
                text = reader.ReadToEnd();
                sourceEncoding = reader.CurrentEncoding.WebName;
            }
            else
            {
                var strictUtf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
                try
                {
                    text = strictUtf8.GetString(bytes);
                    sourceEncoding = "utf-8-no-bom";
                }
                catch (DecoderFallbackException)
                {
                    text = Encoding.Default.GetString(bytes);
                    sourceEncoding = $"system-default-{Encoding.Default.WebName}";
                }
            }

            var tempDirectory = Path.Combine(Path.GetTempPath(), "TiaV20UnifiedMcpServer", "ExternalSources");
            Directory.CreateDirectory(tempDirectory);
            var tempPath = Path.Combine(
                tempDirectory,
                $"{Path.GetFileNameWithoutExtension(sourceFile.Name)}-{Guid.NewGuid():N}{sourceFile.Extension}");

            File.WriteAllText(tempPath, text, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
            return new PreparedExternalSourceFile(new FileInfo(tempPath), sourceEncoding, isTemporary: true);
        }

        private static bool HasUtf8Bom(byte[] bytes)
        {
            return bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
        }

        private static bool HasUtf16LittleEndianBom(byte[] bytes)
        {
            return bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE;
        }

        private static bool HasUtf16BigEndianBom(byte[] bytes)
        {
            return bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF;
        }

        private sealed class PreparedExternalSourceFile : IDisposable
        {
            public PreparedExternalSourceFile(FileInfo file, string encodingDescription, bool isTemporary)
            {
                File = file;
                EncodingDescription = encodingDescription;
                IsTemporary = isTemporary;
            }

            public FileInfo File { get; }
            public string EncodingDescription { get; }
            public bool IsTemporary { get; }

            public void Dispose()
            {
                if (!IsTemporary)
                {
                    return;
                }

                try
                {
                    if (File.Exists)
                    {
                        File.Delete();
                    }
                }
                catch
                {
                    // Temporary source cleanup is best-effort only.
                }
            }
        }

        public bool ImportFromDocuments(string softwarePath, string groupPath, string importPath, string fileNameWithoutExtension, ImportDocumentOptions option)
        {
            _logger?.LogInformation($"Importing block from documents: {fileNameWithoutExtension} in {importPath}");

            if (IsProjectNull())
            {
                return false;
            }

            if (Engineering.TiaMajorVersion < 20)
            {
                _logger?.LogWarning("ImportFromDocuments is only supported on TIA Portal V20 or newer");
                return false;
            }

            try
            {
                InvalidateAnalysisSnapshots("document block import started");
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    var group = GetPlcBlockGroupByPath(softwarePath, groupPath);
                    var dir = new DirectoryInfo(importPath);
                    if (!dir.Exists)
                    {
                        _logger?.LogWarning($"Import directory does not exist: {importPath}");
                        return false;
                    }

                    DocumentImportResult? result = null;
                    try
                    {
                        result = (group != null)
                            ? group.Blocks.ImportFromDocuments(dir, fileNameWithoutExtension, option)
                            : plcSoftware.BlockGroup.Blocks.ImportFromDocuments(dir, fileNameWithoutExtension, option);
                    }
                    catch (EngineeringNotSupportedException ex)
                    {
                        throw new PortalException(PortalErrorCode.ExportFailed, $"EngineeringNotSupportedException at file '{fileNameWithoutExtension}'. {ex.Message}", null, ex);
                    }

                    if (result != null && result.State == DocumentResultState.Success)
                    {
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error importing block from documents");
            }
            return false;
        }

        public PortalBatchResult<PlcBlock> ImportBlocksFromDocumentsDetailed(string softwarePath, string groupPath, string importPath, string regexName, ImportDocumentOptions option, bool preservePath = false)
        {
            _logger?.LogInformation($"Importing blocks from documents in {importPath} with regex '{regexName}'");

            if (IsProjectNull())
            {
                throw new PortalException(PortalErrorCode.InvalidState, "No project is open in TIA Portal");
            }

            if (Engineering.TiaMajorVersion < 20)
            {
                throw new PortalException(PortalErrorCode.InvalidState, "ImportBlocksFromDocuments requires TIA Portal V20 or newer");
            }

            var batchResult = new PortalBatchResult<PlcBlock>();

            try
            {
                InvalidateAnalysisSnapshots("batch document import started");
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    var group = GetPlcBlockGroupByPath(softwarePath, groupPath);
                    var dir = new DirectoryInfo(importPath);
                    if (!dir.Exists)
                    {
                        _logger?.LogWarning($"Import directory does not exist: {importPath}");
                        batchResult.Issues.Add(new PortalIssue
                        {
                            Code = "DirectoryNotFound",
                            Path = importPath,
                            Message = "Import directory does not exist."
                        });
                        return batchResult;
                    }

                    var rx = string.IsNullOrWhiteSpace(regexName)
                        ? null
                        : new Regex(regexName, RegexOptions.Compiled);

                    // Consider .s7dcl as the primary index; .s7res is optional supplemental
                    var files = dir.GetFiles("*.s7dcl", SearchOption.TopDirectoryOnly)
                        .Where(file => rx == null || rx.IsMatch(Path.GetFileNameWithoutExtension(file.Name)))
                        .ToArray();
                    batchResult.Total = files.Length;

                    foreach (var file in files)
                    {
                        var name = Path.GetFileNameWithoutExtension(file.Name);

                        try
                        {
                            var importResult = (group != null)
                                ? group.Blocks.ImportFromDocuments(dir, name, option)
                                : plcSoftware.BlockGroup.Blocks.ImportFromDocuments(dir, name, option);

                            if (importResult != null && importResult.State == DocumentResultState.Success && importResult.ImportedPlcBlocks != null)
                            {
                                foreach (var blk in importResult.ImportedPlcBlocks)
                                {
                                    if (blk != null)
                                    {
                                        batchResult.Items.Add(blk);
                                    }
                                }
                            }
                            else
                            {
                                batchResult.Issues.Add(new PortalIssue
                                {
                                    Code = "ImportResult",
                                    Item = name,
                                    Path = file.FullName,
                                    Message = importResult == null
                                        ? "TIA Portal returned no document import result."
                                        : $"TIA Portal document import state: {importResult.State}"
                                });
                            }
                        }
                        catch (EngineeringNotSupportedException ex)
                        {
                            batchResult.Issues.Add(new PortalIssue
                            {
                                Code = "EngineeringNotSupported",
                                Item = name,
                                Path = file.FullName,
                                Message = ex.Message
                            });
                        }
                        catch (Exception ex)
                        {
                            batchResult.Issues.Add(new PortalIssue
                            {
                                Code = "ImportFailed",
                                Item = name,
                                Path = file.FullName,
                                Message = ex.Message
                            });
                        }
                    }
                }
                else
                {
                    batchResult.Issues.Add(new PortalIssue
                    {
                        Code = "SoftwareNotFound",
                        Item = softwarePath,
                        Message = "PLC software path could not be resolved."
                    });
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error importing blocks from documents");
                batchResult.Issues.Add(new PortalIssue
                {
                    Code = "Unexpected",
                    Path = importPath,
                    Message = ex.Message
                });
            }

            return batchResult;
        }

        public IEnumerable<PlcBlock>? ImportBlocksFromDocuments(string softwarePath, string groupPath, string importPath, string regexName, ImportDocumentOptions option, bool preservePath = false)
        {
            return ImportBlocksFromDocumentsDetailed(softwarePath, groupPath, importPath, regexName, option, preservePath).Items;
        }

        #endregion

        #region private helper

        private bool IsPortalNull()
        {
            if (_portal == null)
            {
                _logger?.LogWarning("No TIA portal available.");

                return true;
            }

            return false;
        }

        private bool IsProjectNull()
        {
            if (_project == null)
            {
                _logger?.LogWarning("No TIA project available.");

                return true;
            }

            return false;
        }

        #region  GetTree ...

        private string GetTreePrefix(List<bool> ancestorStates, bool isLast)
        {
            var prefix = new StringBuilder();
            
            // Build prefix based on ancestor states
            for (int i = 0; i < ancestorStates.Count; i++)
            {
                prefix.Append(ancestorStates[i] ? "    " : "│   ");
            }
            
            // Add current level connector
            prefix.Append(isLast ? "└── " : "├── ");
            return prefix.ToString();
        }

        private void GetProjectTreeDevices(StringBuilder sb, DeviceComposition devices, List<bool> ancestorStates)
        {
            if (devices.Count == 0) return;
            
            // Check if this is the last main section
            var hasOtherSections = (_project?.DeviceGroups != null && _project.DeviceGroups.Count > 0) ||
                                  (_project?.UngroupedDevicesGroup != null);
            var isLastMainSection = !hasOtherSections;
            
            sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastMainSection)}Devices [Collection]");

            var deviceList = devices.ToList();
            var newAncestorStates = new List<bool>(ancestorStates) { isLastMainSection };
            
            for (int i = 0; i < deviceList.Count; i++)
            {
                var device = deviceList[i];
                var isLastDevice = i == deviceList.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastDevice)}{device.Name} [Device: {device.TypeIdentifier}]");

                if (device.DeviceItems != null && device.DeviceItems.Count > 0)
                {
                    GetProjectTreeDeviceItemsRecursive(sb, device.DeviceItems, new List<bool>(newAncestorStates) { isLastDevice });
                }
            }
        }

        private void GetProjectTreeGroups(StringBuilder sb, DeviceUserGroupComposition groups, List<bool> ancestorStates)
        {
            if (groups.Count == 0) return;
            
            var isLastMainSection = _project?.UngroupedDevicesGroup == null;
            
            sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastMainSection)}Groups [Collection]");

            var groupList = groups.ToList();
            var newAncestorStates = new List<bool>(ancestorStates) { isLastMainSection };
            
            for (int i = 0; i < groupList.Count; i++)
            {
                var group = groupList[i];
                var isLastGroup = i == groupList.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastGroup)}{group.Name} [Group]");

                var groupAncestorStates = new List<bool>(newAncestorStates) { isLastGroup };
                
                if (group.Devices != null && group.Devices.Count > 0)
                {
                    GetProjectTreeGroupDevices(sb, group.Devices, groupAncestorStates, group.Groups != null && group.Groups.Count > 0);
                }
                
                if (group.Groups != null && group.Groups.Count > 0)
                {
                    GetProjectTreeSubGroups(sb, group.Groups, groupAncestorStates);
                }
            }
        }
        
        private void GetProjectTreeGroupDevices(StringBuilder sb, DeviceComposition devices, List<bool> ancestorStates, bool hasSubGroups)
        {
            var deviceList = devices.ToList();
            
            for (int i = 0; i < deviceList.Count; i++)
            {
                var device = deviceList[i];
                var isLastDevice = i == deviceList.Count - 1 && !hasSubGroups;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastDevice)}{device.Name} [Device]");
                
                if (device.DeviceItems != null && device.DeviceItems.Count > 0)
                {
                    GetProjectTreeDeviceItemsRecursive(sb, device.DeviceItems, new List<bool>(ancestorStates) { isLastDevice });
                }
            }
        }
        
        private void GetProjectTreeSubGroups(StringBuilder sb, DeviceUserGroupComposition groups, List<bool> ancestorStates)
        {
            var groupList = groups.ToList();
            
            for (int i = 0; i < groupList.Count; i++)
            {
                var group = groupList[i];
                var isLastGroup = i == groupList.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastGroup)}{group.Name} [Subgroup]");
                
                var groupAncestorStates = new List<bool>(ancestorStates) { isLastGroup };
                
                if (group.Devices != null && group.Devices.Count > 0)
                {
                    GetProjectTreeGroupDevices(sb, group.Devices, groupAncestorStates, group.Groups != null && group.Groups.Count > 0);
                }
                
                if (group.Groups != null && group.Groups.Count > 0)
                {
                    GetProjectTreeSubGroups(sb, group.Groups, groupAncestorStates);
                }
            }
        }

        private void GetProjectTreeDeviceItemsRecursive(StringBuilder sb, DeviceItemComposition deviceItems, List<bool> ancestorStates)
        {
            var deviceItemsList = deviceItems.ToList();
            
            for (int i = 0; i < deviceItemsList.Count; i++)
            {
                var deviceItem = deviceItemsList[i];
                var isLastDeviceItem = i == deviceItemsList.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastDeviceItem)}{deviceItem.Name} [DeviceItem]");
                
                var itemAncestorStates = new List<bool>(ancestorStates) { isLastDeviceItem };
                
                // Get software first
                GetProjectTreeDeviceItemSoftware(sb, deviceItem, itemAncestorStates);
                
                // Then get items
                if (deviceItem.Items != null && deviceItem.Items.Count > 0)
                {
                    GetProjectTreeItems(sb, deviceItem.Items, itemAncestorStates, deviceItem.DeviceItems != null && deviceItem.DeviceItems.Count > 0);
                }
                
                // Finally get sub-device items
                if (deviceItem.DeviceItems != null && deviceItem.DeviceItems.Count > 0)
                {
                    GetProjectTreeDeviceItemsRecursive(sb, deviceItem.DeviceItems, itemAncestorStates);
                }
            }
        }
        
        private void GetProjectTreeItems(StringBuilder sb, DeviceItemAssociation items, List<bool> ancestorStates, bool hasSubDeviceItems)
        {
            var itemsList = items.ToList();
            
            for (int i = 0; i < itemsList.Count; i++)
            {
                var subItem = itemsList[i];
                var isLastItem = i == itemsList.Count - 1 && !hasSubDeviceItems;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastItem)}{subItem.Name} [Hardware Component]");
            }
        }


        private void GetProjectTreeDeviceItemSoftware(StringBuilder sb, DeviceItem deviceItem, List<bool> ancestorStates)
        {
            var softwareContainer = deviceItem.GetService<SoftwareContainer>();
            var hasSoftware = false;
            
            //PLC software
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                var hasOtherItems = (deviceItem.Items != null && deviceItem.Items.Count > 0) ||
                                   (deviceItem.DeviceItems != null && deviceItem.DeviceItems.Count > 0);
                sb.AppendLine($"{GetTreePrefix(ancestorStates, !hasOtherItems)}PlcSoftware: {plcSoftware.Name} [PLC Program]");
                hasSoftware = true;
            }

            //WinCC HMI software
            if (softwareContainer?.Software is HmiTarget hmiTarget)
            {
                var hasOtherItems = (deviceItem.Items != null && deviceItem.Items.Count > 0) ||
                                   (deviceItem.DeviceItems != null && deviceItem.DeviceItems.Count > 0);
                sb.AppendLine($"{GetTreePrefix(ancestorStates, !hasOtherItems && !hasSoftware)}HmiTarget: {hmiTarget.Name} [HMI Program]");
            }

            //Unified HMI software: dlls will only exist on TIA Portal V19 and newer.
            if (Engineering.TiaMajorVersion >= 19)
                TryGetUnifiedSoftware(sb, deviceItem, ancestorStates, softwareContainer, hasSoftware);
        }

        private bool TryGetUnifiedSoftware(StringBuilder sb, DeviceItem deviceItem, List<bool> ancestorStates, SoftwareContainer? softwareContainer, bool hasSoftware)
        {
            if (softwareContainer?.Software is HmiSoftware hmiSoftware)
            {
                var hasOtherItems = (deviceItem.Items != null && deviceItem.Items.Count > 0) ||
                                    (deviceItem.DeviceItems != null && deviceItem.DeviceItems.Count > 0);
                sb.AppendLine($"{GetTreePrefix(ancestorStates, !hasOtherItems && !hasSoftware)}HmiSoftware: {hmiSoftware.Name} [HMI Program]");
                hasSoftware = true;
            }

            return hasSoftware;
        }

        private void GetProjectTreeUngroupedDeviceGroup(StringBuilder sb, DeviceSystemGroup ungroupedDevicesGroup, List<bool> ancestorStates)
        {
            sb.AppendLine($"{GetTreePrefix(ancestorStates, true)}UngroupedDevicesGroup: {ungroupedDevicesGroup.Name} [System Group]");

            if (ungroupedDevicesGroup.Devices != null && ungroupedDevicesGroup.Devices.Count > 0)
            {
                var deviceList = ungroupedDevicesGroup.Devices.ToList();
                var newAncestorStates = new List<bool>(ancestorStates) { true };
                
                for (int i = 0; i < deviceList.Count; i++)
                {
                    var device = deviceList[i];
                    var isLastDevice = i == deviceList.Count - 1;
                    
                    sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastDevice)}{device.Name} [{device.TypeIdentifier}]");
                }
            }
        }

        #endregion

        #region GetSoftwareTree ...

        public string GetSoftwareTree(string softwarePath)
        {
            _logger?.LogInformation("Getting software tree for path: {SoftwarePath}", softwarePath);

            if (IsProjectNull())
            {
                return string.Empty;
            }

            try
            {
                var softwareContainer = GetSoftwareContainer(softwarePath);
                if (softwareContainer?.Software is PlcSoftware plcSoftware)
                {
                    StringBuilder sb = new();
                    sb.AppendLine($"{plcSoftware.Name} [PLC Software]");
                    
                    var ancestorStates = new List<bool>();
                    var sections = new List<Action>();
                    
                    var hasBlocks = plcSoftware.BlockGroup != null;
                    var hasTypes = plcSoftware.TypeGroup != null;
                    
                    // Add blocks section
                    if (hasBlocks)
                    {
                        var blockGroup = plcSoftware.BlockGroup;
                        if (blockGroup != null)
                        {
                            sections.Add(() => GetSoftwareTreeBlockGroup(sb, blockGroup, ancestorStates, "Program blocks", !hasTypes));
                        }
                    }
                    
                    // Add types section
                    if (hasTypes)
                    {
                        var typeGroup = plcSoftware.TypeGroup;
                        if (typeGroup != null)
                        {
                            sections.Add(() => GetSoftwareTreeTypeGroup(sb, typeGroup, ancestorStates, "PLC data types", true));
                        }
                    }
                    
                    
                    // Execute sections
                    for (int i = 0; i < sections.Count; i++)
                    {
                        sections[i]();
                    }

                    return sb.ToString();
                }
                else
                {
                    return $"No PLC software found at path: {softwarePath}";
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error getting software tree for {SoftwarePath}", softwarePath);
                return $"Error retrieving software tree: {ex.Message}";
            }
        }
        
        private void GetSoftwareTreeBlockGroup(StringBuilder sb, PlcBlockGroup blockGroup, List<bool> ancestorStates, string groupLabel, bool isLastSection)
        {
            sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastSection)}{groupLabel}"); // [Collection]
            var newAncestorStates = new List<bool>(ancestorStates) { isLastSection };
            
            // Get blocks in this group
            var blocks = blockGroup.Blocks.ToList();
            var subGroups = blockGroup.Groups.ToList();
            
            // First, add all blocks
            for (int i = 0; i < blocks.Count; i++)
            {
                var block = blocks[i];
                // Block is last only if it's the last block AND there are no subgroups following
                var isLastBlock = (i == blocks.Count - 1) && (subGroups.Count == 0);

                var blockTypeName = new[] { "ArrayDB", "GlobalDB", "InstanceDB" }.Contains(block.GetType().Name)
                    ? "DB"
                    : block.GetType().Name;

                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastBlock)}{block.Name} [{blockTypeName}{block.Number}, {block.ProgrammingLanguage}]");
            }
            
            // Then, add all subgroups recursively
            for (int i = 0; i < subGroups.Count; i++)
            {
                var subGroup = subGroups[i];
                var isLastGroup = i == subGroups.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastGroup)}{subGroup.Name}"); // [Block Group]

                var groupAncestorStates = new List<bool>(newAncestorStates) { isLastGroup };
                GetSoftwareTreeBlockGroupRecursive(sb, subGroup, groupAncestorStates);
            }
        }
        
        private void GetSoftwareTreeBlockGroupRecursive(StringBuilder sb, PlcBlockGroup blockGroup, List<bool> ancestorStates)
        {
            // Get blocks in this group
            var blocks = blockGroup.Blocks.ToList();
            var subGroups = blockGroup.Groups.ToList();
            
            // First, add all blocks
            for (int i = 0; i < blocks.Count; i++)
            {
                var block = blocks[i];
                // Block is last only if it's the last block AND there are no subgroups following
                var isLastBlock = (i == blocks.Count - 1) && (subGroups.Count == 0);

                var blockTypeName = new[] { "ArrayDB", "GlobalDB", "InstanceDB" }.Contains(block.GetType().Name)
                    ? "DB"
                    : block.GetType().Name;

                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastBlock)}{block.Name} [{blockTypeName}{block.Number}, {block.ProgrammingLanguage}]");
            }
            
            // Then, add all subgroups recursively
            for (int i = 0; i < subGroups.Count; i++)
            {
                var subGroup = subGroups[i];
                var isLastGroup = i == subGroups.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastGroup)}{subGroup.Name}"); // [Block Group]

                var groupAncestorStates = new List<bool>(ancestorStates) { isLastGroup };
                GetSoftwareTreeBlockGroupRecursive(sb, subGroup, groupAncestorStates);
            }
        }
        
        private void GetSoftwareTreeTypeGroup(StringBuilder sb, PlcTypeGroup typeGroup, List<bool> ancestorStates, string groupLabel, bool isLastSection)
        {
            
            sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastSection)}{groupLabel}"); // [Collection]
            var newAncestorStates = new List<bool>(ancestorStates) { isLastSection };
            
            // Get types in this group
            var types = typeGroup.Types.ToList();
            var subGroups = typeGroup.Groups.ToList();
            
            // First, add all types
            for (int i = 0; i < types.Count; i++)
            {
                var type = types[i];
                // Type is last only if it's the last type AND there are no subgroups following
                var isLastType = (i == types.Count - 1) && (subGroups.Count == 0);

                var typeTypeName = type.GetType().Name;
                typeTypeName = typeTypeName=="PlcStruct" ? "UDT": typeTypeName;

                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastType)}{type.Name} [{typeTypeName}]");
            }
            
            // Then, add all subgroups recursively
            for (int i = 0; i < subGroups.Count; i++)
            {
                var subGroup = subGroups[i];
                var isLastGroup = i == subGroups.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(newAncestorStates, isLastGroup)}{subGroup.Name}"); // [Type Group]

                var groupAncestorStates = new List<bool>(newAncestorStates) { isLastGroup };
                GetSoftwareTreeTypeGroupRecursive(sb, subGroup, groupAncestorStates);
            }
        }
        
        private void GetSoftwareTreeTypeGroupRecursive(StringBuilder sb, PlcTypeGroup typeGroup, List<bool> ancestorStates)
        {
            // Get types in this group
            var types = typeGroup.Types.ToList();
            var subGroups = typeGroup.Groups.ToList();
            
            // First, add all types
            for (int i = 0; i < types.Count; i++)
            {
                var type = types[i];
                // Type is last only if it's the last type AND there are no subgroups following
                var isLastType = (i == types.Count - 1) && (subGroups.Count == 0);

                var typeTypeName = type.GetType().Name;
                typeTypeName = typeTypeName == "PlcStruct" ? "UDT" : typeTypeName;

                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastType)}{type.Name} [{typeTypeName}]");
            }
            
            // Then, add all subgroups recursively
            for (int i = 0; i < subGroups.Count; i++)
            {
                var subGroup = subGroups[i];
                var isLastGroup = i == subGroups.Count - 1;
                
                sb.AppendLine($"{GetTreePrefix(ancestorStates, isLastGroup)}{subGroup.Name}"); // [Type Group]

                var groupAncestorStates = new List<bool>(ancestorStates) { isLastGroup };
                GetSoftwareTreeTypeGroupRecursive(sb, subGroup, groupAncestorStates);
            }
        }

        #endregion

        #region GetSoftwareContainer ...

        private SoftwareContainer? GetSoftwareContainer(string softwarePath)
        {
            if (_project == null)
            {
                return null;
            }

            string[] pathSegments = softwarePath.Split('/');
            int index = 0;

            if (index >= pathSegments.Length)
                return null;

            string segment = pathSegments[index];
            SoftwareContainer? softwareContainer = null;

            // in Devices
            if (_project.Devices != null)
            {
                softwareContainer = GetSoftwareContainerInDevices(_project.Devices, pathSegments, index);
                if (softwareContainer != null)
                {
                    return softwareContainer;
                }
            }

            // in Groups
            if (_project.DeviceGroups != null)
            {
                softwareContainer = GetSoftwareContainerInGroups(_project.DeviceGroups, pathSegments, index);
                if (softwareContainer != null)
                {
                    return softwareContainer;
                }
            }

            return null;
        }

        private SoftwareContainer? GetSoftwareContainerInDevices(DeviceComposition devices, string[] pathSegments, int index)
        {

            if (index >= pathSegments.Length)
                return null;

            string segment = pathSegments[index];
            string nextSegment = index + 1 < pathSegments.Length ? pathSegments[index + 1] : string.Empty;

            if (devices != null)
            {
                SoftwareContainer? softwareContainer = null;
                Device? device = null;
                DeviceItem? deviceItem = null;

                // a pc based plc has a Device.Name = 'PC-System_1' or something like that, which is visible in the TIA-Portal IDE
                // use segment to find device
                device = devices.FirstOrDefault(d => d.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
                if (device != null)
                {
                    // then use next segment to find device item
                    deviceItem = device.DeviceItems.FirstOrDefault(di => di.Name.Equals(nextSegment, StringComparison.OrdinalIgnoreCase));
                    // but here we use next segment to find device item
                    softwareContainer = GetSoftwareContainerInDeviceItem(deviceItem, pathSegments, index + 1);
                    if (softwareContainer != null)
                    {
                        return softwareContainer;
                    }
                }

                // a hardware plc has a Device.Name = 'S7-1500/ET200MP-Station_1' or something like that, which is not visible in the TIA-Portal IDE
                // ignored segment for Device.Name and use it for DeviceItem.Name
                deviceItem = devices
                    .SelectMany(d => d.DeviceItems)
                    .FirstOrDefault(di => di.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
                if (deviceItem != null)
                {
                    return GetSoftwareContainerInDeviceItem(deviceItem, pathSegments, index);
                }

            }

            return null;
        }

        private SoftwareContainer? GetSoftwareContainerInGroups(DeviceUserGroupComposition groups, string[] pathSegments, int index)
        {
            if (index >= pathSegments.Length)
                return null;

            string segment = pathSegments[index];
            SoftwareContainer? softwareContainer = null;

            if (groups != null)
            {
                var group = groups.FirstOrDefault(g => g.Name.Equals(segment));
                if (group != null)
                {
                    // when segment matched
                    softwareContainer = GetSoftwareContainerInDevices(group.Devices, pathSegments, index + 1);
                    if (softwareContainer != null)
                    {
                        return softwareContainer;
                    }

                    return GetSoftwareContainerInGroups(group.Groups, pathSegments, index + 1);
                }
            }

            return null;
        }

        private SoftwareContainer? GetSoftwareContainerInDeviceItem(DeviceItem deviceItem, string[] pathSegments, int index)
        {
            if (deviceItem != null)
            {
                // when segment matched
                if (index == pathSegments.Length - 1)
                {
                    // get from DeviceItem
                    var softwareContainer = deviceItem.GetService<SoftwareContainer>();
                    if (softwareContainer != null)
                    {
                        return softwareContainer;
                    }
                }
            }

            return null;
        }

        #endregion

        #region Get...ByPath

        private Device? GetDeviceByPath(string devicePath)
        {
            if (_project?.Devices == null || string.IsNullOrWhiteSpace(devicePath))
                return null;

            var pathSegments = devicePath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (pathSegments.Length == 0)
            {
                return null;
            }

            // Try top-level device first
            if (pathSegments.Length == 1)
            {
                return _project.Devices.FirstOrDefault(d => d.Name.Equals(pathSegments[0], StringComparison.OrdinalIgnoreCase));
            }

            // Traverse device groups
            DeviceUserGroupComposition? groups = _project.DeviceGroups;
            DeviceUserGroup? group = groups?.FirstOrDefault(g => g.Name.Equals(pathSegments[0], StringComparison.OrdinalIgnoreCase));

            if (group == null)
            {
                return null;
            }

            for (int i = 1; i < pathSegments.Length; i++)
            {
                // Try to find device in current group
                var device = group.Devices.FirstOrDefault(d => d.Name.Equals(pathSegments[i], StringComparison.OrdinalIgnoreCase));
                if (device != null)
                {
                    return device;
                }

                // Try to find subgroup
                group = group.Groups.FirstOrDefault(g => g.Name.Equals(pathSegments[i], StringComparison.OrdinalIgnoreCase));
                if (group == null)
                {
                    break;
                }
            }

            return null;
        }

        private DeviceItem? GetDeviceItemByPath(string deviceItemPath)
        {
            if (_project == null || _project.Devices == null)
            {
                return null;
            }

            // Split the device path by '/' to get each device name  
            var pathSegments = deviceItemPath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);

            DeviceItem? deviceItem = null;

            // initial devices and groups
            var devices = _project.Devices;
            var groups = _project.DeviceGroups;

            for (int index = 0; index < pathSegments.Length; index++)
            {
                deviceItem = GetDeviceItemFromDevice(pathSegments, devices, index);

                if (deviceItem == null)
                {
                    // search in groups
                    var group = groups?.FirstOrDefault(g => g.Name.Equals(pathSegments[index], StringComparison.OrdinalIgnoreCase));
                    if (group != null)
                    {
                        devices = group.Devices;
                        if (devices != null)
                        {
                            deviceItem = GetDeviceItemFromDevice(pathSegments, devices, index + 1);
                        }

                        if (deviceItem != null)
                        {
                            return deviceItem;
                        }

                        // not found, but on the path
                        groups = group.Groups;
                        devices = group.Devices;
                    }
                }
                else
                {
                    return deviceItem;
                }
            }

            return deviceItem;
        }

        private static DeviceItem? GetDeviceItemFromDevice(string[] pathSegments, DeviceComposition? devices, int index)
        {
            string segment = pathSegments[index];
            string nextSegment = index + 1 < pathSegments.Length ? pathSegments[index + 1] : string.Empty;

            DeviceItem? deviceItem = null;

            // a pc based plc has a Device.Name = 'PC-System_1' or something like that, which is visible in the TIA-Portal IDE
            // use segment to find device
            var device = devices.FirstOrDefault(d => d.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
            if (device != null)
            {
                // then use next segment to find device item
                deviceItem = device.DeviceItems.FirstOrDefault(di => di.Name.Equals(nextSegment, StringComparison.OrdinalIgnoreCase));

            }

            // a hardware plc has a Device.Name = 'S7-1500/ET200MP-Station_1' or something like that, which is not visible in the TIA-Portal IDE
            if (device == null)
            {
                deviceItem = devices
                .SelectMany(d => d.DeviceItems)
                .FirstOrDefault(di => di.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
            }

            return deviceItem;
        }

        private PlcBlockGroup? GetPlcBlockGroupByPath(string softwarePath, string groupPath)
        {
            if (_project == null)
            {
                return null;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                if (plcSoftware?.BlockGroup == null)
                {
                    return null;
                }


                // Split the path by '/' to get each group name
                var groupNames = groupPath.Split(['/'], StringSplitOptions.RemoveEmptyEntries);

                PlcBlockGroup? currentGroup = plcSoftware.BlockGroup;

                foreach (var groupName in groupNames)
                {
                    currentGroup = currentGroup.Groups.FirstOrDefault(g => g.Name.Equals(groupName, StringComparison.OrdinalIgnoreCase));

                    if (currentGroup == null)
                    {
                        return null;
                    }
                }

                return currentGroup;
            }

            return null;
        }

        private PlcTypeGroup? GetPlcTypeGroupByPath(string softwarePath, string groupPath)
        {
            if (_project == null)
            {
                return null;
            }

            var softwareContainer = GetSoftwareContainer(softwarePath);
            if (softwareContainer?.Software is PlcSoftware plcSoftware)
            {
                if (plcSoftware?.TypeGroup == null)
                {
                    return null;
                }

                var groupNames = groupPath.Split(['/'], StringSplitOptions.RemoveEmptyEntries);

                PlcTypeGroup? currentGroup = plcSoftware.TypeGroup;

                foreach (var groupName in groupNames)
                {
                    currentGroup = currentGroup.Groups.FirstOrDefault(g => g.Name.Equals(groupName, StringComparison.OrdinalIgnoreCase));

                    if (currentGroup == null)
                    {
                        return null;
                    }
                }

                return currentGroup;
            }

            return null;
        }

        private string GetPlcBlockGroupPath(PlcBlockGroup group)
        {
            if (group == null)
            {
                return string.Empty;
            }

            PlcBlockGroup? nullableGroup = group;
            var path = group.Name;

            while (nullableGroup != null && nullableGroup.Parent != null)
            {
                try
                {
                    //group = (PlcBlockGroup) group.Parent;
                    if (group is PlcBlockSystemGroup systemGroup)
                    {
                        // do not get parent for system group
                        break;
                    }

                    nullableGroup = nullableGroup.Parent as PlcBlockGroup;
                }
                catch (Exception)
                {
                    // Handle any exceptions that may occur while accessing the parent
                    break;
                }

                if (nullableGroup != null)
                {
                    path = $"{nullableGroup.Name}/{path}";
                }
            }

            return path;
        }

        private string GetPlcTagTableGroupPath(PlcTagTableGroup group)
        {
            if (group == null)
            {
                return string.Empty;
            }

            PlcTagTableGroup? nullableGroup = group;
            var path = group.Name;

            while (nullableGroup != null && nullableGroup.Parent != null)
            {
                try
                {
                    if (nullableGroup is PlcTagTableSystemGroup)
                    {
                        break;
                    }

                    nullableGroup = nullableGroup.Parent as PlcTagTableGroup;
                }
                catch (Exception)
                {
                    break;
                }

                if (nullableGroup != null)
                {
                    path = $"{nullableGroup.Name}/{path}";
                }
            }

            return path;
        }

        private string GetPlcTypeGroupPath(PlcTypeGroup group)
        {
            if (group == null)
            {
                return string.Empty;
            }

            PlcTypeGroup? nullableGroup = group;
            var path = group.Name;

            while (nullableGroup != null && nullableGroup.Parent != null)
            {
                try
                {
                    //group = (PlcTypeGroup) group.Parent;
                    if (group is PlcTypeSystemGroup systemGroup)
                    {
                        // do not get parent for system group
                        break;
                    }

                    nullableGroup = nullableGroup.Parent as PlcTypeGroup;
                }
                catch (Exception)
                {
                    // Handle any exceptions that may occur while accessing the parent
                    break;
                }

                if (nullableGroup != null)
                {
                    path = $"{nullableGroup.Name}/{path}";
                }
            }

            return path;
        }

        #endregion

        #region GetRecursive ...

        private bool GetDevicesRecursive(DeviceUserGroup group, List<Device> list, string regexName = "")
        {
            var anySuccess = false;

            foreach (var composition in group.Devices)
            {
                if (composition is Device device)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(regexName) && !Regex.IsMatch(device.Name, regexName, RegexOptions.IgnoreCase))
                        {
                            continue; // Skip this device if it doesn't match the pattern
                        }
                    }
                    catch (Exception)
                    {
                        // Invalid regex pattern, skip this device
                        continue;
                    }

                    list.Add(device);

                    anySuccess = true;
                }
            }

            foreach (var subgroup in group.Groups)
            {
                anySuccess = GetDevicesRecursive(subgroup, list, regexName);
            }

            return anySuccess;
        }

        private void GetTagTablesRecursive(PlcTagTableGroup group, List<PlcTagTable> list)
        {
            foreach (PlcTagTable table in group.TagTables)
            {
                list.Add(table);
            }

            foreach (PlcTagTableGroup subgroup in group.Groups)
            {
                GetTagTablesRecursive(subgroup, list);
            }
        }

        private bool GetBlocksRecursive(PlcBlockGroup group, List<PlcBlock> list, string regexName = "")
        {
            var anySuccess = false;

            foreach (var composition in group.Blocks)
            {
                if (composition is PlcBlock block)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(regexName) && !Regex.IsMatch(block.Name, regexName, RegexOptions.IgnoreCase))
                        {
                            continue; // Skip this block if it doesn't match the pattern
                        }
                    }
                    catch (Exception)
                    {
                        // Invalid regex pattern, skip this block
                        continue;
                    }

                    list.Add(block);

                    anySuccess = true;
                }
            }

            foreach (var subgroup in group.Groups)
            {
                anySuccess = GetBlocksRecursive(subgroup, list, regexName);
            }

            return anySuccess;
        }

        private bool GetTypesRecursive(PlcTypeGroup group, List<PlcType> list, string regexName = "")
        {
            var anySuccess = false;

            foreach (var composition in group.Types)
            {
                if (composition is PlcType type)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(regexName) && !Regex.IsMatch(type.Name, regexName, RegexOptions.IgnoreCase))
                        {
                            continue; // Skip this block if it doesn't match the pattern
                        }
                    }
                    catch (Exception)
                    {
                        // Invalid regex pattern, skip this block
                        continue;
                    }

                    list.Add(type);

                    anySuccess = true;
                }

            }

            foreach (PlcTypeGroup subgroup in group.Groups)
            {
                anySuccess = GetTypesRecursive(subgroup, list, regexName);
            }

            return anySuccess;
        }

        #endregion

        #endregion

    }


}
