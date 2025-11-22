/**
 * WASM Formatter Loader
 * Extracted from @dprint/formatter v0.4.1
 * This file contains the minimal code needed to load and interact with dprint WASM plugins
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * Creates a formatter from the specified streaming source.
 * @remarks This is the most efficient way to create a formatter.
 * @param {Response|Promise<Response>} responsePromise - The streaming source to create the formatter from.
 * @returns {Promise<object>} The formatter instance
 */
export async function createStreaming(responsePromise) {
  const response = await responsePromise;
  if (response.status !== 200) {
    throw new Error(
      `Unexpected status code: ${response.status}\n${await response.text()}`
    );
  }
  if (
    typeof WebAssembly.instantiateStreaming === "function" &&
    response.headers.get("content-type") === "application/wasm"
  ) {
    const module = await WebAssembly.compileStreaming(response);
    return createFromWasmModule(module);
  } else {
    // fallback for node.js or when the content type isn't application/wasm
    return response.arrayBuffer().then((buffer) => createFromBuffer(buffer));
  }
}

/**
 * Creates a formatter from the specified wasm module bytes.
 * @param {ArrayBuffer|Uint8Array} wasmModuleBuffer - The buffer of the wasm module.
 * @returns {object} The formatter instance
 */
export function createFromBuffer(wasmModuleBuffer) {
  const wasmModule = new WebAssembly.Module(wasmModuleBuffer);
  return createFromWasmModule(wasmModule);
}

/**
 * Creates a formatter from a compiled WASM module
 * @param {WebAssembly.Module} wasmModule - The compiled WASM module
 * @returns {object} The formatter instance
 */
function createFromWasmModule(wasmModule) {
  const version = getModuleVersionOrThrow(wasmModule);
  if (version === 3) {
    const host = createHostV3();
    const wasmInstance = new WebAssembly.Instance(
      wasmModule,
      host.createImportObject()
    );
    return createFromInstanceV3(wasmInstance, host);
  } else {
    // version 4
    const host = createHostV4();
    const wasmInstance = new WebAssembly.Instance(
      wasmModule,
      host.createImportObject()
    );
    return createFromInstanceV4(wasmInstance, host);
  }
}

/**
 * Get the plugin version from the WASM module
 * @param {WebAssembly.Module} module - The WASM module
 * @returns {number} The version number
 */
function getModuleVersionOrThrow(module) {
  const version = getModuleVersion(module);
  if (version == null) {
    throw new Error(
      "Couldn't determine dprint plugin version. Maybe the js-formatter version is too old?"
    );
  } else if (version === 3 || version === 4) {
    return version;
  } else if (version > 4) {
    throw new Error(
      `Unsupported new dprint plugin version '${version}'. Maybe the js-formatter version is too old?`
    );
  } else {
    throw new Error(
      `Unsupported old dprint plugin version '${version}'. Please upgrade the plugin.`
    );
  }
}

/**
 * Get the version number from the WASM module exports
 * @param {WebAssembly.Module} module - The WASM module
 * @returns {number|undefined} The version number or undefined
 */
function getModuleVersion(module) {
  function getVersionFromExport(name) {
    if (name === "get_plugin_schema_version") {
      return 3;
    }
    const prefix = "dprint_plugin_version_";
    if (name.startsWith(prefix)) {
      const value = parseInt(name.substring(prefix.length), 10);
      if (!isNaN(value)) {
        return value;
      }
    }
    return undefined;
  }
  const exports = WebAssembly.Module.exports(module);
  for (const e of exports) {
    const maybeVersion = getVersionFromExport(e.name);
    if (maybeVersion != null) {
      return maybeVersion;
    }
  }
  return undefined;
}

/**
 * Get a buffer view at a specific pointer in WASM memory
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @param {number} pointer - Memory pointer
 * @param {number} length - Buffer length
 * @returns {Uint8Array} The buffer view
 */
function getWasmBufferAtPointer(wasmInstance, pointer, length) {
  return new Uint8Array(wasmInstance.exports.memory.buffer, pointer, length);
}

// ========================================
// Version 3 Implementation
// ========================================

/**
 * Creates host for v3 plugins
 * @returns {object} The host object
 */
