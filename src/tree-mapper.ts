/**
 * Traverses all TypeScript/JavaScript files and finds imports with explicit .js extensions
 * Uses tree-sitter queries to locate import statements like:
 *   import * as Foo from "./Foo.js"
 *   import { Bar } from "./Bar.js"
 *   import Baz from "./Baz.js"
 */

import * as fs from "fs"
import * as path from "path"
import { Language, Parser } from "web-tree-sitter"
import * as Gitignore from "./Gitignore.ts"
import * as Glob from "./Glob.ts"

interface ImportMatch {
  file: string
  line: number
  column: number
  text: string
  importPath: string
}

/**
 * Find all imports with .js extensions in TypeScript/JavaScript files
 *
 * @param cwd - Current working directory to search from
 * @param includePatterns - Glob patterns for files to include
 * @param excludePatterns - Glob patterns for files to exclude
 * @returns Array of import matches with file locations
 */
export async function findJsImports(
  cwd: string = process.cwd(),
  includePatterns: string[] = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  excludePatterns: string[] = ["node_modules", "dist", ".git"],
): Promise<ImportMatch[]> {
  // Initialize tree-sitter and load TypeScript language
  await Parser.init()
  const parser = new Parser()

  // Load tree-sitter-typescript WASM
  const wasmPath = new URL(
    "../node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm",
    import.meta.url,
  )
  const wasmBuffer = fs.readFileSync(wasmPath)
  const TypeScript = await Language.load(wasmBuffer)
  parser.setLanguage(TypeScript)

  // Initialize gitignore filter
  const gitignore = new Gitignore.Ignore()
  const gitignorePath = path.join(cwd, ".gitignore")
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8")
    gitignore.add(gitignoreContent)
  }

  // Normalize patterns
  const normalizedIncludes = Glob.normalizeIncludePatterns(includePatterns)
  const normalizedExcludes = Glob.normalizeExcludePatterns(excludePatterns)

  // Find all matching files
  let files = Glob.findMatchingFiles(
    normalizedIncludes,
    normalizedExcludes,
    cwd,
  )

  // Filter files through gitignore rules
  files = files.filter((file) => !gitignore.ignores(file))

  const matches: ImportMatch[] = []

  for (const file of files) {
    const filePath = path.join(cwd, file)

    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const tree = parser.parse(content)

      // Walk the tree and find import statements with .js extensions
      const walk = (node: any) => {
        // Check if this is a string node within an import statement
        if (node.type === "string") {
          // Check if parent is import_statement or import_clause
          const parent = node.parent
          if (
            parent?.type === "import_statement"
            || parent?.type === "import_clause"
          ) {
            const text = node.text
            // Extract string content (remove quotes)
            const importPath = text.slice(1, -1)

            // Only match if it ends with .js
            if (importPath.endsWith(".js")) {
              const lines = content.slice(0, node.startIndex).split("\n")
              matches.push({
                file,
                line: lines.length,
                column: node.startColumn,
                text: parent.text,
                importPath,
              })
            }
          }
        }

        // Recurse into children
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i))
        }
      }

      walk(tree.rootNode)
    } catch (error) {
      // Skip files that can't be read or parsed
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(
          `Warning: Failed to parse ${file}: ${(error as Error).message}`,
        )
      }
    }
  }

  return matches
}

interface Replacement {
  file: string
  line: number
  column: number
  oldText: string
  newText: string
}

/**
 * Replace .js extensions with .ts in import statements
 */
