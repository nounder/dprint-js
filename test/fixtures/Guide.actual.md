#   Getting   Started   Guide


##   Installation

```bash
npm   install   dprint-js
#   or
bun   install   dprint-js
```


##   Usage


###   Initialize   Configuration

```bash
dprint-js   init
```


###   Format   Files

```bash
dprint-js   fmt
```


###   Check   Formatting

```bash
dprint-js   check
```


##   Configuration

Edit   `dprint.json`   to   customize   formatting:

```json
{"typescript":{"indentWidth":2,"lineWidth":120},"json":{"indentWidth":2}}
```


##   Advanced


###   Custom   Patterns

```bash
dprint-js   fmt   src/**/*.ts
dprint-js   check   --   lib/**/*.js   test/**/*.ts
```


###   CI   Integration

```bash
dprint-js   check   ||   exit   1
```
