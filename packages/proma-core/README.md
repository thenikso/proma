# proma-core

The core compiler and runtime engine for the Proma visual programming language.

## Overview

`proma-core` is the foundation of Proma, providing:

- **Visual programming primitives** - Chips, ports, and wires for building node-based programs
- **JavaScript compiler** - Transforms visual programs into executable JavaScript code
- **Runtime engine** - Executes compiled programs with scope management
- **Type system** - Rich type checking and inference
- **Standard libraries** - Built-in chips for common operations
- **Serialization** - Save and load programs as JSON
- **Edit API** - Programmatically create and modify chip graphs

## Installation

```bash
npm install @proma/core
# or
pnpm add @proma/core
```

## Quick Start

### Creating a Simple Chip

```javascript
import { chip, inputData, outputData } from '@proma/core';

// Define a chip that greets someone
const Greeting = chip('Greeting', () => {
  const name = inputData('name', { canonical: true });
  const message = outputData('message', () => `Hello ${name()}!`);
});

// Use the chip
const greeter = new Greeting('World');
console.log(greeter.message); // "Hello World!"
```

### Creating a Chip with Execution Flow

```javascript
import { chip, inputFlow, outputFlow, inputData } from '@proma/core';

const Logger = chip('Logger', () => {
  const exec = inputFlow('exec', () => {
    console.log('Message:', message());
    then();
  });

  const message = inputData('message', { canonical: true });
  const then = outputFlow('then');
});

// Execute the chip
const logger = new Logger('Hello from Proma!');
logger.exec();
```

### Connecting Chips Together

```javascript
import { chip, inputFlow, outputFlow, inputData, outputData, wire } from '@proma/core';

const ChipA = chip('ChipA', () => {
  const exec = inputFlow('exec', () => {
    result(42);
    then();
  });
  const result = outputData('result');
  const then = outputFlow('then');
});

const ChipB = chip('ChipB', () => {
  const exec = inputFlow('exec', () => {
    console.log('Received:', input());
    then();
  });
  const input = inputData('input');
  const then = outputFlow('then');
});

// Create a composite chip that wires A to B
const Composite = chip('Composite', () => {
  const exec = inputFlow('exec', () => {
    a.exec();
  });

  const a = ChipA();
  const b = ChipB();

  // Wire A's output to B's input
  wire(a.result, b.input);

  // Wire A's then to B's exec
  wire(a.then, b.exec);

  const done = outputFlow('done');
  wire(b.then, done);
});

// Execute the composite chip
const composite = new Composite();
composite.exec(); // Logs: "Received: 42"
```

## Core Concepts

### Chips

Chips are the fundamental building blocks. A chip is defined using the `chip()` function:

```javascript
const MyChip = chip('MyChip', () => {
  // Define ports and logic here
});
```

There are several types of chips:

- **Pure chips** - Compute values without side effects (no flow ports)
- **Flow chips** - Execute logic with flow control (have execution flow)
- **Event chips** - Respond to events (created with `event()`)
- **Composite chips** - Contain other chips (created by instantiating chips inside)

### Ports

Ports are inputs and outputs on chips. There are four types:

#### Input Flow Ports

Execution entry points. When called, they execute the provided function:

```javascript
const exec = inputFlow('exec', () => {
  // This runs when exec() is called
  console.log('Executing!');
  then();
});
```

#### Output Flow Ports

Execution continuation points. Call them to continue execution:

```javascript
const then = outputFlow('then');

// In a flow function:
then(); // Continues execution
```

#### Input Data Ports

Data inputs. Call them to get the current value:

```javascript
const name = inputData('name', { canonical: true });

// Use the value:
console.log(name()); // Gets the current value
```

Options:
- `canonical: true` - Makes this a constructor parameter
- `type` - Specify the expected type
- `variadic: true` - Accept variable number of inputs

#### Output Data Ports

Data outputs. Can be computed from a function:

```javascript
const doubled = outputData('doubled', () => input() * 2);

// Access the value:
console.log(doubled); // Automatically computed
```

### Wiring

Connect ports using `wire()`:

```javascript
const a = ChipA();
const b = ChipB();

// Wire data output to data input
wire(a.output, b.input);

// Wire flow output to flow input
wire(a.then, b.exec);
```

