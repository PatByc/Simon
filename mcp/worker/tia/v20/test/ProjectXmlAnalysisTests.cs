using System;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using TiaMcpServer.Siemens;

namespace TiaMcpServer.Unit
{
    [TestClass]
    public class ProjectXmlAnalysisTests
    {
        [TestMethod]
        public void PatchAnalogChannelPatches_InvalidLaterValue_DoesNotModifyXml()
        {
            var directory = CreateFixtureDirectory();
            var file = Path.Combine(directory, "AnalogInput.xml");
            var before = File.ReadAllText(file);

            var result = ProjectXmlAnalysis.PatchAnalogChannelPatches(
                directory,
                "Convert_IW",
                "[{\"rawInput\":\"AI.ROOM7_T\",\"engineeringHigh\":50,\"engineeringLow\":\"invalid\"}]");

            Assert.AreEqual("InvalidValue", result.Items.Single().Status);
            Assert.AreEqual(0, result.Items.Single().Before.Count);
            Assert.AreEqual(0, result.Items.Single().After.Count);
            Assert.AreEqual(1, result.Issues.Count);
            Assert.AreEqual(0, result.PatchedFiles.Count);
            Assert.AreEqual(before, File.ReadAllText(file));
        }

        [TestMethod]
        public void PatchAnalogChannelPatches_IntegerRealValues_AreNormalized()
        {
            var directory = CreateFixtureDirectory();
            var file = Path.Combine(directory, "AnalogInput.xml");

            var result = ProjectXmlAnalysis.PatchAnalogChannelPatches(
                directory,
                "Convert_IW",
                "[{\"rawInput\":\"AI.ROOM7_T\",\"engineeringHigh\":50,\"engineeringLow\":-30}]");

            Assert.AreEqual("Ready", result.Items.Single().Status);
            Assert.AreEqual(0, result.Issues.Count);
            Assert.AreEqual(1, result.PatchedFiles.Count);

            var values = XDocument.Load(file)
                .Descendants()
                .Where(element => element.Name.LocalName == "ConstantValue")
                .Select(element => element.Value)
                .ToList();

            CollectionAssert.Contains(values, "50.0");
            CollectionAssert.Contains(values, "-30.0");
        }

        private static string CreateFixtureDirectory()
        {
            var directory = Path.Combine(Path.GetTempPath(), "TiaMcpServer.Unit", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, "AnalogInput.xml"), CreateFixtureXml().ToString());
            return directory;
        }

        private static XDocument CreateFixtureXml()
        {
            return new XDocument(
                new XElement("Document",
                    new XElement("Name", "AnalogInput"),
                    new XElement("SW.Blocks.CompileUnit",
                        CreateSymbolAccess("1", "AI", "ROOM7_T"),
                        CreateConstantAccess("2", "60.0"),
                        CreateConstantAccess("3", "-40.0"),
                        new XElement("Call",
                            new XAttribute("UId", "10"),
                            new XElement("CallInfo", new XAttribute("Name", "Convert_IW"))),
                        CreateWire("1", "10", "AIWIN"),
                        CreateWire("2", "10", "ZHH_SX"),
                        CreateWire("3", "10", "ZHH_XX"))));
        }

        private static XElement CreateSymbolAccess(string uid, params string[] components)
        {
            return new XElement("Access",
                new XAttribute("UId", uid),
                new XAttribute("Scope", "GlobalVariable"),
                new XElement("Symbol",
                    components.Select(component => new XElement("Component", new XAttribute("Name", component)))));
        }

        private static XElement CreateConstantAccess(string uid, string value)
        {
            return new XElement("Access",
                new XAttribute("UId", uid),
                new XAttribute("Scope", "LiteralConstant"),
                new XElement("Constant",
                    new XElement("ConstantType", "Real"),
                    new XElement("ConstantValue", value)));
        }

        private static XElement CreateWire(string accessUid, string callUid, string parameter)
        {
            return new XElement("Wire",
                new XElement("IdentCon", new XAttribute("UId", accessUid)),
                new XElement("NameCon",
                    new XAttribute("UId", callUid),
                    new XAttribute("Name", parameter)));
        }
    }
}
