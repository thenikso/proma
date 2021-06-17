import recast from '../vendor/recast.mjs';
import { info } from './utils.mjs';
import { ExternalReference } from './external.mjs';

const {
  parse,
  types: { namedTypes, visit, builders },
} = recast;

export function literalCompiler(value) {
  if (value instanceof ExternalReference) {
    return builders.identifier(value.reference);
  }
  switch (typeof value) {
    case 'undefined':
      return builders.identifier('undefined');
    case 'string':
      return builders.stringLiteral(value);
    case 'number':
    case 'boolean':
      return builders.literal(value);
    case 'object':
      if (!value) {
        return builders.nullLiteral();
      }
      if (Array.isArray(value)) {
        return builders.arrayExpression(value.map(literalCompiler));
      }
      if (value.constructor === Object) {
        return builders.objectExpression(
          Object.entries(value).map(([key, val]) =>
            builders.objectProperty(
              builders.identifier(key),
              literalCompiler(val),
            ),
          ),
        );
      }
    default:
      throw new Error(`Can not compile literal: ${value}`);
  }
}

export function getFunction(funcAst) {
  if (namedTypes.FunctionDeclaration.check(funcAst)) {
    return funcAst;
  } else if (
    namedTypes.ExpressionStatement.check(funcAst) &&
    namedTypes.ArrowFunctionExpression.check(funcAst.expression)
  ) {
    return funcAst.expression;
  }
  return null;
}

export function pathFromNodePath(nodePath) {
  const res = [];
  while (nodePath && nodePath.name !== null && nodePath.name !== 'root') {
    res.unshift(nodePath.name);
    nodePath = nodePath.parentPath;
  }
  return res;
}

export function getPath(obj, path) {
  let cursor = obj;
  for (let i = 0, l = path.length; i < l; i++) {
    const segment = path[i];
    if (!cursor) return cursor;
    cursor = cursor[segment];
  }
  return cursor;
}

export function replaceAstPath(obj, path, value) {
  if (!path || path.length === 0) {
    return value;
  }
  let cursor = obj;
  for (let i = 0, l = path.length; i < l; i++) {
    const segment = path[i];
    if (i === l - 1) {
      cursor[segment] = value;
      break;
    }
    cursor = cursor[segment];
  }
  return obj;
}

