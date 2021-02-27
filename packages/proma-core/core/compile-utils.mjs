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
    default:
      throw new Error(`Can not compile literal: ${value}`);
  }
}

export function getFunctionBody(funcAst) {
  if (namedTypes.FunctionDeclaration.check(funcAst)) {
    return funcAst.body;
  } else if (
    namedTypes.ExpressionStatement.check(funcAst) &&
    namedTypes.ArrowFunctionExpression.check(funcAst.expression)
  ) {
    return funcAst.expression.body;
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

  const replaceInputData = {};
  const replaceOutputFlows = {};
  const replaceOutputData = {};

  const getAst = () =>
    getFunctionBody(parse(String(portInfo[sourceProp])).program.body[0]);

  visit(getAst(), {
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
          replaceInputData[portName] = {
            path: pathFromNodePath(path),
          };
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
            replaceOutputFlows[portName] = {
              path: pathFromNodePath(path),
            };
            return false;
          }
          // Output data, this is a case like `output(input() + 1)`
          // if there is no argument, the output data port is being used badly
          const pathArray = pathFromNodePath(path);
          replaceOutputData[portName] = {
            path: pathArray,
            argPath: [...pathArray, 'arguments', 0],
          };
          return false;
        }
      }
      this.traverse(path);
    },
  });

  return function astBuilder({
    compileInputData,
    compileOutputFlow,
    compileOutputData,
  }) {
    let ast = getAst();

    for (const portName in replaceInputData) {
      const { path } = replaceInputData[portName];
      const res = compileInputData(portName) || builders.noop();
      ast = replaceAstPath(ast, path, res);
    }

    for (const portName in replaceOutputFlows) {
      const { path } = replaceOutputFlows[portName];
      const res = compileOutputFlow(portName) || builders.noop();
      ast = replaceAstPath(ast, path, res);
    }

    for (const portName in replaceOutputData) {
      const { path, argPath } = replaceOutputData[portName];
      const block = getPath(ast, argPath);
      let res = compileOutputData(portName, block) || builders.noop();
      if (namedTypes.BlockStatement.check(res)) {
        // NOTE This is a trick to resovle the situation where a block is returned
        // but we do not want it! Basically if we explore it right away, paths
        // for other `replaceOutputData` would be wrong. So we store an array
        // as a block body idem and we clean it up in `cleanAst`
        res.$explodeMe = true;
        // Replace the hole expression
        path.pop();
      } else if (namedTypes.ExpressionStatement.check(res)) {
        // Replace the hole expression
        path.pop();
      }
      ast = replaceAstPath(ast, path, res);
    }

    return cleanAst(ast);
  };
}

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
      // Special block marked to be exploded
      if (
        path.value.$explodeMe === true &&
        Array.isArray(path.parentPath.value)
      ) {
        const body = path.parentPath.value;
        const exploreAtIndex = body.indexOf(path.value);
        path.parentPath.replace([
          ...body.slice(0, exploreAtIndex),
          ...path.value.body,
          ...body.slice(exploreAtIndex + 1),
        ]);
      }
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
