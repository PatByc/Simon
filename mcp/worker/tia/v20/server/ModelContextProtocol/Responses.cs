using Siemens.Engineering;
using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using TiaMcpServer.Siemens;

namespace TiaMcpServer.ModelContextProtocol
{
    public class ResponseMessage
    {
        public string? Message { get; set; }
        public JsonObject? Meta { get; set; }
    }

    public class ResponseAttributes : ResponseMessage
    {
        public IEnumerable<ResponseAttributeInfo>? Attributes { get; set; }
    }

    public class ResponseAttributeInfo
    {
        public string? Name { get; set; }
        public string? Value { get; set; }
        public string? ValueType { get; set; }
        public string? AccessMode { get; set; }
    }

    public class ResponseSoftwareInfo : ResponseAttributes
    {
        public string? Name { get; set; }
        public string? Path { get; set; }
        public string? Description { get; set; }
    }

    public class ResponseDeviceInfo : ResponseAttributes
    {
        public string? Name { get; set; }
        public string? Path { get; set; }
        public string? Description { get; set; }
    }

    public class ResponseDeviceItemInfo : ResponseAttributes
    {
        public string? Name { get; set; }
        public string? Path { get; set; }
        public string? Description { get; set; }
    }

    public class ResponseBlockInfo : ResponseAttributes
    {
        public string? Path { get; set; }
        public string? TypeName { get; set; }
        public string? Name { get; set; }
        public string? Namespace { get; set; }
        public string? ProgrammingLanguage { get; set; }
        public string? MemoryLayout { get; set; }
        public bool? IsConsistent { get; set; }
        public string? HeaderName { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public bool? IsKnowHowProtected { get; set; }
        public string? Description { get; set; }
    }
    public class ResponseBlocksWithHierarchy : ResponseMessage
    {
        public BlockGroupInfo? Root { get; set; }
    }

    public class ResponseTypeInfo : ResponseAttributes
    {
        public string? Path { get; set; }
        public string? Name { get; set; }
        public string? TypeName { get; set; }
        public string? Namespace { get; set; }
        public bool? IsConsistent { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public bool? IsKnowHowProtected { get; set; }
        public string? Description { get; set; }
    }

    public class ResponseProjectInfo : ResponseAttributes
    {
        public string? Path { get; set; }
        public string? Name { get; set; }
    }

    public class ResponseIssue
    {
        public string? Code { get; set; }
        public string? Item { get; set; }
        public string? Path { get; set; }
        public string? Message { get; set; }
    }

    public class ResponsePortalProcesses : ResponseMessage
    {
        public IEnumerable<ResponsePortalProcessInfo>? Processes { get; set; }
    }

    public class ResponsePortalProcessInfo
    {
        public int Id { get; set; }
        public bool HasProject { get; set; }
        public DateTime AcquisitionTime { get; set; }
        public DateTime? ProcessStartTime { get; set; }
    }

    public class ResponseConnect : ResponseMessage
    {
    }

    public class ResponseDisconnect : ResponseMessage
    {
    }

    public class ResponseState : ResponseMessage
    {
        public bool? IsConnected { get; set; }
        public string? Project { get; set; }
    }

    public class ResponseGetProjects : ResponseMessage
    {
        public IEnumerable<ResponseProjectInfo>? Items { get; set; }
    }

    public class ResponseOpenProject : ResponseMessage
    {
    }

    public class ResponseSaveProject : ResponseMessage
    {
    }

    public class ResponseSaveAsProject : ResponseMessage
    {
    }

    public class ResponseCloseProject : ResponseMessage
    {
    }

    public class ResponseTree : ResponseMessage
    {
        public string? Tree { get; set; }
    }

    public class ResponseProjectTree : ResponseMessage
    {
        public string? Tree { get; set; }
    }

    public class ResponseSoftwareTree : ResponseMessage
    {
        public string? Tree { get; set; }
    }

    public class ResponseDevices : ResponseMessage
    {
        public IEnumerable<ResponseDeviceInfo>? Items { get; set; }
    }
    
    public class ResponseCompileSoftware : ResponseMessage
    {
    }
    
    public class ResponseBlocks : ResponseMessage
    {
        public IEnumerable<ResponseBlockInfo>? Items { get; set; }
    }

