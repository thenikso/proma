# Proma

A unreal engine blueprint inspired editor for javascript.

## WIP

- [x] file explorer
- [x] ui with file explorer
- [x] download as zip with jszip and file-saver
- [x] playground editor for proma files
- [x] index file to start server, try downloaded
- [x] download project as express server
- [x] frontend .proma files
- [x] html page editor (codemirror)
- [x] saves changes in local storage
- [x] fix: if no file selected, tree view is broken
- [x] select local storage projects or create a new one
- [ ] show/use relevant libs for endpoint/node .proma files (`target: node/web`? better: `use: ['proma.com/lib/prelude@3.0', 'proma.com/lib/html']`)
  - [x] build new registry that can be instantiated
  - [x] move async to `use` instead of loadable chips (as a concept)
  - [ ] refactor embedded libs to be standard,node,web
  - [ ] load standard library by default
  - [ ] resolvers for other embeeded libs (node, web)
  - [ ] use new registry in `edit`
  - [ ] remove old registry
  - [ ] remove old embedded libs
  - [ ] serialize should use qualified URIs
  - in registry viewer cut the common part/the `use` to show shortened names/folders
  - maybe the registry should know where it loads a lib from, and the lib can just have local names
- [ ] run proma files with example payload (how to show relevan files? like html for web?)
- [ ] add new endpoint .proma
- [ ] DOM node chip? basically you enter html with `{port}` and we return an updating DOM (created, updated then ports + element)
- [ ] example project selector / select from local stored
- [ ] 3d game scripting?

## ideas
- need context menu for adding, removing, renaming files
- need a way to change imports/other props of proma files (maybe later)
- preview of current file
- hold a preview to use it in a different file (ie: hold html preview to drag drop refs in proma script)