### Types

Proma has a rich type system:

```javascript
import { types } from '@proma/core';

// Primitive types
types.string
types.number
types.boolean
types.any

// Complex types
types.object({ name: types.string, age: types.number })
types.array(types.number)
types.tuple([types.string, types.number])
types.function([types.number], types.string) // args, return

// Using types in ports
const num = inputData('num', { type: types.number });
```

### Registry

The registry manages available chips for projects:

```javascript
import { registry } from '@proma/core';

// Use a library
registry.use('proma/std');

// Get a chip by URI
const LogChip = registry.get('proma/std#Log');

// Register custom chips
registry.register('mylib#MyChip', MyChip);
```

Built-in libraries:
- `proma/std` - Standard utilities
- `proma/web` - Browser APIs
- `proma/node` - Node.js APIs

## Standard Library

### proma/std

Common utility chips:

- **Literal** - Constant values
- **GetProperty** - Get object property
- **SetProperty** - Set object property
- **GetPropertyAtPath** - Get nested property (e.g., "a.b.c")
- **ToString** - Convert to string
- **Equal** - Equality comparison
- **string/Append** - Concatenate strings
- **flowControl/Sequence** - Execute chips in sequence
- **flowControl/Branch** - Conditional branching
- **flowControl/ForEach** - Iterate over arrays
- **debug/Log** - Console logging

### proma/web

Browser-specific chips:

- **html/BindEvent** - DOM event binding
- **html/QuerySelector** - DOM queries
- **network/FetchJson** - HTTP requests

### proma/node

Node.js-specific chips:

- **network/FetchJson** - HTTP requests (using node-fetch)

## Advanced Features

### Compilation

Compile chips to JavaScript code:

```javascript
const MyChip = chip('MyChip', () => {
  const exec = inputFlow('exec', () => {
    output(input() + 1);
    then();
  });
  const input = inputData('input', { canonical: true });
  const output = outputData('output');
  const then = outputFlow('then');
});

// Compile to JavaScript string
const code = MyChip.compile();
console.log(code); // JavaScript class code

// Compile with custom wrapper
import { ClassWrapper } from '@proma/core/core/wrapper.mjs';
const customCode = MyChip.compile({ wrapper: ClassWrapper });
```

### Serialization

Save and load chips as JSON:

```javascript
import { fromJSON } from '@proma/core';

// Get JSON representation
const json = myChipInstance.$info.toJSON();

// Save to file
const jsonString = JSON.stringify(json, null, 2);

// Load from JSON
const restored = await fromJSON(json);
const instance = new restored();
```

### Edit API

Programmatically edit chip graphs:

```javascript
import { edit } from '@proma/core';

const editor = edit(myChipInfo);

// Listen to changes
editor.on('change', () => {
  console.log('Chip was modified');
});

// Add a sub-chip
editor.addChip('subChipId', SomeChip, { x: 100, y: 100 });

// Add a connection
editor.connect(
  'chipA', 'outputPort',
  'chipB', 'inputPort'
);

// Remove a connection
editor.disconnect('chipA', 'outputPort', 'chipB', 'inputPort');

// Remove a chip
editor.removeChip('subChipId');
```

### Debugging

Debug chip execution:

```javascript
import { debug } from '@proma/core';

const myChip = new MyChip();
myChip.exec();

// Create debugger
const debugger = debug(myChip);

// Access runtime values
console.log(debugger.somePort.$runValue); // Last executed value
```

### External References

Access external data in chips:

```javascript
import { chip, externalRef, externalGet, externalSet } from '@proma/core';

const Counter = chip('Counter', () => {
  const count = externalRef('count', 0);

  const increment = inputFlow('increment', () => {
    externalSet(count, externalGet(count) + 1);
    then();
  });

  const value = outputData('value', () => externalGet(count));
  const then = outputFlow('then');
});

const counter = new Counter();
console.log(counter.value); // 0
counter.increment();
console.log(counter.value); // 1
```

### Event Chips

Create event-driven chips:

