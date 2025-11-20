import * as t from "bun:test";
import { normalizeExcludePatterns, normalizeIncludePatterns, normalizePattern } from "../src/glob.js";

t.describe("glob normalization", () => {
  t.it("normalizeExcludePatterns converts directory with trailing slash", () => {
    const result = normalizeExcludePatterns(["tree/"]);
    t.expect(result).toEqual(["tree/**"]);
  });

  t.it("normalizeExcludePatterns converts bare directory name", () => {
    const result = normalizeExcludePatterns(["tree"]);
    t.expect(result).toEqual(["tree/**"]);
  });

  t.it("normalizeExcludePatterns preserves file patterns", () => {
    const patterns = ["*.test.ts", "**/*.ts", "**/node_modules/**"];
    const result = normalizeExcludePatterns(patterns);
    t.expect(result).toEqual(patterns);
  });

  t.it("normalizeExcludePatterns handles mixed patterns", () => {
    const patterns = ["tree/", "dist", "*.test.ts", "**/*.tmp"];
    const result = normalizeExcludePatterns(patterns);
    t.expect(result).toEqual(["tree/**", "dist/**", "*.test.ts", "**/*.tmp"]);
  });

  t.it("normalizeIncludePatterns returns patterns unchanged", () => {
    const patterns = ["src/", "lib", "**/*.ts", "*.js"];
    const result = normalizeIncludePatterns(patterns);
    t.expect(result).toEqual(patterns);
  });

  t.it("normalizePattern works with 'exclude' type", () => {
    t.expect(normalizePattern("tree/", "exclude")).toBe("tree/**");
    t.expect(normalizePattern("dist", "exclude")).toBe("dist/**");
    t.expect(normalizePattern("*.ts", "exclude")).toBe("*.ts");
  });

  t.it("normalizePattern works with 'include' type", () => {
    t.expect(normalizePattern("src/", "include")).toBe("src/");
    t.expect(normalizePattern("lib", "include")).toBe("lib");
    t.expect(normalizePattern("**/*.ts", "include")).toBe("**/*.ts");
  });

  t.it("normalizePattern defaults to 'exclude' type", () => {
    t.expect(normalizePattern("tree/")).toBe("tree/**");
    t.expect(normalizePattern("dist")).toBe("dist/**");
  });
});
