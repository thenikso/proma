export class EditHistory {
  constructor(editor) {
    this._editor = editor;
    this._undoStack = [];
    this._redoStack = [];
    this._groupStack = [];
    this._inGroup = false;
    this._replaying = false;
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  get undoCount() {
    return this._undoStack.length;
  }

  get redoCount() {
    return this._redoStack.length;
  }

  get isReplaying() {
    return this._replaying;
  }

  undo() {
    if (!this.canUndo) return this;
    const command = this._undoStack.pop();
    this._replaying = true;
    try {
      command.undo();
    } finally {
      this._replaying = false;
    }
    this._redoStack.push(command);
    return this;
  }

  redo() {
    if (!this.canRedo) return this;
    const command = this._redoStack.pop();
    this._replaying = true;
    try {
      command.execute();
    } finally {
      this._replaying = false;
    }
    this._undoStack.push(command);
    return this;
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._groupStack = [];
    this._inGroup = false;
    return this;
  }

  beginGroup() {
    this._inGroup = true;
    this._groupStack.push([]);
    return this;
  }

  endGroup() {
    if (!this._inGroup || this._groupStack.length === 0) return this;
    const commands = this._groupStack.pop();
    if (this._groupStack.length === 0) {
      this._inGroup = false;
    }
    if (commands.length === 0) return this;
    const groupCommand = {
      description: 'group',
      execute() {
        for (const cmd of commands) {
          cmd.execute();
        }
      },
      undo() {
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].undo();
        }
      },
    };
    this._record(groupCommand);
    return this;
  }

  _record(command) {
    // Only clear redo stack when not inside a group (endGroup handles it for the outer)
    if (!this._inGroup) {
      this._redoStack = [];
    }
    if (this._inGroup && this._groupStack.length > 0) {
      this._groupStack[this._groupStack.length - 1].push(command);
    } else {
      this._undoStack.push(command);
    }
    return this;
  }
}