function createHostV3() {
  let instance;
  let hostFormatter = undefined;
  let overrideConfig = {};
  let filePath = "";
  let formattedText = "";
  let errorText = "";

  return {
    setInstance(wasmInstance) {
      instance = wasmInstance;
    },
    setHostFormatter(formatWithHost) {
      hostFormatter = formatWithHost;
    },
    createImportObject() {
      let sharedBuffer = new Uint8Array(0);
      let sharedBufferIndex = 0;
      const resetSharedBuffer = (length) => {
        sharedBuffer = new Uint8Array(length);
        sharedBufferIndex = 0;
      };

      return {
        dprint: {
          host_clear_bytes: (length) => {
            resetSharedBuffer(length);
          },
          host_read_buffer: (pointer, length) => {
            sharedBuffer.set(
              getWasmBufferAtPointer(instance, pointer, length),
              sharedBufferIndex
            );
            sharedBufferIndex += length;
          },
          host_write_buffer: (pointer, index, length) => {
            getWasmBufferAtPointer(instance, pointer, length).set(
              sharedBuffer.slice(index, index + length)
            );
          },
          host_take_file_path: () => {
            filePath = decoder.decode(sharedBuffer);
            resetSharedBuffer(0);
          },
          host_take_override_config: () => {
            overrideConfig = JSON.parse(decoder.decode(sharedBuffer));
            resetSharedBuffer(0);
          },
          host_format: () => {
            const fileText = decoder.decode(sharedBuffer);
            try {
              formattedText =
                hostFormatter?.({
                  filePath,
                  fileText,
                  overrideConfig,
                }) ?? fileText;
              return fileText === formattedText ? 0 : 1;
            } catch (error) {
              errorText = String(error);
              return 2;
            }
          },
          host_get_formatted_text: () => {
            sharedBuffer = encoder.encode(formattedText);
            sharedBufferIndex = 0;
            return sharedBuffer.length;
          },
          host_get_error_text: () => {
            sharedBuffer = encoder.encode(errorText);
            sharedBufferIndex = 0;
            return sharedBuffer.length;
          },
        },
      };
    },
  };
}

/**
 * Create formatter from v3 WASM instance
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @param {object} host - The host object
 * @returns {object} The formatter instance
 */
function createFromInstanceV3(wasmInstance, host) {
  host.setInstance(wasmInstance);
  const wasmExports = wasmInstance.exports;
  const {
    get_plugin_schema_version,
    set_file_path,
    set_override_config,
    get_formatted_text,
    format,
    get_error_text,
    get_plugin_info,
    get_resolved_config,
    get_config_diagnostics,
    set_global_config,
    set_plugin_config,
    get_license_text,
    reset_config,
  } = wasmExports;

  const pluginSchemaVersion = get_plugin_schema_version();
  const expectedPluginSchemaVersion = 3;
  if (
    pluginSchemaVersion !== 2 &&
    pluginSchemaVersion !== expectedPluginSchemaVersion
  ) {
    throw new Error(
      `Not compatible plugin. ` +
        `Expected schema ${expectedPluginSchemaVersion}, ` +
        `but plugin had ${pluginSchemaVersion}.`
    );
  }

  let configSet = false;

  return {
    setConfig(globalConfig, pluginConfig) {
      setConfig(globalConfig, pluginConfig);
    },
    getConfigDiagnostics() {
      setConfigIfNotSet();
      const length = get_config_diagnostics();
      return JSON.parse(receiveString(wasmInstance, length));
    },
    getResolvedConfig() {
      setConfigIfNotSet();
      const length = get_resolved_config();
      return JSON.parse(receiveString(wasmInstance, length));
    },
    getFileMatchingInfo() {
      const length = get_plugin_info();
      const pluginInfo = JSON.parse(receiveString(wasmInstance, length));
      return {
        fileExtensions: pluginInfo.fileExtensions ?? [],
        fileNames: pluginInfo.fileNames ?? [],
      };
    },
    getPluginInfo() {
      const length = get_plugin_info();
      const pluginInfo = JSON.parse(receiveString(wasmInstance, length));
      delete pluginInfo.fileNames;
      delete pluginInfo.fileExtensions;
      return pluginInfo;
    },
    getLicenseText() {
      const length = get_license_text();
      return receiveString(wasmInstance, length);
    },
    formatText(request, formatWithHost) {
      if (request.bytesRange != null) {
        // not supported for v3
        return request.fileText;
      }
      host.setHostFormatter(formatWithHost);
      setConfigIfNotSet();
      if (request.overrideConfig != null) {
        if (pluginSchemaVersion === 2) {
          throw new Error(
            "Cannot set the override configuration for this old plugin."
          );
        }
        sendString(wasmInstance, JSON.stringify(request.overrideConfig));
        set_override_config();
      }
      sendString(wasmInstance, request.filePath);
      set_file_path();
      sendString(wasmInstance, request.fileText);
      const responseCode = format();
      switch (responseCode) {
        case 0: // no change
          return request.fileText;
        case 1: // change
          return receiveString(wasmInstance, get_formatted_text());
        case 2: // error
          throw new Error(receiveString(wasmInstance, get_error_text()));
        default:
          throw new Error(`Unexpected response code: ${responseCode}`);
      }
    },
  };

  function setConfigIfNotSet() {
    if (!configSet) {
      setConfig({}, {});
    }
  }

  function setConfig(globalConfig, pluginConfig) {
    if (reset_config != null) {
      reset_config();
    }
    sendString(wasmInstance, JSON.stringify(globalConfig));
    set_global_config();
    sendString(wasmInstance, JSON.stringify(pluginConfig));
    set_plugin_config();
    configSet = true;
  }
}

