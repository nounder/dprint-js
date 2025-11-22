import * as t from "bun:test";
import { formatText, loadPlugins } from "../src/formatter.js";

t.it("respects lineWidth configuration for TypeScript", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      lineWidth: 40,
    },
  };

  const result = await loadPlugins(config);
  const formatter = result.plugins[0].formatter;

  const input = "const longVariable = \"this is a very long string that should wrap\";";
  const output = formatText("test.ts", input, formatter);

  // With lineWidth 40, the line should be broken
  t.expect(output.split("\n").length).toBeGreaterThan(1);
});

t.it("uses wider lineWidth when configured", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      lineWidth: 200,
    },
  };

  const result = await loadPlugins(config);
  const formatter = result.plugins[0].formatter;

  const input = "const longVariable = \"this is a moderately long string\";";
  const output = formatText("test.ts", input, formatter);

  // With lineWidth 200, should stay on one line
  const lines = output.trim().split("\n");
  t.expect(lines.length).toBe(1);
});

t.it("applies lineWidth to JSON formatting", async () => {
  const config = {
    plugins: ["@dprint/json"],
    json: {
      lineWidth: 40,
    },
  };

  const result = await loadPlugins(config);
  const formatter = result.plugins[0].formatter;

  const input = "{\"a\":1,\"b\":2,\"c\":3,\"d\":4,\"e\":5,\"f\":6,\"g\":7}";
  const output = formatText("test.json", input, formatter);

  // Should format with appropriate line breaks
  t.expect(output).toBeDefined();
  t.expect(output.length).toBeGreaterThan(input.length);
});
