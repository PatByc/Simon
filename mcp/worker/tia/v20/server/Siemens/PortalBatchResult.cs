using System.Collections.Generic;

namespace TiaMcpServer.Siemens
{
    public sealed class PortalIssue
    {
        public string? Code { get; set; }
        public string? Item { get; set; }
        public string? Path { get; set; }
        public string? Message { get; set; }
    }

    public sealed class PortalBatchResult<T>
    {
        public int Total { get; set; }
        public List<T> Items { get; } = new List<T>();
        public List<T> Inconsistent { get; } = new List<T>();
        public List<PortalIssue> Issues { get; } = new List<PortalIssue>();
    }
}
