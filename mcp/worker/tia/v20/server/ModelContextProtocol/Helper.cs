using Siemens.Engineering;
using Siemens.Engineering.SW.Blocks;
using System;
using System.Collections.Generic;
using System.Globalization;

namespace TiaMcpServer.ModelContextProtocol
{
    public class Helper
    {
        public static List<ResponseAttributeInfo> GetAttributeList(IEngineeringObject obj)
        {
            var attributes = new List<ResponseAttributeInfo>();

            if (obj != null)
            {
                foreach (var attr in obj.GetAttributeInfos())
                {
                    object? value = null;
                    string? valueText;
                    string? valueType;

                    try
                    {
                        value = obj.GetAttribute(attr.Name);
                        valueText = FormatAttributeValue(value);
                        valueType = value?.GetType().FullName;
                    }
                    catch (Exception ex)
                    {
                        valueText = $"<unavailable: {ex.GetType().Name}>";
                        valueType = null;
                    }

                    attributes.Add(new ResponseAttributeInfo
                    {
                        Name = attr.Name,
                        Value = valueText,
                        ValueType = valueType,
                        AccessMode = Enum.GetName(typeof(EngineeringAttributeAccessMode), attr.AccessMode)
                    });
                }
            }

            return attributes;
        }

        private static string? FormatAttributeValue(object? value)
        {
            if (value == null)
            {
                return null;
            }

            if (value is IFormattable formattable)
            {
                return formattable.ToString(null, CultureInfo.InvariantCulture);
            }

            return value.ToString();
        }

        public static BlockGroupInfo BuildBlockHierarchy(PlcBlockGroup group)
        {
            var groupInfo = new BlockGroupInfo
            {
                Name = group.Name
            };

            var blockList = new List<ResponseBlockInfo>();
            foreach (var block in group.Blocks)
            {
                blockList.Add(DtoMapper.ToBlockInfo(block));
            }
            groupInfo.Blocks = blockList;

            var groupList = new List<BlockGroupInfo>();
            foreach (var subGroup in group.Groups)
            {
                groupList.Add(BuildBlockHierarchy(subGroup));
            }
            groupInfo.Groups = groupList;

            return groupInfo;
        }
    }
}
