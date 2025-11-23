import * as t from "bun:test";
import * as Formatter from "../src/Formatter.js";

t.it("respects indentWidth: 2 for TypeScript", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      indentWidth: 2,
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

  t.expect(output).toContain("  return"); // 2 spaces
});

t.it("respects indentWidth: 4 for TypeScript", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      indentWidth: 4,
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

  t.expect(output).toContain("    return"); // 4 spaces
});

t.it("applies indentWidth to nested structures", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      indentWidth: 4,
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "class Test{method(){const x={a:1,b:2};return x;}}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should have 4 spaces for indentation
  t.expect(output).toContain("    method()"); // 4 spaces
  t.expect(output).toContain("        const x"); // 8 spaces
});

t.it("respects indentWidth for JSON", async () => {
  const config = {
    plugins: ["@dprint/json"],
    json: {
      indentWidth: 4,
      lineWidth: 40, // Force multiline formatting
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "{\"nested\":{\"value\":1,\"items\":[\"a\",\"b\",\"c\"]}}";
  const output = Formatter.formatText("test.json", input, formatter);

  // Count leading spaces on the "value" line
  const lines = output.split("\n");
  const valueLine = lines.find(l => l.includes("\"value\""));
  const leadingSpaces = valueLine ? valueLine.match(/^ */)[0].length : 0;
  t.expect(leadingSpaces).toBe(8); // 4 spaces * 2 levels
});