export async function replaceJsWithTs(
  cwd: string = process.cwd(),
  includePatterns: string[] = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  excludePatterns: string[] = ["node_modules", "dist", ".git"],
  dryRun: boolean = false,
): Promise<Replacement[]> {
  // Initialize tree-sitter and load TypeScript language
  await Parser.init()
  const parser = new Parser()

  // Load tree-sitter-typescript WASM
  const wasmPath = new URL(
    "../node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm",
    import.meta.url,
  )
  const wasmBuffer = fs.readFileSync(wasmPath)
  const TypeScript = await Language.load(wasmBuffer)
  parser.setLanguage(TypeScript)

  // Initialize gitignore filter
  const gitignore = new Gitignore.Ignore()
  const gitignorePath = path.join(cwd, ".gitignore")
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8")
    gitignore.add(gitignoreContent)
  }

  // Normalize patterns
  const normalizedIncludes = Glob.normalizeIncludePatterns(includePatterns)
  const normalizedExcludes = Glob.normalizeExcludePatterns(excludePatterns)

  // Find all matching files
  let files = Glob.findMatchingFiles(
    normalizedIncludes,
    normalizedExcludes,
    cwd,
  )

  // Filter files through gitignore rules
  files = files.filter((file) => !gitignore.ignores(file))

  const replacements: Replacement[] = []

  for (const file of files) {
    const filePath = path.join(cwd, file)

    try {
      let content = fs.readFileSync(filePath, "utf-8")
      const tree = parser.parse(content)

      // Walk the tree and find import statements with .js extensions
      const walk = (node: any) => {
        // Check if this is a string node within an import statement
        if (node.type === "string") {
          // Check if parent is import_statement or import_clause
          const parent = node.parent
          if (
            parent?.type === "import_statement"
            || parent?.type === "import_clause"
          ) {
            const oldText = node.text
            // Extract string content (remove quotes)
            const importPath = oldText.slice(1, -1)

            // Only match if it ends with .js
            if (importPath.endsWith(".js")) {
              const newImportPath = importPath.slice(0, -2) + "ts"
              // oldText is quoted string like "path.js", replace .js with .ts
              const newText = oldText.slice(0, -3) + "ts" + oldText.slice(-1)

              // Get the full import statement text
              const importStatement = parent.text
              const nodeOffsetInParent = node.startIndex - parent.startIndex
              const newImportStatement = importStatement
                .slice(0, nodeOffsetInParent) + newText + importStatement
                .slice(
                  nodeOffsetInParent + oldText.length,
                )

              // Record the replacement
              const lines = content.slice(0, node.startIndex).split("\n")
              const lineNum = lines.length
              const column = lines[lines.length - 1].length

              replacements.push({
                file,
                line: lineNum,
                column,
                oldText: importStatement,
                newText: newImportStatement,
              })

              // Apply the replacement
              content = content.slice(0, node.startIndex) + newText + content
                .slice(node.endIndex)
            }
          }
        }

        // Recurse into children
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i))
        }
      }

      walk(tree.rootNode)

      if (replacements.filter((r) => r.file === file).length > 0) {
        if (!dryRun) {
          fs.writeFileSync(filePath, content, "utf-8")
        }
      }
    } catch (error) {
      // Skip files that can't be read or parsed
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(
          `Warning: Failed to process ${file}: ${(error as Error).message}`,
        )
      }
    }
  }

  return replacements
}

/**
 * Format matches for display
 */
export function formatMatches(matches: ImportMatch[]): string {
  if (matches.length === 0) {
    return "No imports with .js extensions found"
  }

  const grouped = matches.reduce(
    (acc, match) => {
      if (!acc[match.file]) {
        acc[match.file] = []
      }
      acc[match.file].push(match)
      return acc
    },
    {} as Record<string, ImportMatch[]>,
  )

  let output = `Found ${matches.length} import(s) with .js extension:\n\n`

  for (const [file, fileMatches] of Object.entries(grouped)) {
    output += `${file}\n`
    for (const match of fileMatches) {
      output += `  Line ${match.line}:${match.column} - ${match.importPath}\n`
      output += `    ${match.text}\n`
    }
    output += "\n"
  }

  return output
}

/**
 * Format replacement results for display
 */
export function formatReplacements(
  replacements: Replacement[],
  dryRun: boolean = false,
): string {
  if (replacements.length === 0) {
    return "No replacements to make"
  }

  const grouped = replacements.reduce(
    (acc, replacement) => {
      if (!acc[replacement.file]) {
        acc[replacement.file] = []
      }
      acc[replacement.file].push(replacement)
      return acc
    },
    {} as Record<string, Replacement[]>,
  )

  const prefix = dryRun ? "[DRY RUN] Would replace" : "Replaced"
  let output = `${prefix} ${replacements.length} import(s) across ${
    Object.keys(grouped).length
  } file(s):\n\n`

  for (const [file, fileReplacements] of Object.entries(grouped)) {
    output += `${file}\n`
    for (const replacement of fileReplacements) {
      output += `  Line ${replacement.line}:${replacement.column}\n`
      output += `  - ${replacement.oldText}\n`
      output += `  + ${replacement.newText}\n`
      output += "\n"
    }
  }

  return output
}

// CLI usage
if (import.meta.main) {
  const args = Bun.argv.slice(2)
  const dryRun = args.includes("--dry-run")

  if (args.includes("--replace")) {
    const replacements = await replaceJsWithTs(
      process.cwd(),
      ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      ["node_modules", "dist", ".git"],
      dryRun,
    )
    console.log(formatReplacements(replacements, dryRun))
  } else {
    const matches = await findJsImports()
    console.log(formatMatches(matches))
  }
}
