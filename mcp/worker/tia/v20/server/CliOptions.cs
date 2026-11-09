using System;

namespace TiaMcpServer
{
    public enum LoggingMode
    {
        None = 0,
        Stderr = 1,
        Debug = 2,
        EventLog = 3
    }

    public class CliOptions
    {
        public const int DefaultTiaMajorVersion = 20;

        public int TiaMajorVersion { get; set; } = DefaultTiaMajorVersion;
        public LoggingMode Logging { get; set; } = LoggingMode.Stderr;
        public string Transport { get; set; } = "stdio";

        public static CliOptions ParseArgs(string[] args)
        {
            var options = new CliOptions();
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i].ToLowerInvariant())
                {
                    case "-tia-major-version":
                    case "--tia-major-version":
                        if (i + 1 < args.Length && int.TryParse(args[i + 1], out int v))
                        {
                            options.TiaMajorVersion = v;
                            i++;
                        }
                        break;

                    case "-logging":
                    case "--logging":
                        if (i + 1 < args.Length)
                        {
                            options.Logging = ParseLogging(args[i + 1]);
                            i++;
                        }
                        break;

                    case "-transport":
                    case "--transport":
                        if (i + 1 < args.Length)
                        {
                            options.Transport = args[i + 1].Trim().ToLowerInvariant();
                            i++;
                        }
                        break;
                }
            }

            return options;
        }

        private static LoggingMode ParseLogging(string raw)
        {
            if (int.TryParse(raw, out var numeric) && Enum.IsDefined(typeof(LoggingMode), numeric))
            {
                return (LoggingMode)numeric;
            }

            switch (raw.Trim().ToLowerInvariant())
            {
                case "0":
                case "none":
                case "off":
                    return LoggingMode.None;
                case "1":
                case "stderr":
                case "stdio":
                case "console":
                    return LoggingMode.Stderr;
                case "2":
                case "debug":
                    return LoggingMode.Debug;
                case "3":
                case "eventlog":
                case "event-log":
                    return LoggingMode.EventLog;
                default:
                    throw new ArgumentException($"Invalid --logging value '{raw}'. Use none, stderr, debug, eventlog, or 0..3.");
            }
        }
    }
}
