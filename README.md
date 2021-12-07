# Proma

A unreal engine blueprint inspired editor for javascript.

## WIP

- [x] show/use relevant libs for endpoint/node .proma files
- [ ] types for outlets
- [ ] run proma files with example payload (how to show relevan files? like html for web?)
- [ ] show main chip and sub chip properties
- [ ] register local chips in registry?
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
