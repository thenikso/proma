import recast from '../vendor/recast.mjs';

export function type(declaration) {
  if (declaration instanceof Type) {
    // TODO add to typeCache?
    return declaration;
  }
  if (typeof declaration !== 'string') {
    declaration = declaration.name;
  }
  const tokens = (declaration || 'any').match(tokenRegex) || [];
  const parsedType = consumeTypes(tokens);
  return new Type(parsedType);
}

const typeCache = new Map();

export class Type {
  constructor(definitionObject) {
    const declaration = serializeTypeAll(definitionObject);
    if (typeCache.has(declaration)) {
      // TODO may also need to check customTypes?
      return typeCache.get(declaration);
    }
    // TODO add cache
    const self = this;
    let typeChecker;
    let typeMatcher;
    Object.defineProperties(this, {
      declaration: {
        enumerable: true,
        value: declaration,
      },
      definitionObject: {
        // TODO deep freeze
        value: definitionObject,
      },
      check: {
        value: function check(data, customTypes) {
          if (!typeChecker || customTypes) {
            typeChecker = makeCheckAll(definitionObject, customTypes);
          }
          const res = typeChecker(data);
          if (customTypes) {
            typeChecker = null;
          }
          return res;
        },
      },
      match: {
        value: function match(otherType, customTypes) {
          if (!(otherType instanceof Type)) {
            otherType = type(otherType);
          }
          if (otherType === self) return true;
          if (!typeMatcher || customTypes) {
            typeMatcher = makeTypeMatchAll(definitionObject, customTypes);
          }
          const res = typeMatcher(otherType.definitionObject);
          if (customTypes) {
            typeMatcher = null;
          }
          return res;
        },
      },
      toString: {
        value: function toString() {
          return `[type ${declaration}]`;
        },
      },
    });

    typeCache.set(declaration, this);
  }
}

//
// Type resolution
//

function resolveType(typeString, customTypes) {
  try {
    const ident = recast.parse(typeString).program.body[0].expression;
    recast.types.namedTypes.Identifier.assert(ident);
    const getTypeRef = new Function(
      'custom',
      `return (custom["${ident.name}"] || ${ident.name})`,
    );
    const typeRef = getTypeRef(customTypes || {});
    return typeRef || typeString;
  } catch (e) {
    return typeString;
  }
}

const toString = {}.toString;

function classDeclarationOf(data) {
  return toString.call(data).slice(8, -1);
}

//
// Serialize
//

function serializeTypeAll(declarations) {
  return declarations.map(serializeType).join('|');
}

function serializeType(definitionObject) {
  const { type, container } = definitionObject;
  let res = '';
  if (type) {
    if (typeof type === 'string') {
      res += type;
    } else {
      res += type.name;
    }
  }
  if (container) {
    const containerOf = definitionObject.of;
    let containerTypes = [];
    switch (container) {
      case 'object':
        for (const key in containerOf) {
          containerTypes.push(key + ': ' + serializeTypeAll(containerOf[key]));
        }
        if (definitionObject.subset) {
          containerTypes.push('...');
        }
        res += '{' + containerTypes.join(', ') + '}';
        break;
      case 'array':
        res += '[' + serializeTypeAll(containerOf) + ']';
        break;
      case 'tuple':
        for (let i = 0, l = containerOf.length; i < l; i++) {
          containerTypes.push(serializeTypeAll(containerOf[i]));
        }
        res += '(' + containerTypes.join(', ') + ')';
        break;
    }
  }
  return res;
}

//
// Matching
//

const byType = (a, b) => {
  if (a.type > b.type) return 1;
  if (a.type < b.type) return -1;
  return 0;
};

