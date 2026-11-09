using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using TiaMcpServer.ModelContextProtocol;
using TiaMcpServer.Siemens;

namespace TiaMcpServer
{
    public class Program
    {

        public static async Task Main(string[] args)
        {
            ConfigureConsoleEncoding();

            var options = CliOptions.ParseArgs(args);

            if (!string.Equals(options.Transport, "stdio", StringComparison.OrdinalIgnoreCase))
            {
                Console.Error.WriteLine($"Unsupported transport '{options.Transport}'. This build supports stdio.");
                Environment.ExitCode = 2;
                return;
            }

            Engineering.TiaMajorVersion = options.TiaMajorVersion;

            if (Engineering.TiaMajorVersion < 20)
            {
                AppDomain.CurrentDomain.AssemblyResolve += Engineering.Resolver;
            }
            else
            {
                Openness.Initialize(Engineering.TiaMajorVersion);
            }

            // Ensure user is in user group 'Siemens TIA Openness'
            if (await Openness.IsUserInGroup())
            {
                await RunStdioHost(options);
            }
            else
            {
                Console.Error.WriteLine("User is not in the required group 'Siemens TIA Openness'. Exiting...");
            }
        }

        public static async Task RunStdioHost(CliOptions? options)
        {
            options ??= new CliOptions();
            var builder = Host.CreateEmptyApplicationBuilder(settings: null);

            switch (options.Logging)
            {
                case LoggingMode.Stderr:
                    builder.Logging.AddConsole(console =>
                    {
                        console.LogToStandardErrorThreshold = LogLevel.Trace;
                    });
                    builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
                    builder.Logging.AddFilter("ModelContextProtocol", LogLevel.Warning);
                    builder.Logging.AddFilter("TiaMcpServer", LogLevel.Information);
                    break;

                case LoggingMode.Debug:
                    builder.Logging.AddDebug();
                    builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
                    builder.Logging.AddFilter("ModelContextProtocol", LogLevel.Information);
                    builder.Logging.AddFilter("TiaMcpServer", LogLevel.Debug);
                    builder.Logging.SetMinimumLevel(LogLevel.Debug);
                    break;

                case LoggingMode.EventLog:
                    builder.Logging.AddEventLog();
                    break;
            }

            builder.Services
                .AddMcpServer()
                .WithStdioServerTransport()
                .WithToolsFromAssembly()
                .WithPromptsFromAssembly();

            builder.Services.AddSingleton<Portal>();

            var host = builder.Build();
            McpServer.SetServiceProvider(host.Services);
            McpServer.Logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("McpServer");

            if (options.Logging != LoggingMode.None)
            {
                var logger = host.Services.GetRequiredService<ILogger<Program>>();
                logger.LogInformation(
                    "=== Unified TIA Portal MCP Server V{Version} '{Time}' ===",
                    Engineering.TiaMajorVersion,
                    DateTime.Now.ToShortTimeString());

                switch (options.Logging)
                {
                    case LoggingMode.Stderr:
                        logger.LogInformation("Logging to stderr");
                        break;
                    case LoggingMode.Debug:
                        logger.LogInformation("Logging to debug output");
                        break;
                    case LoggingMode.EventLog:
                        logger.LogInformation("Logging to Windows event log");
                        break;
                }
            }

            await host.RunAsync();
        }

        private static void ConfigureConsoleEncoding()
        {
            try
            {
                var utf8NoBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
                Console.InputEncoding = utf8NoBom;
                Console.OutputEncoding = utf8NoBom;

                Console.SetIn(new StreamReader(
                    Console.OpenStandardInput(),
                    utf8NoBom,
                    detectEncodingFromByteOrderMarks: false,
                    bufferSize: 4096));

                Console.SetOut(new StreamWriter(
                    Console.OpenStandardOutput(),
                    utf8NoBom,
                    bufferSize: 4096)
                {
                    AutoFlush = true
                });

                Console.SetError(new StreamWriter(
                    Console.OpenStandardError(),
                    utf8NoBom,
                    bufferSize: 4096)
                {
                    AutoFlush = true
                });
            }
            catch
            {
                // Continue with host defaults if the host does not allow changing encodings.
            }
        }
    }
}
