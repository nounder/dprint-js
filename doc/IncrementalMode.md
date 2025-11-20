# Incremental Mode Documentation

Incremental mode is a performance optimization feature that speeds up dprint formatting operations
by only processing files that have changed since the last formatting run.
This is dprint's default behavior and can reduce formatting time from tens of seconds to under a second on subsequent runs.

- **Speed**: Formatting verification can go from ~40s to <1s on the second run
- **Hashing**: Uses file content hashing to detect actual changes
- **Cache invalidation**: Cache is automatically maintained and invalidated when needed

# Basic Principle

Instead of formatting all files every time, incremental mode:

1. **Computes a hash** of each file's content before formatting
2. **Checks the cache** to see if a file with that exact hash was previously formatted
3. **Skips formatting** if the file hash exists in the cache
4. **Formats and caches** if the file is new or has changed

## Hash-Based Change Detection

The original dprint uses **xxHash** (via the `twox-hash` Rust crate) for fast, non-cryptographic hashing. This implementation uses Node.js's built-in `crypto` module with **xxHash64** for compatibility and performance.

## Implementation Details

## Cache Storage Location

The cache is stored in the system's standard cache directory:

- **Linux**: `~/.cache/dprint-js/`
- **macOS**: `~/Library/Caches/dprint-js/`
- **Windows**: `%LOCALAPPDATA%\dprint-js\`

Users can override this by setting the `DPRINT_CACHE_DIR` environment variable.

## Cache File Structure

The cache directory contains:

```
~/.cache/dprint-js/
├── incremental/
│   └── cache-manifest.json
└── plugins/
    └── [plugin caches]
```

### Cache Manifest Format

The `cache-manifest.json` file stores metadata about formatted files:

```json
{
  "version": "1.0.0",
  "cacheKey": "abc123...",
  "files": {
    "xxhash64-of-file-content": {
      "paths": ["/absolute/path/to/file.ts"],
      "formattedAt": 1234567890123
    }
  },
  "metadata": {
    "createdAt": 1234567890123,
    "lastModified": 1234567890123,
    "formatCount": 42
  }
}
```

### Cache Key Computation

The cache key is computed from configuration that affects formatting:

1. **Config file content**: Hash of `dprint.json` (excluding `includes`/`excludes`)
2. **Plugin versions**: Versions of loaded formatter plugins
3. **dprint-js version**: Version of this tool

If any of these change, the cache is automatically invalidated and rebuilt.

### Cache Invalidation Strategy

1. **Configuration changes**: Any formatting-related config option changes
2. **Plugin updates**: Any formatter plugin is updated
3. **Tool updates**: dprint-js itself is updated
4. **Manual clear**: User runs `dprint-js clear-cache` or deletes cache directory
5. **Cache version mismatch**: Cache manifest schema version doesn't match

## Cache Structure

## In-Memory Cache

During a formatting run, the cache is loaded into memory for fast lookups:

```javascript
class IncrementalCache {
  constructor() {
    this.version = '1.0.0';
    this.cacheKey = null;
    this.files = new Map(); // hash -> metadata
    this.dirty = false;
  }

  async load(cacheDir, cacheKey) { /* ... */ }
  hasHash(hash) { /* ... */ }
  addFile(hash, filePath) { /* ... */ }
  async save() { /* ... */ }
  clear() { /* ... */ }
}
```

## Cache File Management

- **Lazy Loading**: Cache is only loaded when incremental mode is enabled
- **Write Batching**: Cache is written at the end of formatting, not after each file
- **Atomic Writes**: Uses write-to-temp-then-rename pattern to prevent corruption
- **Size Limits**: Cache is pruned if it exceeds reasonable limits (e.g., 10,000 files)

## Cache Pruning Strategy

To prevent unbounded cache growth:

1. **LRU Eviction**: Remove least recently used entries when cache exceeds limit
2. **Age-Based Pruning**: Remove entries older than 30 days
3. **Smart Limits**: Keep cache under 10MB in size
