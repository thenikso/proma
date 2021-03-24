import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  Chip,
  edit,
} from '../core/index.mjs';
import { ExternalReference } from '../core/external.mjs';

export function compileAndRun(build, run, initData, externalContext) {
  // Create chip
  const C = build.__proto__ === Chip ? build : chip('TestChip', build);
  if (run === false) {
    return C.compile();
  }
  // Default run to capture console.log
  const originalLog = console.log;
  // Prepare for live logs capture
  const liveLogs = [];
  console.log = (msg) => liveLogs.push(msg);
  // Instantiate chip
  const c = new C(...(initData || []));
  // Prepare for compiled logs capture
  const compLogs = [];
  console.log = (msg) => compLogs.push(msg);
  // Create compiled chip
  let error;
  let code;
  try {
    code = c.compile();
  } catch (compileError) {
    error = compileError;
  }
  let cComp;
  if (!error) {
    try {
      let compInitData = (initData || []).slice();
      if (!externalContext && initData) {
        compInitData = [];
        externalContext = {};
        for (const data of initData) {
          if (data instanceof ExternalReference) {
            externalContext[data.reference] = data.value;
            compInitData.push(undefined);
          } else {
            compInitData.push(data);
          }
        }
      }
      const imports = Object.entries(C.imports).map(([name, url]) => [
        name,
        import(url).then((m) => m.default || m),
      ]);
      const importsNames = imports.map(([name]) => name);
      const context = [...Object.entries(externalContext || {}), ...imports];
      const contextNames = context.map(([key]) => key);
      const contextValues = context.map(([, value]) => value);
      const makeClass = new Function(...contextNames, 'return (' + code + ')');
      if (contextValues.some((v) => v instanceof Promise)) {
        cComp = Promise.all(contextValues).then((contextValues) => {
          const CClass = makeClass(...contextValues);
          return new CClass(...compInitData);
        });
      } else {
        const CClass = makeClass(...contextValues);
        cComp = new CClass(...compInitData);
      }
    } catch (e) {
      console.log = originalLog;
      console.log(code);
      throw e;
    }
  }
  // Run tests
  let live;
  let comp;
  if (typeof run === 'function') {
    console.log = (msg) => liveLogs.push(msg);
    live = run(c, liveLogs);
    const runComp = () => {
      console.log = (msg) => compLogs.push(msg);
      if (cComp instanceof Promise) {
        comp = cComp.then((cComp) => run(cComp, compLogs));
      } else {
        comp = cComp ? run(cComp, compLogs) : undefined;
      }
    };
    if (live instanceof Promise) {
      live = live
        .catch((e) => e)
        .then((l) => {
          runComp();
          return l;
        });
    } else {
      runComp();
    }
  } else {
    live = liveLogs;
    comp =
      cComp instanceof Promise
        ? cComp.then(() => compLogs)
        : cComp
        ? compLogs
        : undefined;
  }
  // Return async results
  if (live instanceof Promise || comp instanceof Promise) {
    return Promise.race([
      timeout(5000),
      Promise.resolve(live).then((l) =>
        Promise.resolve(comp).then((c) => [l, c]),
      ),
    ])
      .then(([l, c]) => ({
        code: error || code,
        live: l,
        comp: c,
      }))
      .finally((d) => {
        console.log = originalLog;
        return d;
      });
  }
  // Cleanup
  console.log = originalLog;
  // Return results
  return {
    code: error || code,
    live,
    comp,
  };
}

export function editCompileAndRun(edit, run, initData) {
  const C = chip('EditChip');
  const e = edit(C);
  edit(e);
  return compileAndRun(C, run, initData);
}

export function compileAndRunResult(code, value) {
  const isError = code instanceof Error;
  return {
    code,
    live: isError ? code : value,
    comp: isError ? undefined : value,
  };
}

export function js(strings, ...data) {
  let res = strings[0];
  for (let i = 0, l = data.length; i < l; i++) {
    res += String(data[i]) + strings[i + 1];
  }
  return dedent(res);
}

function timeout(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error(`timed out (${time / 1000}s)`)), time);
  });
}

// https://github.com/dmnd/dedent
export function dedent(strings) {
  // $FlowFixMe: Flow doesn't undestand .raw
  var raw = typeof strings === 'string' ? [strings] : strings.raw;

  // first, perform interpolation
  var result = '';
  for (var i = 0; i < raw.length; i++) {
    result += raw[i]
      // join lines when there is a suppressed newline
      .replace(/\\\n[ \t]*/g, '')
      // handle escaped backticks
      .replace(/\\`/g, '`');

    if (i < (arguments.length <= 1 ? 0 : arguments.length - 1)) {
      result += arguments.length <= i + 1 ? undefined : arguments[i + 1];
    }
  }

  // now strip indentation
  var lines = result.split('\n');
  var mindent = null;
  lines.forEach(function (l) {
    var m = l.match(/^(\s+)\S+/);
    if (m) {
      var indent = m[1].length;
      if (!mindent) {
        // this is the first indented line
        mindent = indent;
      } else {
        mindent = Math.min(mindent, indent);
      }
    }
  });

  if (mindent !== null) {
    (function () {
      var m = mindent; // appease Flow
      result = lines
        .map(function (l) {
          return l[0] === ' ' ? l.slice(m) : l;
        })
        .join('\n');
    })();
  }

  return (
    result
      // dedent eats leading and trailing whitespace too
      .trim()
      // handle escaped newlines at the end to ensure they don't get stripped too
      .replace(/\\n/g, '\n')
  );
}
