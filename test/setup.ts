import { $ } from "bun";

// Make $ available globally in tests
(globalThis as any).$ = $;
