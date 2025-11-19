#!/usr/bin/env bun

import { main } from "../src/cli.js";

main().then((exitCode) => {
  process.exit(exitCode);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