    public class ResponseTagTableInfo
    {
        public string? Path { get; set; }
        public string? Name { get; set; }
        public bool IsDefault { get; set; }
        public DateTime? ModifiedDate { get; set; }
        public int TagCount { get; set; }
    }

    public class ResponseTagTables : ResponseMessage
    {
        public IEnumerable<ResponseTagTableInfo>? Items { get; set; }
        public int TotalCount { get; set; }
        public bool Truncated { get; set; }
    }

    public class ResponsePlcTagInfo
    {
        public string? Path { get; set; }
        public string? TablePath { get; set; }
        public string? Name { get; set; }
        public string? DataType { get; set; }
        public string? LogicalAddress { get; set; }
        public string? Comment { get; set; }
    }

    public class ResponsePlcTags : ResponseMessage
    {
        public IEnumerable<ResponsePlcTagInfo>? Items { get; set; }
        public int TotalCount { get; set; }
        public bool Truncated { get; set; }
    }

    public class ResponseExportBlock : ResponseMessage
    {
    }

    public class ResponseImportBlock : ResponseMessage
    {
    }

    public class ResponseExportBlocks : ResponseMessage
    {
        public IEnumerable<ResponseBlockInfo>? Items { get; set; }
        public IEnumerable<ResponseBlockInfo>? Inconsistent { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public class ResponseTypes : ResponseMessage
    {
        public IEnumerable<ResponseTypeInfo>? Items { get; set; }
    }

    public class ResponseExportType : ResponseMessage
    {
    }

    public class ResponseImportType : ResponseMessage
    {
    }

    public class ResponseExportTypes : ResponseMessage
    {
        public IEnumerable<ResponseTypeInfo>? Items { get; set; }
        public IEnumerable<ResponseTypeInfo>? Inconsistent { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public class ResponseExportAsDocuments : ResponseMessage
    {
    }

    public class ResponseExportBlocksAsDocuments : ResponseMessage
    {
        public IEnumerable<ResponseBlockInfo>? Items { get; set; }
        public IEnumerable<ResponseBlockInfo>? Inconsistent { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public class ResponseImportFromDocuments : ResponseMessage
    {
    }

    public class ResponseGenerateBlocksFromSource : ResponseMessage
    {
        public IEnumerable<ResponseBlockInfo>? Items { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public class ResponseImportBlocksFromDocuments : ResponseMessage
    {
        public IEnumerable<ResponseBlockInfo>? Items { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public abstract class ResponseProjectAnalysis : ResponseMessage
    {
        public string? SnapshotPath { get; set; }
        public int ExportedBlockCount { get; set; }
        public bool SnapshotReused { get; set; }
        public long SnapshotAgeMilliseconds { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }

    public class ResponseDbMembers : ResponseProjectAnalysis
    {
        public IEnumerable<DbBlockDefinition>? Items { get; set; }
    }

    public class ResponseParameterDbs : ResponseProjectAnalysis
    {
        public IEnumerable<ParameterDbAnalysis>? Items { get; set; }
    }

    public class ResponseTagUsages : ResponseProjectAnalysis
    {
        public IEnumerable<TagUsage>? Items { get; set; }
    }

    public class ResponseAnalogChannels : ResponseProjectAnalysis
    {
        public IEnumerable<AnalogChannel>? Items { get; set; }
    }

    public class ResponseAnalogPatchPreview : ResponseProjectAnalysis
    {
        public IEnumerable<AnalogChannelPatchPreview>? Items { get; set; }
    }

    public class ResponseAnalogPatchApply : ResponseMessage
    {
        public string? SnapshotPath { get; set; }
        public string? PatchedPath { get; set; }
        public int ExportedBlockCount { get; set; }
        public bool SnapshotReused { get; set; }
        public long SnapshotAgeMilliseconds { get; set; }
        public bool ApplyRequested { get; set; }
        public bool Applied { get; set; }
        public bool Compiled { get; set; }
        public bool Saved { get; set; }
        public bool RolledBack { get; set; }
        public string? CompileState { get; set; }
        public string? RollbackCompileState { get; set; }
        public IEnumerable<string>? ImportedFiles { get; set; }
        public IEnumerable<string>? PatchedFiles { get; set; }
        public IEnumerable<AnalogChannelPatchPreview>? Items { get; set; }
        public IEnumerable<ResponseIssue>? Issues { get; set; }
    }
}
