# Proma

A unreal engine blueprint inspired editor for javascript.

## WIP


- [ ] show/use relevant libs for endpoint/node .proma files
      (`use: ['proma.com/lib/std@3.0', 'proma.com/lib/web']`)
  - [ ] always use a `registry.copy` when editing something
  - [ ] add `edit.addUse`/`edit.removeUse` to modify `use` for chip
  - [ ] deserialize should add `use` to the registry.copy. NOTE that `fromJSON` must become async because partial URIs can not be constructed if `use` is not resolved first
  - [ ] serialize should add `use`? if original chip had it? registry should know? prop not, is a chip thing
  - [ ] update frontend to use new library
- [ ] run proma files with example payload (how to show relevan files? like html for web?)
- [ ] register local chips in registry?
- [ ] add new endpoint .proma
- [ ] DOM node chip? basically you enter html with `{port}` and we return an updating DOM (created, updated then ports + element)
- [ ] example project selector / select from local stored
- [ ] 3d game scripting?
- [ ] use esbuild instead of rollup: new plugin to add `exec.toString` to avoid minification problems

## ideas

- need context menu for adding, removing, renaming files
- need a way to change imports/other props of proma files (maybe later)
- preview of current file
- hold a preview to use it in a different file (ie: hold html preview to drag drop refs in proma script)
