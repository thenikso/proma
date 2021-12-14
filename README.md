# Proma

A unreal engine blueprint inspired editor for javascript.

## WIP

- [x] show/use relevant libs for endpoint/node .proma files
- [x] types for outlets (serialize/deserialize)
- [x] run proma files with example payload (how to show relevan files? like html for web?)
- [x] save test in metadata (or somewhere else?)
- [ ] show instance values when hovering port (and test is being run)
- [ ] show chip errors in board (capture in port run and add as port property)
- [ ] select html target and show it when testing
- [ ] fix: in `api.mjs#318` we run the onCreate when the chip is created even when deserializing chips.. that's not ok! we should only run them when instantiating the "out facing" chip. basically "sub-chips" should put their oncreate/destroy to the main chip (as it's done when compiling)
- [ ] show main chip and sub chip properties
- [ ] register local chips in registry / custom chip macros
- [ ] add new endpoint .proma
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
