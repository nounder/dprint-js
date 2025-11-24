import * as NPath from "node:path"
import { formatText } from "../../index.ts"
import * as ConsoleLogger from "../../logging/ConsoleLogger.ts"
import * as FileLogger from "../../logging/FileLogger.ts"
import * as Logger from "../../logging/Logger.ts"

type ClaudeToolInput =
  | {
    file_path: string
    old_string: string
    new_string: string
    replace_all?: boolean
  }
  | {
    file_path: string
    content: string
  }
  | {
    file_path: string
    limit?: number
    offset?: number
  }

type ClaudeHookInput = {
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode: string
  hook_event_name: string
  tool_name: string
  tool_input: ClaudeToolInput
  tool_use_id: string
}

type ClaudeHookOutput = {
  hookSpecificOutput: {
    hookEventName: string
    permissionDecision?: "allow" | "deny" | "ask"
    permissionDecisionReason?: string
    updatedInput?: ClaudeToolInput
  }
}

type HookResult = ClaudeHookOutput & {
  formatError?: string
}

async function hookPreToolUse(
  input: ClaudeHookInput,
): Promise<ClaudeHookOutput> {
  const toolInput = input.tool_input

  // Handle Write tool with content
  if (
    "content" in toolInput
    && "file_path" in toolInput
    && toolInput.content
  ) {
    let formatted = toolInput.content
    let formatterFound = true
    try {
      formatted = await formatText({
        text: toolInput.content,
        filename: toolInput.file_path,
      })
    } catch {
      // No formatter available for this file type, use content as-is
      formatterFound = false
    }

    // Only apply format if content changed
    if (formatted !== toolInput.content) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "Formatted with dprint",
          updatedInput: {
            file_path: toolInput.file_path,
            content: formatted,
          },
        },
      }
    } else {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: formatterFound
            ? "Already formatted"
            : "No formatter found for file type",
        },
      }
    }
  }

  // Handle Edit tool with old_string/new_string
  if (
    "old_string" in toolInput
    && "new_string" in toolInput
    && "file_path" in toolInput
  ) {
    let formatted = toolInput.new_string
    let formatterFound = true
    try {
      formatted = await formatText({
        text: toolInput.new_string,
        filename: toolInput.file_path,
      })
    } catch {
      // No formatter available for this file type, use content as-is
      formatterFound = false
    }

    if (formatted !== toolInput.new_string) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "Formatted new_string with dprint",
          updatedInput: {
            file_path: toolInput.file_path,
            old_string: toolInput.old_string,
            new_string: formatted,
          },
        },
      }
    } else {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: formatterFound
            ? "Already formatted"
            : "No formatter found for file type",
        },
      }
    }
  }

  // Pass through unchanged for other cases
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Not applicable",
    },
  }
}

async function hookPostToolUse(
  input: ClaudeHookInput,
): Promise<HookResult> {
  const toolInput = input.tool_input

  // Only process Write and Edit tools that write files
  if ("file_path" in toolInput) {
    const filePath = toolInput.file_path

    // Check if file exists
    const file = Bun.file(filePath)
    const exists = await file.exists()

    if (!exists) {
      // File doesn't exist yet, nothing to format
      return {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
        },
      }
    }

    // Read the file content
    let content: string
    try {
      content = await file.text()
    } catch {
      // Can't read file, skip formatting
      return {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
        },
      }
    }

    // Format the content with dprint
    let formatted: string
    try {
      formatted = await formatText({
        text: content,
        filename: filePath,
      })
    } catch {
      // No formatter available for this file type, skip
      return {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
        },
      }
    }

    // Write back if content changed
    if (formatted !== content) {
      try {
        await Bun.write(filePath, formatted)
      } catch (error) {
        return {
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
          },
          formatError: `Error writing formatted file ${filePath}: ${error}`,
        }
      }
    }
  }

  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
    },
  }
}

export async function hook(
  input: ClaudeHookInput,
): Promise<HookResult> {
  if (input.hook_event_name === "PreToolUse") {
    return await hookPreToolUse(input)
  } else if (input.hook_event_name === "PostToolUse") {
    return await hookPostToolUse(input)
  } else {
    throw new Error(`Unknown hook event: ${input.hook_event_name}`)
  }
}

export async function runMain(): Promise<void> {
  const isDebug = true && process.env.DEBUG === "1"
    || process.env.DEBUG === "true"

  let logger = !isDebug
    ? Logger.empty
    : FileLogger.make({
      path: NPath.join(
        process.env.CLAUDE_PROJECT_DIR || process.cwd(),
        ".claude",
        "log",
        `${Date.now()}.log`,
      ),
    })

  try {
    const stdin = await Bun.stdin.text()
    const input = JSON.parse(stdin)

    logger.log("Hook input", input)

    const result = await hook(input)

    logger.log("Hook output", result)

    if (result.formatError) {
      console.error(result.formatError)
    }

    // Output only the ClaudeHookOutput part (without formatError)
    const output: ClaudeHookOutput = {
      hookSpecificOutput: result.hookSpecificOutput,
    }

    const stdout = JSON.stringify(output)
    await Bun.stdout.write(stdout)
  } catch (e) {
    logger.error("Error in Claude hook", e)
  }
}