function makeTypeMatchAll(declarations, customTypes) {
  const declarationMatchers = declarations
    .slice()
    .sort(byType)
    .map((d) => makeTypeMatch(d, customTypes));
  return function typeMatchAll(otherDeclarations) {
    if (declarations.length < otherDeclarations.length) return false;
    otherDeclarations = otherDeclarations.slice().sort(byType);
    for (let i = 0, l = otherDeclarations.length; i < l; i++) {
      if (!declarationMatchers.some((m) => m(otherDeclarations[i]))) {
        return false;
      }
    }
    return true;
  };
}

function makeTypeMatch(definitionObject, customTypes) {
  const { type, container } = definitionObject;
  let matchFunc;
  if (type) {
    const expectType = resolveType(type, customTypes);
    matchFunc = function matchType(otherDeclaration) {
      if (!otherDeclaration.type) return false;
      const actualType = resolveType(otherDeclaration.type, customTypes);
      if (expectType === actualType) return true;
      if (
        typeof expectType === 'function' &&
        typeof actualType === 'function'
      ) {
        return expectType.prototype instanceof actualType;
      }
      return false;
    };
  }
  if (container) {
    let matchContainer;
    switch (container) {
      case 'object':
        matchContainer = makeMatchObjectContainer(
          definitionObject,
          customTypes,
        );
        break;
      case 'array':
        matchContainer = makeMatchArrayContainer(definitionObject, customTypes);
        break;
      case 'tuple':
        matchContainer = makeMatchTupleContainer(definitionObject, customTypes);
        break;
    }
    if (matchFunc && matchContainer) {
      const matchType = matchFunc;
      matchFunc = function matchTypeAndContainer(data) {
        return matchType(data) && matchContainer(data);
      };
    } else {
      matchFunc = matchContainer;
    }
  }
  if (!matchFunc) {
    throw new Error('Invalid type definition');
  }
  return matchFunc;
}

function makeMatchObjectContainer(definitionObject, customTypes) {
  const expectMathers = {};
  let expectKeyCount = 0;
  const declarationOf = definitionObject.of;
  for (const key in declarationOf) {
    expectMathers[key] = makeTypeMatchAll(declarationOf[key], customTypes);
    expectKeyCount++;
  }
  const ignoreKeyCount = definitionObject.subset;
  return function matchObjectContainer(otherDeclaration) {
    if (otherDeclaration.container !== definitionObject.container) return false;
    const actualOf = otherDeclaration.of;
    let actualKeyCount = 0;
    let expectMather;
    for (const key in actualOf) {
      expectMather = expectMathers[key];
      if (expectMather) {
        if (!expectMather(actualOf[key])) return false;
      } else if (!ignoreKeyCount) {
        return false;
      }
      actualKeyCount++;
    }
    return ignoreKeyCount || expectKeyCount >= actualKeyCount;
  };
}

function makeMatchArrayContainer(definitionObject, customTypes) {}

function makeMatchTupleContainer(definitionObject, customTypes) {}

//
// Checking
//

function makeCheckAll(declarations, customTypes) {
  const checks = declarations.map((d) => makeCheck(d, customTypes));
  if (checks.lenght === 1) {
    return checks[0];
  }
  return (data) => checks.some((check) => check(data));
}

function makeCheck(definitionObject, customTypes) {
  const { type, container } = definitionObject;
  let checkFunc;
  if (type) {
    if (type === 'any') {
      checkFunc = function checkAnyType() {
        return true;
      };
    } else {
      checkFunc = makeCheckInstanceOf(resolveType(type, customTypes));
    }
  }
  if (container) {
    let checkContainer;
    switch (container) {
      case 'object':
        checkContainer = makeCheckObjectContainer(
          definitionObject,
          customTypes,
        );
        break;
      case 'array':
        checkContainer = makeCheckArrayContainer(definitionObject, customTypes);
        break;
      case 'tuple':
        checkContainer = makeCheckTupleContainer(definitionObject, customTypes);
        break;
    }
    if (checkFunc && checkContainer) {
      const checkType = checkFunc;
      checkFunc = function checkTypeAndContainer(data) {
        return checkType(data) && checkContainer(data);
      };
    } else {
      checkFunc = checkContainer;
    }
  }
  if (!checkFunc) {
    throw new Error('Invalid type definition');
  }
  return checkFunc;
}