```javascript
import { event, inputData, outputFlow } from '@proma/core';

const Timer = event('Timer', () => {
  const interval = inputData('interval', { canonical: true });
  const tick = outputFlow('tick');

  // Event chips have setup/teardown hooks
  return {
    setup: (ctx) => {
      ctx.intervalId = setInterval(() => tick(), interval());
    },
    teardown: (ctx) => {
      clearInterval(ctx.intervalId);
    }
  };
});

const timer = new Timer(1000);
timer.setup(); // Starts ticking every second
// ... later
timer.teardown(); // Stops the timer
```

### Switch Chips

Create switch/case logic:

```javascript
import { switchChip, inputData, outputFlow } from '@proma/core';

const NumberSwitch = switchChip('NumberSwitch', {
  discriminator: () => inputData('value', { canonical: true }),
  cases: {
    'zero': (value) => value() === 0,
    'positive': (value) => value() > 0,
    'negative': (value) => value() < 0
  }
});

const sw = new NumberSwitch(5);
sw.exec();
// Will execute the 'positive' case
```

## API Reference

### Main Exports

```javascript
// Chip creation
export { chip, plainChip, event, switchChip } from './api.mjs';

// Port creation
export { inputFlow, outputFlow, inputData, outputData } from './api.mjs';

// Wiring
export { wire } from './api.mjs';

// External references
export { externalRef, externalGet, externalSet } from './api.mjs';

// Chip class
export { Chip } from './chip.mjs';

// Libraries
export * as library from './library/index.mjs';

// Registry
export { registry } from './registry.mjs';

// Serialization
export { fromJSON } from './deserialize.mjs';

// Editing
export { edit } from './edit.mjs';

// Debugging
export { debug } from './debug.mjs';

// Types
export { types } from './types.mjs';
```

### ChipInfo API

Every chip has a `$info` property with metadata:

```javascript
const chip = MyChip();

chip.$info.name          // Chip name
chip.$info.uri           // Chip URI (if registered)
chip.$info.inputs        // Map of input ports
chip.$info.outputs       // Map of output ports
chip.$info.subChips      // Map of sub-chips
chip.$info.connections   // Array of connections
chip.$info.metadata      // Custom metadata (e.g., position)

// Serialization
chip.$info.toJSON()      // Serialize to JSON
```

## Building

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Start development server (serves test.html)
pnpm dev
```

The package builds to:
- `dist/index.mjs` - ES module
- `dist/index.js` - UMD module (for browsers)

## Architecture

### Compiler Pipeline

1. **Parse** - Analyze chip graph structure
2. **Generate AST** - Use Recast to create JavaScript AST
3. **Optimize** - Inline variables, eliminate dead code
4. **Emit** - Generate JavaScript code string

### Runtime Execution

1. **Scope creation** - Each chip instance gets a scope
2. **Port function creation** - Ports become callable functions
3. **Execution** - Flow ports execute their logic
4. **Value propagation** - Data flows through wired connections

### Type System

- **Type matching** - Check if types are compatible
- **Type inference** - Deduce types from usage
- **Generic parameters** - Support parameterized types
- **Runtime checking** - Optional runtime type validation

## Development

### Project Structure

```
proma-core/
├── core/
│   ├── api.mjs              # Public API
│   ├── chip.mjs             # Chip class and ChipInfo
│   ├── ports.mjs            # Port classes
│   ├── compile.mjs          # Compiler
│   ├── run.mjs              # Runtime
│   ├── types.mjs            # Type system
│   ├── registry.mjs         # Chip registry
│   ├── serialize.mjs        # JSON serialization
│   ├── deserialize.mjs      # JSON deserialization
│   ├── edit.mjs             # Edit API
│   ├── debug.mjs            # Debugging utilities
│   ├── wrapper.mjs          # Code generation wrapper
│   └── library/             # Standard libraries
│       ├── std/             # Standard library
│       ├── web/             # Web APIs
│       └── node/            # Node.js APIs
├── dist/                    # Built files
├── rollup.config.js         # Build configuration
└── test.html                # Manual testing
```

### Contributing

1. Make changes in `core/` directory
2. Run `pnpm build` to compile
3. Test changes using `test.html` or automated tests
4. Ensure `pnpm lint` passes

## Examples

See [test.html](test.html) for interactive examples and the [library](core/library/) directory for reference implementations of various chip types.

## License

[Add license information]
