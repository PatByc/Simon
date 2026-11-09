using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Types;
using System;
using TiaMcpServer.Siemens;

namespace TiaMcpServer.ModelContextProtocol
{
    public static class DtoMapper
    {
        public static ResponseProjectInfo ToProjectInfo(ProjectBase project)
        {
            return new ResponseProjectInfo
            {
                Name = SafeRead(() => project.Name),
                Path = SafeRead(() => project.Path?.ToString()),
                Attributes = SafeRead(() => Helper.GetAttributeList(project))
            };
        }

        public static ResponseDeviceInfo ToDeviceInfo(Device device, string? path = null)
        {
            return new ResponseDeviceInfo
            {
                Name = device.Name,
                Path = path,
                Attributes = Helper.GetAttributeList(device),
                Description = device.ToString()
            };
        }

        public static ResponseDeviceItemInfo ToDeviceItemInfo(DeviceItem item, string? path = null)
        {
            return new ResponseDeviceItemInfo
            {
                Name = item.Name,
                Path = path,
                Attributes = Helper.GetAttributeList(item),
                Description = item.ToString()
            };
        }

        public static ResponseSoftwareInfo ToSoftwareInfo(PlcSoftware software, string? path = null)
        {
            return new ResponseSoftwareInfo
            {
                Name = software.Name,
                Path = path,
                Attributes = Helper.GetAttributeList(software),
                Description = software.ToString()
            };
        }

        public static ResponseBlockInfo ToBlockInfo(PlcBlock block, Func<PlcBlock, string>? pathResolver = null)
        {
            var response = new ResponseBlockInfo
            {
                Name = SafeRead(() => block.Name),
                Path = SafeRead(() => pathResolver?.Invoke(block)),
                TypeName = SafeRead(() => block.GetType().Name),
                Namespace = SafeRead(() => block.Namespace),
                ProgrammingLanguage = SafeRead(() => Enum.GetName(typeof(ProgrammingLanguage), block.ProgrammingLanguage)),
                MemoryLayout = SafeRead(() => Enum.GetName(typeof(MemoryLayout), block.MemoryLayout)),
                IsConsistent = SafeRead(() => (bool?)block.IsConsistent),
                HeaderName = SafeRead(() => block.HeaderName),
                ModifiedDate = SafeRead(() => (DateTime?)block.ModifiedDate),
                IsKnowHowProtected = SafeRead(() => (bool?)block.IsKnowHowProtected),
                Attributes = SafeRead(() => Helper.GetAttributeList(block)),
                Description = SafeRead(() => block.ToString())
            };

            if (response.Name == null)
            {
                response.Message = "Block metadata is unavailable. TIA Portal may have disposed the object after the operation.";
            }

            return response;
        }

        public static ResponseTypeInfo ToTypeInfo(PlcType type, Func<PlcType, string>? pathResolver = null)
        {
            return new ResponseTypeInfo
            {
                Name = type.Name,
                Path = pathResolver?.Invoke(type),
                TypeName = type.GetType().Name,
                Namespace = type.Namespace,
                IsConsistent = type.IsConsistent,
                ModifiedDate = type.ModifiedDate,
                IsKnowHowProtected = type.IsKnowHowProtected,
                Attributes = Helper.GetAttributeList(type),
                Description = type.ToString()
            };
        }

        public static ResponseIssue ToIssue(PortalIssue issue)
        {
            return new ResponseIssue
            {
                Code = issue.Code,
                Item = issue.Item,
                Path = issue.Path,
                Message = issue.Message
            };
        }

        private static T? SafeRead<T>(Func<T> read)
        {
            try
            {
                return read();
            }
            catch
            {
                return default;
            }
        }
    }
}
