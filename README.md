# Proma

A unreal engine blueprint inspired editor for javascript.

## WIP

- [x] show/use relevant libs for endpoint/node .proma files
- [x] types for outlets (serialize/deserialize)
- [x] run proma files with example payload (how to show relevan files? like html for web?)
- [x] save test in metadata (or somewhere else?)
- [ ] show main chip  properties
  - [ ] edit input ports
  - [ ] edit ouptut ports
  - [ ] edit use array
  - [ ] edit board uri
- [ ] show sub chip properties
- [ ] add new endpoint .proma
- [ ] register local chips in registry / custom chip macros
- [ ] `:type({ example: string })` chips to build typed data. might need improved type library. could wrap functions to assert types at runtime, force casting on input data to build objects.
- [ ] show instance values when hovering port (and test is being run)
  - [x] add `$runValue` to all intermediate run ports
  - [x] create `debug` function to debug a chip instance
  - [ ] create `Tooltip` to show debug values when hovering a port
  - [ ] reset all `$runValue` when re-running/editing a chip/connections to avoid zombie values
- [ ] show chip errors in board (capture in port run and add as port property)
- [ ] select html target and show it when testing
- [ ] `fromJSON` now is a promise so `withErrors` should also have registry misses errors and maybe even allow the user to resolve errors if possible
- [ ] DOM node chip? basically you enter html with `{port}` and we return an updating DOM (created, updated then ports + element)
- [ ] example project selector / select from local stored
- [ ] 3d game scripting?
- [ ] use esbuild instead of rollup: new plugin to add `exec.toString` to avoid minification problems

## ideas

- need context menu for adding, removing, renaming files
- need a way to change imports/other props of proma files (maybe later)
- preview of current file
- hold a preview to use it in a different file (ie: hold html preview to drag drop refs in proma script)