/**
 * Send a string to v3 WASM instance
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @param {string} text - The text to send
 */
function sendString(wasmInstance, text) {
  const exports = wasmInstance.exports;
  const encodedText = encoder.encode(text);
  const length = encodedText.length;
  const memoryBufferSize = exports.get_wasm_memory_buffer_size();
  const memoryBufferPointer = getWasmMemoryBufferPointer(wasmInstance);
  exports.clear_shared_bytes(length);
  let index = 0;
  while (index < length) {
    const writeCount = Math.min(length - index, memoryBufferSize);
    const wasmBuffer = getWasmBufferAtPointer(
      wasmInstance,
      memoryBufferPointer,
      writeCount
    );
    wasmBuffer.set(encodedText.slice(index, index + writeCount));
    exports.add_to_shared_bytes_from_buffer(writeCount);
    index += writeCount;
  }
  return length;
}

/**
 * Receive a string from v3 WASM instance
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @param {number} length - The length of the string
 * @returns {string} The received string
 */
function receiveString(wasmInstance, length) {
  const exports = wasmInstance.exports;
  const memoryBufferSize = exports.get_wasm_memory_buffer_size();
  const memoryBufferPointer = getWasmMemoryBufferPointer(wasmInstance);
  const buffer = new Uint8Array(length);
  let index = 0;
  while (index < length) {
    const readCount = Math.min(length - index, memoryBufferSize);
    exports.set_buffer_with_shared_bytes(index, readCount);
    const wasmBuffer = getWasmBufferAtPointer(
      wasmInstance,
      memoryBufferPointer,
      readCount
    );
    buffer.set(wasmBuffer, index);
    index += readCount;
  }
  return decoder.decode(buffer);
}

/**
 * Get the WASM memory buffer pointer for v3
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @returns {number} The memory buffer pointer
 */
function getWasmMemoryBufferPointer(wasmInstance) {
  return wasmInstance.exports.get_wasm_memory_buffer();
}

// ========================================
// Version 4 Implementation
// ========================================

/**
 * Write to stderr (simplified version)
 * @param {Uint8Array} buf - The buffer to write
 */
function writeStderr(buf) {
  try {
    if (globalThis.Deno) {
      globalThis.Deno.stderr.writeSync(buf);
    } else if (globalThis.process) {
      globalThis.process.stderr.write(buf);
    }
    // ignore if neither available
  } catch {
    // ignore errors
  }
}

/**
 * Creates host for v4 plugins
 * @returns {object} The host object
 */
function createHostV4() {
  let instance;
  let hostFormatter = undefined;
  let formattedText = "";
  let errorText = "";

  return {
    setInstance(wasmInstance) {
      instance = wasmInstance;
    },
    setHostFormatter(formatWithHost) {
      hostFormatter = formatWithHost;
    },
    createImportObject() {
      let sharedBuffer = new Uint8Array(0);
      return {
        env: {
          fd_write: (fd, iovsPtr, iovsLen, nwrittenPtr) => {
            let totalWritten = 0;
            const wasmMemoryBuffer = instance.exports.memory.buffer;
            const dataView = new DataView(wasmMemoryBuffer);
            for (let i = 0; i < iovsLen; i++) {
              const iovsOffset = iovsPtr + i * 8;
              const iovecBufPtr = dataView.getUint32(iovsOffset, true);
              const iovecBufLen = dataView.getUint32(iovsOffset + 4, true);
              const buf = new Uint8Array(
                wasmMemoryBuffer,
                iovecBufPtr,
                iovecBufLen
              );
              if (fd === 1 || fd === 2) {
                // just write both stdout and stderr to stderr
                writeStderr(buf);
              } else {
                return 1; // not supported fd
              }
              totalWritten += iovecBufLen;
            }
            dataView.setUint32(nwrittenPtr, totalWritten, true);
            return 0; // success
          },
        },
        dprint: {
          host_has_cancelled: () => 0,
          host_write_buffer: (pointer) => {
            getWasmBufferAtPointer(instance, pointer, sharedBuffer.length).set(
              sharedBuffer
            );
          },
          host_format: (
            filePathPtr,
            filePathLen,
            rangeStart,
            rangeEnd,
            overrideConfigPtr,
            overrideConfigLen,
            fileBytesPtr,
            fileBytesLen
          ) => {
            const filePath = receiveStringV4(filePathPtr, filePathLen);
            const overrideConfigRaw = receiveStringV4(
              overrideConfigPtr,
              overrideConfigLen
            );
            const overrideConfig =
              overrideConfigRaw === "" ? {} : JSON.parse(overrideConfigRaw);
            const fileText = receiveStringV4(fileBytesPtr, fileBytesLen);
            const bytesRange =
              rangeStart === 0 && rangeEnd === fileBytesLen
                ? undefined
                : [rangeStart, rangeEnd];
            try {
              formattedText =
                hostFormatter?.({
                  filePath,
                  fileText,
                  bytesRange,
                  overrideConfig,
                }) ?? fileText;
              return fileText === formattedText ? 0 : 1;
            } catch (error) {
              errorText = String(error);
              return 2;
            }
          },
          host_get_formatted_text: () => {
            sharedBuffer = encoder.encode(formattedText);
            return sharedBuffer.length;
          },
          host_get_error_text: () => {
            sharedBuffer = encoder.encode(errorText);
            return sharedBuffer.length;
          },
        },
      };

      function receiveStringV4(ptr, length) {
        return decoder.decode(getWasmBufferAtPointer(instance, ptr, length));
      }
    },
  };
}