const checkUndefined = (data) => typeof data === 'undefined';
const checkNull = (data) => data === null;
const checkInstanceOfString = (data) => typeof data === 'string';
const checkInstanceOfNumber = (data) => typeof data === 'number';
const checkInstanceOfBigInt = (data) => typeof data === 'bigint';
const checkInstanceOfBoolean = (data) => typeof data === 'boolean';
const checkInstanceOfSymbol = (data) => typeof data === 'symbol';
const checkInstanceOfFunction = (data) => typeof data === 'function';

function makeCheckInstanceOf(resolvedType) {
  switch (resolvedType) {
    case undefined:
    case 'undefined':
      return checkUndefined;
    case null:
    case 'Null':
    case 'null':
      return checkNull;
    case String:
    case 'String':
    case 'string':
      return checkInstanceOfString;
    case Number:
    case 'Number':
    case 'number':
      return checkInstanceOfNumber;
    case BigInt:
    case 'BigInt':
    case 'bigint':
      return checkInstanceOfBigInt;
    case Boolean:
    case 'Boolean':
    case 'boolean':
    case 'bool':
      return checkInstanceOfBoolean;
    case Symbol:
    case 'Symbol':
    case 'symbol':
      return checkInstanceOfSymbol;
    case Function:
    case 'Function':
    case 'function':
      return checkInstanceOfFunction;
    default:
      if (typeof resolvedType === 'string') {
        return function checkTypeClassName(data) {
          return classDeclarationOf(data) === resolvedType;
        };
      }
      return function checkInstanceOf(data) {
        return data instanceof resolvedType;
      };
  }
}

function makeCheckObjectContainer(definitionObject, customTypes) {
  let expectKeyCount = 0;
  const innerTypeDeclarations = definitionObject.of;
  const expectChecks = {};
  for (const key in innerTypeDeclarations) {
    const innerDeclarations = innerTypeDeclarations[key];
    expectChecks[key] = makeCheckAll(innerDeclarations, customTypes);
    expectKeyCount++;
  }
  const ignoreKeyCount = definitionObject.subset;
  return function checkObjectContainer(data) {
    let actualKeysCount = 0;
    let keyCheck;
    for (const key in data) {
      keyCheck = expectChecks[key];
      if (keyCheck) {
        if (!keyCheck(data[key])) return false;
      } else if (!ignoreKeyCount) {
        return false;
      }
      actualKeysCount++;
    }
    return (
      (ignoreKeyCount && actualKeysCount >= expectKeyCount) ||
      actualKeysCount === expectKeyCount
    );
  };
}

function makeCheckArrayContainer(definitionObject, customTypes) {
  const checkArrayItem = makeCheckAll(definitionObject.of, customTypes);
  return function checkArrayContainer(data) {
    return Array.isArray(data) && data.every(checkArrayItem);
  };
}

function makeCheckTupleContainer(definitionObject, customTypes) {
  const tupleChecks = definitionObject.of.map((t) =>
    makeCheckAll(t, customTypes),
  );
  return function checkTupleContainer(data) {
    if (data.length !== tupleChecks.length) return false;
    for (let i = 0, l = tupleChecks.length; i < l; i++) {
      if (!tupleChecks[i](data[i])) return false;
    }
    return true;
  };
}

//
// Parser
//

// inspired by https://github.com/gkz/type-check

const identifierRegex = /[\$\w]+/;
const tokenRegex = RegExp(
  '\\.\\.\\.|::|->|' + identifierRegex.source + '|\\S',
  'g',
);

function peek(tokens) {
  var token;
  token = tokens[0];
  if (token == null) {
    throw new Error('Unexpected end of input.');
  }
  return token;
}

