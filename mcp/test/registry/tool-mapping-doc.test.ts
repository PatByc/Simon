import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { tiaV20ToolMap } from "../../src/connectors/tia/v20/tool-map.js";

describe("TOOL_MAPPING.md", () => {
  it("contains every classified upstream tool and Simon tool", async () => {
    const document = await readFile(new URL("../../TOOL_MAPPING.md", import.meta.url), "utf8");
    for (const mapping of tiaV20ToolMap) {
      expect(document).toContain(`\`${mapping.upstreamTool}\``);
      if (mapping.simonTool) expect(document).toContain(`\`${mapping.simonTool}\``);
    }
  });
});