/**
 * Create formatter from v4 WASM instance
 * @param {WebAssembly.Instance} wasmInstance - The WASM instance
 * @param {object} host - The host object
 * @returns {object} The formatter instance
 */
function createFromInstanceV4(wasmInstance, host) {
  host.setInstance(wasmInstance);
  // only a single config is supported in here atm
  const configId = 1;
  const wasmExports = wasmInstance.exports;
  const {
    get_shared_bytes_ptr,
    set_file_path,
    set_override_config,
    clear_shared_bytes,
    get_formatted_text,
    format,
    format_range,
    get_error_text,
    get_plugin_info,
    get_config_file_matching,
    get_resolved_config,
    get_config_diagnostics,
    get_license_text,
    register_config,
    release_config,
  } = wasmExports;

  let configSet = false;

  return {
    setConfig(globalConfig, pluginConfig) {
      setConfig(globalConfig, pluginConfig);
    },
    getConfigDiagnostics() {
      setConfigIfNotSet();
      const length = get_config_diagnostics(configId);
      return JSON.parse(receiveStringV4(length));
    },
    getResolvedConfig() {
      setConfigIfNotSet();
      const length = get_resolved_config(configId);
      return JSON.parse(receiveStringV4(length));
    },
    getFileMatchingInfo() {
      const length = get_config_file_matching(configId);
      return JSON.parse(receiveStringV4(length));
    },
    getPluginInfo() {
      const length = get_plugin_info();
      return JSON.parse(receiveStringV4(length));
    },
    getLicenseText() {
      const length = get_license_text();
      return receiveStringV4(length);
    },
    formatText(request, formatWithHost) {
      if (request.bytesRange != null && format_range == null) {
        // plugin doesn't support range formatting
        return request.fileText;
      }
      host.setHostFormatter(formatWithHost);
      setConfigIfNotSet();
      if (request.overrideConfig != null) {
        sendStringV4(JSON.stringify(request.overrideConfig));
        set_override_config();
      }
      sendStringV4(request.filePath);
      set_file_path();
      sendStringV4(request.fileText);
      const responseCode =
        request.bytesRange != null
          ? format_range(configId, request.bytesRange[0], request.bytesRange[1])
          : format(configId);
      switch (responseCode) {
        case 0: // no change
          return request.fileText;
        case 1: // change
          return receiveStringV4(get_formatted_text());
        case 2: // error
          throw new Error(receiveStringV4(get_error_text()));
        default:
          throw new Error(`Unexpected response code: ${responseCode}`);
      }
    },
  };

  function setConfigIfNotSet() {
    if (!configSet) {
      setConfig({}, {});
    }
  }

  function setConfig(globalConfig, pluginConfig) {
    release_config(configId);
    sendStringV4(
      JSON.stringify({
        global: globalConfig,
        plugin: pluginConfig,
      })
    );
    register_config(configId);
    configSet = true;
  }

  function sendStringV4(value) {
    const bytes = encoder.encode(value);
    const ptr = clear_shared_bytes(bytes.length);
    getWasmBufferAtPointer(wasmInstance, ptr, bytes.length).set(bytes);
  }

  function receiveStringV4(length) {
    const ptr = get_shared_bytes_ptr();
    return decoder.decode(getWasmBufferAtPointer(wasmInstance, ptr, length));
  }
}
