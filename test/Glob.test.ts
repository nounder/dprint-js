import * as t from "bun:test"
import * as Glob from "../src/Glob.js"

t.describe("glob normalization", () => {
  t.it(
    "Glob.normalizeExcludePatterns converts directory with trailing slash",
    () => {
      const result = Glob.normalizeExcludePatterns(["tree/"])
      t.expect(result).toEqual(["tree/**"])
    },
  )

  t.it("Glob.normalizeExcludePatterns converts bare directory name", () => {
    const result = Glob.normalizeExcludePatterns(["tree"])
    t.expect(result).toEqual(["tree/**"])
  })

  t.it("Glob.normalizeExcludePatterns preserves file patterns", () => {
    const patterns = ["*.test.ts", "**/*.ts", "**/node_modules/**"]
    const result = Glob.normalizeExcludePatterns(patterns)
    t.expect(result).toEqual(patterns)
  })

  t.it("Glob.normalizeExcludePatterns handles mixed patterns", () => {
    const patterns = ["tree/", "dist", "*.test.ts", "**/*.tmp"]
    const result = Glob.normalizeExcludePatterns(patterns)
    t.expect(result).toEqual(["tree/**", "dist/**", "*.test.ts", "**/*.tmp"])
  })

  t.it("Glob.normalizeIncludePatterns returns patterns unchanged", () => {
    const patterns = ["src/", "lib", "**/*.ts", "*.js"]
    const result = Glob.normalizeIncludePatterns(patterns)
    t.expect(result).toEqual(patterns)
  })

  t.it("Glob.normalizePattern works with 'exclude' type", () => {
    t.expect(Glob.normalizePattern("tree/", "exclude")).toBe("tree/**")
    t.expect(Glob.normalizePattern("dist", "exclude")).toBe("dist/**")
    t.expect(Glob.normalizePattern("*.ts", "exclude")).toBe("*.ts")
  })

  t.it("Glob.normalizePattern works with 'include' type", () => {
    t.expect(Glob.normalizePattern("src/", "include")).toBe("src/")
    t.expect(Glob.normalizePattern("lib", "include")).toBe("lib")
    t.expect(Glob.normalizePattern("**/*.ts", "include")).toBe("**/*.ts")
  })

  t.it("Glob.normalizePattern defaults to 'exclude' type", () => {
    t.expect(Glob.normalizePattern("tree/")).toBe("tree/**")
    t.expect(Glob.normalizePattern("dist")).toBe("dist/**")
  })
})