function consumeIdent(tokens) {
  const token = peek(tokens);
  if (!identifierRegex.test(token)) {
    throw new Error("Expected text, got '" + token + "' instead.");
  }
  return tokens.shift();
}

function consumeOp(tokens, op) {
  const token = peek(tokens);
  if (token !== op) {
    throw new Error("Expected '" + op + "', got '" + token + "' instead.");
  }
  return tokens.shift();
}

function maybeConsumeOp(tokens, op) {
  const token = tokens[0];
  if (token === op) {
    return tokens.shift();
  } else {
    return null;
  }
}

function consumeArray(tokens) {
  consumeOp(tokens, '[');
  if (peek(tokens) === ']') {
    throw new Error('Must specify type of Array - eg. [Type], got [] instead.');
  }
  const types = consumeTypes(tokens);
  consumeOp(tokens, ']');
  return {
    container: 'array',
    of: types,
  };
}

function consumeTuple(tokens) {
  const components = [];
  consumeOp(tokens, '(');
  if (peek(tokens) === ')') {
    throw new Error(
      'Tuple must be of at least length 1 - eg. (Type), got () instead.',
    );
  }
  for (;;) {
    components.push(consumeTypes(tokens));
    maybeConsumeOp(tokens, ',');
    if (')' === peek(tokens)) {
      break;
    }
  }
  consumeOp(tokens, ')');
  return {
    container: 'tuple',
    of: components,
  };
}

function consumeObjectFields(tokens) {
  const fields = {};
  consumeOp(tokens, '{');
  let subset = false;
  for (;;) {
    if (maybeConsumeOp(tokens, '...')) {
      subset = true;
      break;
    }
    const [key, types] = consumeObjectField(tokens);
    fields[key] = types;
    maybeConsumeOp(tokens, ',');
    if ('}' === peek(tokens)) {
      break;
    }
  }
  consumeOp(tokens, '}');
  return {
    container: 'object',
    of: fields,
    subset: subset,
  };
}

function consumeObjectField(tokens) {
  const key = consumeIdent(tokens);
  consumeOp(tokens, ':');
  const types = consumeTypes(tokens);
  return [key, types];
}

function maybeConsumeStructure(tokens) {
  switch (tokens[0]) {
    case '[':
      return consumeArray(tokens);
    case '(':
      return consumeTuple(tokens);
    case '{':
      return consumeObjectFields(tokens);
  }
}

function consumeType(tokens) {
  const token = peek(tokens);
  const wildcard = token === '*';
  if (wildcard || identifierRegex.test(token)) {
    const type = wildcard ? consumeOp(tokens, '*') : consumeIdent(tokens);
    const container = maybeConsumeStructure(tokens);
    if (container) {
      return (container.type = type), container;
    } else {
      return {
        type: type,
      };
    }
  } else {
    const container = maybeConsumeStructure(tokens);
    if (!container) {
      throw new Error('Unexpected character: ' + token);
    }
    return container;
  }
}

function consumeTypes(tokens) {
  if ('::' === peek(tokens)) {
    throw new Error("No comment before comment separator '::' found.");
  }
  const lookahead = tokens[1];
  if (lookahead != null && lookahead === '::') {
    tokens.shift();
    tokens.shift();
  }
  let types = [];
  let typesSoFar = {};
  if ('Maybe' === peek(tokens)) {
    tokens.shift();
    types = [
      {
        type: 'Undefined',
      },
      {
        type: 'Null',
      },
    ];
    typesSoFar = {
      Undefined: true,
      Null: true,
    };
  }
  for (;;) {
    const typeObj = consumeType(tokens);
    const { type, container } = typeObj;
    if (!typesSoFar[type]) {
      types.push(typeObj);
    }
    if (container === null) {
      typesSoFar[type] = true;
    }
    if (!maybeConsumeOp(tokens, '|')) {
      break;
    }
  }
  return types;
}