export function makeAstBuilder(portInfo, sourceProp = 'execute') {
  const chipInfo = portInfo.chipInfo;

  const replaceInputData = [];
  const replaceOutputFlows = [];
  const replaceOutputData = [];

  const func = getFunction(parse(String(portInfo[sourceProp])).program.body[0]);
  const async = func.async;

  visit(func.body, {
    visitCallExpression(path) {
      const callee = path.value.callee;
      if (namedTypes.Identifier.check(callee)) {
        // TODO consider name shadowing!
        const portName = callee.name;
        // Collect input data
        let sourcePortOutlet = chipInfo.getInputPortOutlet(portName);
        if (sourcePortOutlet) {
          if (info(sourcePortOutlet).isFlow) {
            throw new Error('Can not execute input flows!');
          }
          replaceInputData.push({
            portName,
            path: pathFromNodePath(path),
          });
          return false;
        }
        // Collect output flows and data
        sourcePortOutlet = chipInfo.getOutputPortOutlet(portName);
        if (sourcePortOutlet) {
          // Resolve potential arguments that may be other ports
          this.traverse(path);
          // Output flows
          if (info(sourcePortOutlet).isFlow) {
            // TODO check that it is used as a continuation, not an expression
            replaceOutputFlows.push({
              portName,
              path: pathFromNodePath(path),
            });
            return false;
          }
          // Output data, this is a case like `output(input() + 1)`
          const pathArray = pathFromNodePath(path);
          // Find the block body this output is used in. That might be used for
          // injecting output declarations later
          let scopeBlockPath = path.parentPath;
          const scopeTrail = [scopeBlockPath.value, path.value];
          while (!namedTypes.BlockStatement.check(scopeBlockPath.value)) {
            scopeBlockPath = scopeBlockPath.parentPath;
            scopeTrail.unshift(scopeBlockPath.value);
          }
          const scopeBlockBodyIndex = scopeBlockPath.value.body.findIndex((b) =>
            scopeTrail.includes(b),
          );
          replaceOutputData.push({
            portName,
            path: pathArray,
            argPath: [...pathArray, 'arguments', 0],
            scopeBlockPath: pathFromNodePath(scopeBlockPath),
            scopeBlockBodyIndex,
          });
          return false;
        }
      }
      this.traverse(path);
    },
  });

  const getAst = () =>
    getFunction(parse(String(portInfo[sourceProp])).program.body[0]).body;

  return function astBuilder({
    compileInputData,
    compileOutputFlow,
    compileOutputData,
  }) {
    let ast = getAst();

    for (const { portName, path } of replaceInputData) {
      const res = compileInputData(portName) || builders.noop();
      ast = replaceAstPath(ast, path, res);
    }

    for (const { portName, path } of replaceOutputFlows) {
      const res = compileOutputFlow(portName) || builders.noop();
      ast = replaceAstPath(ast, path, res);
    }

    // Blocks compiled by `compileOutputData` must always `blockStatement`s
    // with declarations and the last expression being a way to read the output
    // port. Declarations are saved in this `injectInScope` array to be injected
    // later
    const injectInScope = [];

    for (let {
      portName,
      path,
      argPath,
      scopeBlockPath,
      scopeBlockBodyIndex,
    } of replaceOutputData) {
      const argBlock = getPath(ast, argPath);
      const resultBlock =
        compileOutputData(portName, argBlock) ||
        builders.blockStatement([builders.noop()]);
      // Make sure that we are receiving a block statement that should be in the
      // form of:
      //     {
      //       delaration1...;
      //       declaration2...;
      //       readOutput;
      //     }
      namedTypes.BlockStatement.assert(resultBlock);
      // Extracting the last block statement as a way to ready the output port
      let readOutputStatement = resultBlock.body.pop();
      if (namedTypes.ExpressionStatement.check(readOutputStatement)) {
        readOutputStatement = readOutputStatement.expression;
      }
      // Add declarations to be injected in the block scope
      if (resultBlock.body.length > 0) {
        injectInScope.push({
          scopeBlockPath,
          scopeBlockBodyIndex,
          injectBlock: resultBlock,
        });
      }
      // If the destination is an expression, we do not need to actually read
      // the output, so we discard it and only use the declarations
      const astDestination = getPath(ast, path.slice(0, path.length - 1));
      if (
        namedTypes.ExpressionStatement.check(astDestination) &&
        resultBlock.body.length > 0
      ) {
        readOutputStatement = builders.noop();
      }

      ast = replaceAstPath(ast, path, readOutputStatement);
    }

    // Inject output declarations in the proper scope (that is, the scope of
    // the statement that used the output port)
    if (injectInScope.length > 0) {
      // Prepare injection cursors. These are on a per scope block basis and
      // inside there is a map of original insertion point to current cursors.
      // This allow for the insertion of output blocks just before the usage of
      // the output.
      const cursors = new Map();
      for (const { scopeBlockPath, scopeBlockBodyIndex } of injectInScope) {
        const scopeBlock = getPath(ast, scopeBlockPath);
        const cursorsByInsertionIndex = cursors.get(scopeBlock) || {};
        cursorsByInsertionIndex[scopeBlockBodyIndex] = scopeBlockBodyIndex;
        cursors.set(scopeBlock, cursorsByInsertionIndex);
      }
      // Inject
      for (const {
        scopeBlockPath,
        scopeBlockBodyIndex,
        injectBlock,
      } of injectInScope) {
        const scopeBlock = getPath(ast, scopeBlockPath);
        const cursorsByInsertionIndex = cursors.get(scopeBlock);
        const cursor = cursorsByInsertionIndex[scopeBlockBodyIndex];

        scopeBlock.body = [
          ...scopeBlock.body.slice(0, cursor),
          ...injectBlock.body,
          ...scopeBlock.body.slice(cursor),
        ];

        const injectionLength = injectBlock.body.length;
        for (const insertionIndex in cursorsByInsertionIndex) {
          if (insertionIndex >= cursors) {
            cursorsByInsertionIndex[insertionIndex] += injectionLength;
          }
        }

        cursors.set(scopeBlock, cursor);
      }
    }

    ast = cleanAst(ast);
    if (async) {
      ast = builders.arrowFunctionExpression([], ast);
      ast.async = true;
      ast = builders.callExpression(ast, []);
    }
    return ast;
  };
}

// Be careful with cleaning, you might remove code that the user
// intendet to have there like just `myObj.something;` could actually trigger
// a getter but we might be tempted to remove it here. Aim to produce clean
// code when compiling instead.
export function cleanAst(ast) {
  visit(ast, {
    visitNoop(path) {
      // Replace noop by removing parent expression
      const parentValue = path.parentPath.value;
      if (Array.isArray(parentValue)) {
        const noopIndex = parentValue.indexOf(path.value);
        path.parentPath.replace([
          ...parentValue.slice(0, noopIndex),
          ...parentValue.slice(noopIndex + 1),
        ]);
        return false;
      }
      if (namedTypes.ExpressionStatement.check(parentValue)) {
        path.parentPath.replace();
        return false;
      }
      if (namedTypes.ArrowFunctionExpression.check(parentValue)) {
        return builders.blockStatement([]);
      }
      console.warn(' TODO may need to clean more');
      this.traverse(path);
    },
    visitBlockStatement(path) {
      // replace expression > block > expression to just expression
      if (
        path.value.body.length === 1 &&
        namedTypes.ExpressionStatement.check(path.parentPath.value)
      ) {
        path.parentPath.replace(path.value.body[0]);
        return false;
      }
      this.traverse(path);
    },
    visitVariableDeclaration(path) {
      // Clean cases in which we have variable declarations inside expressions
      // which would lead to a double semicolon (let test = 2;;)
      if (namedTypes.ExpressionStatement.check(path.parentPath.value)) {
        path.parentPath.replace(path.value);
      }
      this.traverse(path);
    },
  });
  return ast;
}
