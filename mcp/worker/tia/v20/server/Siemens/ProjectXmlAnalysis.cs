using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace TiaMcpServer.Siemens
{
    public sealed class ProjectAnalysisResult<T>
    {
        public string? SnapshotPath { get; set; }
        public int ExportedBlockCount { get; set; }
        public bool SnapshotReused { get; set; }
        public long SnapshotAgeMilliseconds { get; set; }
        public List<T> Items { get; } = new List<T>();
        public List<PortalIssue> Issues { get; } = new List<PortalIssue>();
    }

    public sealed class DbBlockDefinition
    {
        public string? Name { get; set; }
        public string? MemoryLayout { get; set; }
        public int MemberCount { get; set; }
        public int RetainMemberCount { get; set; }
        public List<DbMemberDefinition> Members { get; } = new List<DbMemberDefinition>();
    }

    public sealed class DbMemberDefinition
    {
        public string? Section { get; set; }
        public string? Name { get; set; }
        public string? FullName { get; set; }
        public string? Datatype { get; set; }
        public string? Remanence { get; set; }
        public string? StartValue { get; set; }
        public string? Comment { get; set; }
        public int Level { get; set; }
        public Dictionary<string, string> Attributes { get; } = new Dictionary<string, string>();
    }

    public sealed class ParameterDbAnalysis
    {
        public string? DbName { get; set; }
        public string? MemoryLayout { get; set; }
        public int MemberCount { get; set; }
        public int RetainMemberCount { get; set; }
        public int UsedMemberCount { get; set; }
        public List<ParameterDbMemberIndex> Members { get; } = new List<ParameterDbMemberIndex>();
    }

    public sealed class ParameterDbMemberIndex
    {
        public string? DbName { get; set; }
        public string? Section { get; set; }
        public string? Name { get; set; }
        public string? FullName { get; set; }
        public string? Symbol { get; set; }
        public string? Datatype { get; set; }
        public string? Remanence { get; set; }
        public string? StartValue { get; set; }
        public string? Comment { get; set; }
        public bool HasStartValue { get; set; }
        public int UsageCount { get; set; }
        public List<TagUsage> Usages { get; } = new List<TagUsage>();
    }

    public sealed class TagUsage
    {
        public string? Block { get; set; }
        public string? ProgrammingLanguage { get; set; }
        public string? NetworkTitle { get; set; }
        public string? NetworkComment { get; set; }
        public string? Symbol { get; set; }
        public string? RootName { get; set; }
        public string? MemberName { get; set; }
        public string? AccessScope { get; set; }
        public string? AccessUId { get; set; }
    }

    public sealed class AnalogChannel
    {
        public string? Block { get; set; }
        public string? NetworkTitle { get; set; }
        public string? NetworkComment { get; set; }
        public string? Converter { get; set; }
        public string? CallUId { get; set; }
        public string? RawInput { get; set; }
        public string? RawOutput { get; set; }
        public string? EngineeringInput { get; set; }
        public string? EngineeringOutput { get; set; }
        public string? RawHigh { get; set; }
        public string? RawLow { get; set; }
        public string? EngineeringHigh { get; set; }
        public string? EngineeringLow { get; set; }
        public string? Correction { get; set; }
        public Dictionary<string, string> Parameters { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> ParameterAccessUIds { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    public sealed class AnalogChannelPatchPreview
    {
        public string? Status { get; set; }
        public string? Message { get; set; }
        public AnalogChannel? Channel { get; set; }
        public Dictionary<string, string> Match { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> Before { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> After { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    public sealed class AnalogXmlPatchResult
    {
        public List<AnalogChannelPatchPreview> Items { get; } = new List<AnalogChannelPatchPreview>();
        public List<string> PatchedFiles { get; } = new List<string>();
        public List<PortalIssue> Issues { get; } = new List<PortalIssue>();
    }

    public sealed class AnalogPatchTransactionResult
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
        public List<string> ImportedFiles { get; } = new List<string>();
        public List<string> PatchedFiles { get; } = new List<string>();
        public List<AnalogChannelPatchPreview> Items { get; } = new List<AnalogChannelPatchPreview>();
        public List<PortalIssue> Issues { get; } = new List<PortalIssue>();
    }

    internal sealed class AnalogChannelPatchContext
    {
        public XDocument Document { get; set; } = new XDocument();
        public string FilePath { get; set; } = "";
        public AnalogChannel Channel { get; set; } = new AnalogChannel();
        public Dictionary<string, XElement> AccessByUid { get; } = new Dictionary<string, XElement>(StringComparer.OrdinalIgnoreCase);
    }

    internal sealed class ResolvedAnalogPatchChange
    {
        public string Field { get; set; } = "";
        public string? Before { get; set; }
        public string Value { get; set; } = "";
        public XElement Access { get; set; } = new XElement("Access");
    }

    internal static class ProjectXmlAnalysis
    {
        public static List<DbBlockDefinition> AnalyzeDbMembers(string xmlDirectory, string dbNameRegex = "")
        {
            var regex = CreateRegex(dbNameRegex);
            var result = new List<DbBlockDefinition>();

            foreach (var file in EnumerateXmlFiles(xmlDirectory))
            {
                var document = XDocument.Load(file.FullName, LoadOptions.PreserveWhitespace);
                var definition = AnalyzeDbDocument(document, file, regex);
                if (definition != null)
                {
                    result.Add(definition);
                }
            }

            return result;
        }

        public static List<ParameterDbAnalysis> AnalyzeParameterDbs(
            string xmlDirectory,
            string dbNameRegex = "",
            string memberNameRegex = "",
            int maxMembers = 500,
            int maxUsagesPerMember = 5)
        {
            var dbRegex = CreateRegex(string.IsNullOrWhiteSpace(dbNameRegex) ? "^(SET|PIDParameters|SettingsAndFaults)$" : dbNameRegex);
            var memberRegex = CreateRegex(memberNameRegex);
            var dbs = new List<DbBlockDefinition>();
            var usageIndex = new Dictionary<string, List<TagUsage>>(StringComparer.OrdinalIgnoreCase);
            var result = new List<ParameterDbAnalysis>();
            var emittedMembers = 0;

            foreach (var file in EnumerateXmlFiles(xmlDirectory))
            {
                var document = XDocument.Load(file.FullName, LoadOptions.PreserveWhitespace);
                var db = AnalyzeDbDocument(document, file, dbRegex);
                if (db != null)
                {
                    dbs.Add(db);
                }

                foreach (var usage in EnumerateTagUsages(document, file))
                {
                    if (!usageIndex.TryGetValue(usage.Symbol ?? "", out var usages))
                    {
                        usages = new List<TagUsage>();
                        usageIndex[usage.Symbol ?? ""] = usages;
                    }

                    usages.Add(usage);
                }
            }

            foreach (var db in dbs)
            {
                var analysis = new ParameterDbAnalysis
                {
                    DbName = db.Name,
                    MemoryLayout = db.MemoryLayout,
                    MemberCount = db.MemberCount,
                    RetainMemberCount = db.RetainMemberCount
                };

                foreach (var member in db.Members)
                {
                    if (memberRegex != null
                        && !memberRegex.IsMatch(member.FullName ?? "")
                        && !memberRegex.IsMatch(member.Name ?? ""))
                    {
                        continue;
                    }

                    var symbol = string.IsNullOrWhiteSpace(member.FullName) ? db.Name ?? "" : $"{db.Name}.{member.FullName}";
                    usageIndex.TryGetValue(symbol, out var usages);
                    usages ??= new List<TagUsage>();

                    if (maxMembers <= 0 || emittedMembers < maxMembers)
                    {
                        var indexed = new ParameterDbMemberIndex
                        {
                            DbName = db.Name,
                            Section = member.Section,
                            Name = member.Name,
                            FullName = member.FullName,
                            Symbol = symbol,
                            Datatype = member.Datatype,
                            Remanence = member.Remanence,
                            StartValue = member.StartValue,
                            Comment = member.Comment,
                            HasStartValue = !string.IsNullOrWhiteSpace(member.StartValue),
                            UsageCount = usages.Count
                        };

                        foreach (var usage in usages.Take(Math.Max(0, maxUsagesPerMember)))
                        {
                            indexed.Usages.Add(usage);
                        }

                        analysis.Members.Add(indexed);
                        emittedMembers++;
                    }
                }

                analysis.UsedMemberCount = analysis.Members.Count(member => member.UsageCount > 0);
                result.Add(analysis);
            }

            return result;
        }

        public static List<TagUsage> FindTagUsages(string xmlDirectory, string tagPattern, int maxResults)
        {
            var regex = CreateRegex(tagPattern) ?? throw new ArgumentException("tagPattern is required", nameof(tagPattern));
            var result = new List<TagUsage>();

            foreach (var file in EnumerateXmlFiles(xmlDirectory))
            {
                var document = XDocument.Load(file.FullName, LoadOptions.PreserveWhitespace);
                foreach (var usage in EnumerateTagUsages(document, file))
                {
                    if (!string.IsNullOrWhiteSpace(usage.Symbol) && regex.IsMatch(usage.Symbol))
                    {
                        result.Add(usage);

                        if (maxResults > 0 && result.Count >= maxResults)
                        {
                            return result;
                        }
                    }
                }
            }

            return result;
        }

        private static DbBlockDefinition? AnalyzeDbDocument(XDocument document, FileInfo file, Regex? nameRegex)
        {
            if (!string.Equals(GetAttributeText(document, "ProgrammingLanguage"), "DB", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var dbName = GetAttributeText(document, "Name") ?? Path.GetFileNameWithoutExtension(file.Name);
            if (nameRegex != null && !nameRegex.IsMatch(dbName))
            {
                return null;
            }

            var definition = new DbBlockDefinition
            {
                Name = dbName,
                MemoryLayout = GetAttributeText(document, "MemoryLayout")
            };

            foreach (var section in document.Descendants().Where(e => e.Name.LocalName == "Section"))
            {
                var sectionName = GetAttribute(section, "Name") ?? "";
                foreach (var member in section.Elements().Where(e => e.Name.LocalName == "Member"))
                {
                    AddMember(definition.Members, member, sectionName, "", 0);
                }
            }

            definition.MemberCount = definition.Members.Count;
            definition.RetainMemberCount = definition.Members.Count(member =>
                string.Equals(member.Remanence, "Retain", StringComparison.OrdinalIgnoreCase));

            return definition;
        }

        private static IEnumerable<TagUsage> EnumerateTagUsages(XDocument document, FileInfo file)
        {
            var blockName = GetAttributeText(document, "Name") ?? Path.GetFileNameWithoutExtension(file.Name);
            var language = GetAttributeText(document, "ProgrammingLanguage");

            foreach (var compileUnit in document.Descendants().Where(e => e.Name.LocalName == "SW.Blocks.CompileUnit"))
            {
                var title = GetLocalizedText(compileUnit, "Title");
                var comment = GetLocalizedText(compileUnit, "Comment");

                foreach (var access in compileUnit.Descendants().Where(e => e.Name.LocalName == "Access"))
                {
                    var symbol = GetSymbol(access);
                    if (string.IsNullOrWhiteSpace(symbol))
                    {
                        continue;
                    }

                    var firstDot = symbol.IndexOf('.');
                    yield return new TagUsage
                    {
                        Block = blockName,
                        ProgrammingLanguage = language,
                        NetworkTitle = title,
                        NetworkComment = comment,
                        Symbol = symbol,
                        RootName = firstDot > 0 ? symbol.Substring(0, firstDot) : symbol,
                        MemberName = firstDot > 0 ? symbol.Substring(firstDot + 1) : "",
                        AccessScope = GetAttribute(access, "Scope"),
                        AccessUId = GetAttribute(access, "UId")
                    };
                }
            }
        }

        public static List<AnalogChannel> AnalyzeAnalogChannels(string xmlDirectory, string converterName)
        {
            var channels = new List<AnalogChannel>();

            foreach (var file in EnumerateXmlFiles(xmlDirectory))
            {
                var document = XDocument.Load(file.FullName, LoadOptions.PreserveWhitespace);
                var blockName = GetAttributeText(document, "Name") ?? Path.GetFileNameWithoutExtension(file.Name);

                foreach (var compileUnit in document.Descendants().Where(e => e.Name.LocalName == "SW.Blocks.CompileUnit"))
                {
                    var networkTitle = GetLocalizedText(compileUnit, "Title");
                    var networkComment = GetLocalizedText(compileUnit, "Comment");
                    var accessByUid = compileUnit
                        .Descendants()
                        .Where(e => e.Name.LocalName == "Access")
                        .Where(e => !string.IsNullOrWhiteSpace(GetAttribute(e, "UId")))
                        .ToDictionary(e => GetAttribute(e, "UId")!, e => GetAccessValue(e));

                    var calls = compileUnit
                        .Descendants()
                        .Where(e => e.Name.LocalName == "Call")
                        .Select(call => new
                        {
                            UId = GetAttribute(call, "UId"),
                            CallInfo = call.Descendants().FirstOrDefault(e => e.Name.LocalName == "CallInfo")
                        })
                        .Where(call => !string.IsNullOrWhiteSpace(call.UId)
                            && call.CallInfo != null
                            && string.Equals(GetAttribute(call.CallInfo, "Name"), converterName, StringComparison.OrdinalIgnoreCase))
                        .ToDictionary(call => call.UId!, call => new AnalogChannel
                        {
                            Block = blockName,
                            NetworkTitle = networkTitle,
                            NetworkComment = networkComment,
                            Converter = converterName,
                            CallUId = call.UId
                        });

                    if (calls.Count == 0)
                    {
                        continue;
                    }

                    foreach (var wire in compileUnit.Descendants().Where(e => e.Name.LocalName == "Wire"))
                    {
                        var accessUid = wire
                            .Elements()
                            .Where(e => e.Name.LocalName == "IdentCon")
                            .Select(e => GetAttribute(e, "UId"))
                            .Where(uid => uid != null && accessByUid.ContainsKey(uid))
                            .FirstOrDefault();

                        if (string.IsNullOrWhiteSpace(accessUid))
                        {
                            continue;
                        }

                        var value = accessByUid[accessUid!];
                        if (string.IsNullOrWhiteSpace(value))
                        {
                            continue;
                        }

                        foreach (var nameCon in wire.Elements().Where(e => e.Name.LocalName == "NameCon"))
                        {
                            var callUid = GetAttribute(nameCon, "UId");
                            var parameter = GetAttribute(nameCon, "Name");
                            if (callUid == null || parameter == null || !calls.ContainsKey(callUid))
                            {
                                continue;
                            }

                            calls[callUid].Parameters[parameter] = value;
                            calls[callUid].ParameterAccessUIds[parameter] = accessUid!;
                        }
                    }

                    foreach (var channel in calls.Values)
                    {
                        NormalizeAnalogChannel(channel);
                        channels.Add(channel);
                    }
                }
            }

            return channels;
        }

        public static List<AnalogChannelPatchPreview> PreviewAnalogChannelPatches(string xmlDirectory, string converterName, string changesJson)
        {
            var channels = AnalyzeAnalogChannels(xmlDirectory, converterName);
            var requests = ParsePatchRequests(changesJson);
            var previews = new List<AnalogChannelPatchPreview>();

            foreach (var request in requests)
            {
                var matches = channels.Where(channel => MatchesPatchRequest(channel, request.Match)).ToList();
                var preview = new AnalogChannelPatchPreview();

                foreach (var item in request.Match)
                {
                    preview.Match[item.Key] = item.Value;
                }

                if (matches.Count == 0)
                {
                    preview.Status = "NoMatch";
                    preview.Message = "No channel matched the requested selectors.";
                    previews.Add(preview);
                    continue;
                }

                if (matches.Count > 1)
                {
                    preview.Status = "Ambiguous";
                    preview.Message = $"{matches.Count} channels matched. Add block, networkTitle, rawInput, engineeringOutput, engineeringInput, or rawOutput to make the patch unambiguous.";
                    previews.Add(preview);
                    continue;
                }

                var channel = matches[0];
                preview.Status = "Ready";
                preview.Message = "Dry-run preview only. No XML or TIA project data was modified.";
                preview.Channel = channel;

                foreach (var change in request.Values)
                {
                    if (!ValidatePatchChange(converterName, change.Key, change.Value, out var validationStatus, out var validationMessage))
                    {
                        preview.Status = validationStatus;
                        preview.Message = validationMessage;
                        break;
                    }
                }

                if (preview.Status == "Ready")
                {
                    foreach (var change in request.Values)
                    {
                        var before = GetPatchableValue(channel, change.Key);
                        if (before != null)
                        {
                            preview.Before[change.Key] = before;
                        }

                        preview.After[change.Key] = NormalizePatchValue(change.Value);
                    }
                }

                previews.Add(preview);
            }

            return previews;
        }

        public static AnalogXmlPatchResult PatchAnalogChannelPatches(string xmlDirectory, string converterName, string changesJson)
        {
            var contexts = BuildAnalogChannelPatchContexts(xmlDirectory, converterName);
            var requests = ParsePatchRequests(changesJson);
            var result = new AnalogXmlPatchResult();
            var changedDocuments = new Dictionary<string, XDocument>(StringComparer.OrdinalIgnoreCase);

            foreach (var request in requests)
            {
                var matches = contexts.Where(context => MatchesPatchRequest(context.Channel, request.Match)).ToList();
                var preview = new AnalogChannelPatchPreview();

                foreach (var item in request.Match)
                {
                    preview.Match[item.Key] = item.Value;
                }

                if (matches.Count == 0)
                {
                    preview.Status = "NoMatch";
                    preview.Message = "No channel matched the requested selectors.";
                    result.Items.Add(preview);
                    continue;
                }

                if (matches.Count > 1)
                {
                    preview.Status = "Ambiguous";
                    preview.Message = $"{matches.Count} channels matched. Add block, networkTitle, rawInput, engineeringOutput, engineeringInput, or rawOutput to make the patch unambiguous.";
                    result.Items.Add(preview);
                    continue;
                }

                var context = matches[0];
                preview.Status = "Ready";
                preview.Message = "XML patched in the working snapshot. TIA project import is handled by the caller.";
                preview.Channel = context.Channel;
                var resolvedChanges = new List<ResolvedAnalogPatchChange>();

                foreach (var change in request.Values)
                {
                    if (!ValidatePatchChange(converterName, change.Key, change.Value, out var validationStatus, out var validationMessage))
                    {
                        preview.Status = validationStatus;
                        preview.Message = validationMessage;
                        break;
                    }
                }

                if (preview.Status == "Ready")
                {
                    foreach (var change in request.Values)
                    {
                        var parameter = GetParameterNameForPatchProperty(converterName, change.Key);
                        var normalizedValue = NormalizePatchValue(change.Value);

                        if (!context.Channel.ParameterAccessUIds.TryGetValue(parameter!, out var accessUid)
                            || !context.AccessByUid.TryGetValue(accessUid, out var access))
                        {
                            preview.Status = "PatchParameterNotFound";
                            preview.Message = $"Parameter '{parameter}' has no writable Access node in the exported XML.";
                            break;
                        }

                        resolvedChanges.Add(new ResolvedAnalogPatchChange
                        {
                            Field = change.Key,
                            Before = GetPatchableValue(context.Channel, change.Key),
                            Value = normalizedValue,
                            Access = access
                        });
                    }
                }

                if (preview.Status == "Ready")
                {
                    foreach (var change in resolvedChanges)
                    {
                        if (change.Before != null)
                        {
                            preview.Before[change.Field] = change.Before;
                        }
                        preview.After[change.Field] = change.Value;
                        PatchAccessValue(change.Access, change.Value);
                    }

                    if (resolvedChanges.Count > 0)
                    {
                        changedDocuments[context.FilePath] = context.Document;
                    }
                }

                result.Items.Add(preview);
            }

            foreach (var item in result.Items.Where(item => item.Status != "Ready"))
            {
                result.Issues.Add(new PortalIssue
                {
                    Code = item.Status,
                    Item = string.Join(", ", item.Match.Select(match => $"{match.Key}={match.Value}")),
                    Message = item.Message
                });
            }

            if (result.Issues.Count > 0)
            {
                return result;
            }

            foreach (var document in changedDocuments)
            {
                document.Value.Save(document.Key);
                result.PatchedFiles.Add(document.Key);
            }

            return result;
        }

        private static List<AnalogChannelPatchContext> BuildAnalogChannelPatchContexts(string xmlDirectory, string converterName)
        {
            var contexts = new List<AnalogChannelPatchContext>();

            foreach (var file in EnumerateXmlFiles(xmlDirectory))
            {
                var document = XDocument.Load(file.FullName, LoadOptions.PreserveWhitespace);
                var blockName = GetAttributeText(document, "Name") ?? Path.GetFileNameWithoutExtension(file.Name);

                foreach (var compileUnit in document.Descendants().Where(e => e.Name.LocalName == "SW.Blocks.CompileUnit"))
                {
                    var networkTitle = GetLocalizedText(compileUnit, "Title");
                    var networkComment = GetLocalizedText(compileUnit, "Comment");
                    var accessByUid = compileUnit
                        .Descendants()
                        .Where(e => e.Name.LocalName == "Access")
                        .Where(e => !string.IsNullOrWhiteSpace(GetAttribute(e, "UId")))
                        .ToDictionary(e => GetAttribute(e, "UId")!, e => e, StringComparer.OrdinalIgnoreCase);
                    var accessValueByUid = accessByUid.ToDictionary(item => item.Key, item => GetAccessValue(item.Value), StringComparer.OrdinalIgnoreCase);

                    var calls = compileUnit
                        .Descendants()
                        .Where(e => e.Name.LocalName == "Call")
                        .Select(call => new
                        {
                            UId = GetAttribute(call, "UId"),
                            CallInfo = call.Descendants().FirstOrDefault(e => e.Name.LocalName == "CallInfo")
                        })
                        .Where(call => !string.IsNullOrWhiteSpace(call.UId)
                            && call.CallInfo != null
                            && string.Equals(GetAttribute(call.CallInfo, "Name"), converterName, StringComparison.OrdinalIgnoreCase))
                        .ToDictionary(call => call.UId!, call => new AnalogChannelPatchContext
                        {
                            Document = document,
                            FilePath = file.FullName,
                            Channel = new AnalogChannel
                            {
                                Block = blockName,
                                NetworkTitle = networkTitle,
                                NetworkComment = networkComment,
                                Converter = converterName,
                                CallUId = call.UId
                            }
                        }, StringComparer.OrdinalIgnoreCase);

                    foreach (var context in calls.Values)
                    {
                        foreach (var access in accessByUid)
                        {
                            context.AccessByUid[access.Key] = access.Value;
                        }
                    }

                    foreach (var wire in compileUnit.Descendants().Where(e => e.Name.LocalName == "Wire"))
                    {
                        var accessUid = wire
                            .Elements()
                            .Where(e => e.Name.LocalName == "IdentCon")
                            .Select(e => GetAttribute(e, "UId"))
                            .FirstOrDefault(uid => uid != null && accessValueByUid.ContainsKey(uid));

                        if (string.IsNullOrWhiteSpace(accessUid))
                        {
                            continue;
                        }

                        var value = accessValueByUid[accessUid!];
                        if (string.IsNullOrWhiteSpace(value))
                        {
                            continue;
                        }

                        foreach (var nameCon in wire.Elements().Where(e => e.Name.LocalName == "NameCon"))
                        {
                            var callUid = GetAttribute(nameCon, "UId");
                            var parameter = GetAttribute(nameCon, "Name");
                            if (callUid == null || parameter == null || !calls.ContainsKey(callUid))
                            {
                                continue;
                            }

                            calls[callUid].Channel.Parameters[parameter] = value;
                            calls[callUid].Channel.ParameterAccessUIds[parameter] = accessUid!;
                        }
                    }

                    foreach (var context in calls.Values)
                    {
                        NormalizeAnalogChannel(context.Channel);
                        contexts.Add(context);
                    }
                }
            }

            return contexts;
        }

        private static void AddMember(List<DbMemberDefinition> members, XElement member, string sectionName, string prefix, int level)
        {
            var name = GetAttribute(member, "Name") ?? "";
            var fullName = string.IsNullOrWhiteSpace(prefix) ? name : $"{prefix}.{name}";
            var definition = new DbMemberDefinition
            {
                Section = sectionName,
                Name = name,
                FullName = fullName,
                Datatype = GetAttribute(member, "Datatype"),
                Remanence = GetAttribute(member, "Remanence"),
                StartValue = GetAttribute(member, "StartValue") ?? GetAttribute(member, "InitialValue"),
                Comment = GetLocalizedText(member, "Comment"),
                Level = level
            };

            foreach (var attribute in member.Attributes())
            {
                definition.Attributes[attribute.Name.LocalName] = attribute.Value;
            }

            members.Add(definition);

            foreach (var child in member.Elements().Where(e => e.Name.LocalName == "Member"))
            {
                AddMember(members, child, sectionName, fullName, level + 1);
            }
        }

        private static void NormalizeAnalogChannel(AnalogChannel channel)
        {
            if (string.Equals(channel.Converter, "Convert_IW", StringComparison.OrdinalIgnoreCase))
            {
                channel.RawInput = GetParameter(channel, "AIWIN");
                channel.RawHigh = GetParameter(channel, "ZHQ_SX");
                channel.RawLow = GetParameter(channel, "ZHQ_XX");
                channel.EngineeringHigh = GetParameter(channel, "ZHH_SX");
                channel.EngineeringLow = GetParameter(channel, "ZHH_XX");
                channel.Correction = GetParameter(channel, "XZZ");
                channel.EngineeringOutput = GetParameter(channel, "REALOUT");
            }
            else if (string.Equals(channel.Converter, "Convert_QW", StringComparison.OrdinalIgnoreCase))
            {
                channel.EngineeringInput = GetParameter(channel, "realIN");
                channel.EngineeringHigh = GetParameter(channel, "ZHQ_SX");
                channel.EngineeringLow = GetParameter(channel, "ZHQ_XX");
                channel.RawHigh = GetParameter(channel, "ZHH_SX");
                channel.RawLow = GetParameter(channel, "ZHH_XX");
                channel.RawOutput = GetParameter(channel, "wordout");
            }
        }

        private sealed class PatchRequest
        {
            public Dictionary<string, string> Match { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, string> Values { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        private static List<PatchRequest> ParsePatchRequests(string changesJson)
        {
            if (string.IsNullOrWhiteSpace(changesJson))
            {
                return new List<PatchRequest>();
            }

            using var document = JsonDocument.Parse(changesJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Array)
            {
                throw new ArgumentException("changesJson must be a JSON array.");
            }

            var requests = new List<PatchRequest>();
            foreach (var element in root.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var request = new PatchRequest();
                AddIfPresent(element, request.Match, "block");
                AddIfPresent(element, request.Match, "networkTitle");
                AddIfPresent(element, request.Match, "rawInput");
                AddIfPresent(element, request.Match, "rawOutput");
                AddIfPresent(element, request.Match, "engineeringInput");
                AddIfPresent(element, request.Match, "engineeringOutput");
                AddIfPresent(element, request.Values, "rawHigh");
                AddIfPresent(element, request.Values, "rawLow");
                AddIfPresent(element, request.Values, "engineeringHigh");
                AddIfPresent(element, request.Values, "engineeringLow");
                AddIfPresent(element, request.Values, "correction");

                requests.Add(request);
            }

            return requests;
        }

        private static void AddIfPresent(JsonElement element, Dictionary<string, string> target, string property)
        {
            if (element.TryGetProperty(property, out var value) && value.ValueKind != JsonValueKind.Null)
            {
                target[property] = value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.ToString();
            }
        }

        private static bool MatchesPatchRequest(AnalogChannel channel, Dictionary<string, string> match)
        {
            if (match.Count == 0)
            {
                return false;
            }

            foreach (var selector in match)
            {
                var actual = GetPatchableValue(channel, selector.Key);
                if (!string.Equals(actual, selector.Value, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            return true;
        }

        private static string? GetPatchableValue(AnalogChannel channel, string name)
        {
            return name.ToLowerInvariant() switch
            {
                "block" => channel.Block,
                "networktitle" => channel.NetworkTitle,
                "rawinput" => channel.RawInput,
                "rawoutput" => channel.RawOutput,
                "engineeringinput" => channel.EngineeringInput,
                "engineeringoutput" => channel.EngineeringOutput,
                "rawhigh" => channel.RawHigh,
                "rawlow" => channel.RawLow,
                "engineeringhigh" => channel.EngineeringHigh,
                "engineeringlow" => channel.EngineeringLow,
                "correction" => channel.Correction,
                _ => null
            };
        }

        private static string? GetParameterNameForPatchProperty(string converterName, string property)
        {
            if (string.Equals(converterName, "Convert_IW", StringComparison.OrdinalIgnoreCase))
            {
                return property.ToLowerInvariant() switch
                {
                    "rawinput" => "AIWIN",
                    "rawhigh" => "ZHQ_SX",
                    "rawlow" => "ZHQ_XX",
                    "engineeringhigh" => "ZHH_SX",
                    "engineeringlow" => "ZHH_XX",
                    "correction" => "XZZ",
                    "engineeringoutput" => "REALOUT",
                    _ => null
                };
            }

            if (string.Equals(converterName, "Convert_QW", StringComparison.OrdinalIgnoreCase))
            {
                return property.ToLowerInvariant() switch
                {
                    "engineeringinput" => "realIN",
                    "engineeringhigh" => "ZHQ_SX",
                    "engineeringlow" => "ZHQ_XX",
                    "rawhigh" => "ZHH_SX",
                    "rawlow" => "ZHH_XX",
                    "rawoutput" => "wordout",
                    _ => null
                };
            }

            return null;
        }

        private static void PatchAccessValue(XElement access, string value)
        {
            var constantValue = access.Descendants().FirstOrDefault(e => e.Name.LocalName == "ConstantValue");
            if (constantValue != null && LooksLikeNumber(value))
            {
                constantValue.Value = NormalizePatchValue(value);
                return;
            }

            var symbol = access.Descendants().FirstOrDefault(e => e.Name.LocalName == "Symbol");
            if (symbol != null && !LooksLikeNumber(value))
            {
                ReplaceSymbol(access, value);
                return;
            }

            if (LooksLikeNumber(value))
            {
                ReplaceWithConstant(access, value);
            }
            else
            {
                ReplaceSymbol(access, value);
            }
        }

        private static bool LooksLikeNumber(string value)
        {
            return double.TryParse(
                    value,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var number)
                && !double.IsNaN(number)
                && !double.IsInfinity(number);
        }

        private static bool IsNumericPatchField(string property)
        {
            return property.Equals("rawHigh", StringComparison.OrdinalIgnoreCase)
                || property.Equals("rawLow", StringComparison.OrdinalIgnoreCase)
                || property.Equals("engineeringHigh", StringComparison.OrdinalIgnoreCase)
                || property.Equals("engineeringLow", StringComparison.OrdinalIgnoreCase);
        }

        private static bool ValidatePatchChange(
            string converterName,
            string field,
            string value,
            out string status,
            out string message)
        {
            if (IsNumericPatchField(field) && !LooksLikeNumber(value))
            {
                status = "InvalidValue";
                message = $"Field '{field}' requires a finite numeric value.";
                return false;
            }

            if (GetParameterNameForPatchProperty(converterName, field) == null)
            {
                status = "UnsupportedPatchField";
                message = $"Field '{field}' cannot be patched for converter '{converterName}'.";
                return false;
            }

            status = "Ready";
            message = "";
            return true;
        }

        private static string NormalizePatchValue(string value)
        {
            var trimmed = value.Trim();
            if (!LooksLikeNumber(trimmed))
            {
                return trimmed;
            }

            if (trimmed.IndexOf('.') < 0
                && trimmed.IndexOf('e') < 0
                && trimmed.IndexOf('E') < 0)
            {
                return trimmed + ".0";
            }

            return trimmed;
        }

        private static void ReplaceWithConstant(XElement access, string value)
        {
            var ns = access.Name.Namespace;
            access.SetAttributeValue("Scope", "LiteralConstant");
            access.RemoveNodes();
            access.Add(new XElement(ns + "Constant",
                new XElement(ns + "ConstantType", "Real"),
                new XElement(ns + "ConstantValue", NormalizePatchValue(value))));
        }

        private static void ReplaceSymbol(XElement access, string value)
        {
            var parts = value.Split(new[] { '.' }, StringSplitOptions.RemoveEmptyEntries).Select(part => part.Trim()).ToArray();
            if (parts.Length == 0)
            {
                throw new ArgumentException("Symbol value must contain at least one component.", nameof(value));
            }

            var ns = access.Name.Namespace;
            access.SetAttributeValue("Scope", "GlobalVariable");
            access.RemoveNodes();
            access.Add(new XElement(ns + "Symbol",
                parts.Select(part => new XElement(ns + "Component", new XAttribute("Name", part)))));
        }

        private static string? GetParameter(AnalogChannel channel, string name)
        {
            return channel.Parameters.TryGetValue(name, out var value) ? value : null;
        }

        private static IEnumerable<FileInfo> EnumerateXmlFiles(string xmlDirectory)
        {
            var directory = new DirectoryInfo(xmlDirectory);
            if (!directory.Exists)
            {
                throw new DirectoryNotFoundException(xmlDirectory);
            }

            return directory.EnumerateFiles("*.xml", SearchOption.AllDirectories).OrderBy(f => f.FullName, StringComparer.OrdinalIgnoreCase);
        }

        private static Regex? CreateRegex(string pattern)
        {
            if (string.IsNullOrWhiteSpace(pattern))
            {
                return null;
            }

            return new Regex(pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        }

        private static string? GetAttributeText(XDocument document, string localName)
        {
            return document.Descendants().FirstOrDefault(e => e.Name.LocalName == localName)?.Value?.Trim();
        }

        private static string? GetAttribute(XElement element, string localName)
        {
            return element.Attributes().FirstOrDefault(a => a.Name.LocalName == localName)?.Value;
        }

        private static string GetAccessValue(XElement access)
        {
            var symbol = GetSymbol(access);
            if (!string.IsNullOrWhiteSpace(symbol))
            {
                return symbol;
            }

            return access.Descendants().FirstOrDefault(e => e.Name.LocalName == "ConstantValue")?.Value?.Trim() ?? "";
        }

        private static string GetSymbol(XElement access)
        {
            var components = access
                .Descendants()
                .Where(e => e.Name.LocalName == "Component")
                .Select(e => GetAttribute(e, "Name"))
                .Where(name => !string.IsNullOrWhiteSpace(name));

            return string.Join(".", components);
        }

        private static string? GetLocalizedText(XElement scope, string compositionName)
        {
            foreach (var text in scope.Descendants().Where(e => e.Name.LocalName == "MultilingualText" && GetAttribute(e, "CompositionName") == compositionName))
            {
                var value = text.Descendants().FirstOrDefault(e => e.Name.LocalName == "Text")?.Value?.Trim();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return null;
        }
    }
}
