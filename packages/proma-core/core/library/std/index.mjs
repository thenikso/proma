import installLiteral from './Literal.mjs';
import installGetProperty from './GetProperty.mjs';
import installSetProperty from './SetProperty.mjs';
import installGetPropertyAtPath from './GetPropertyAtPath.mjs';
import installToString from './ToString.mjs';
import installEqual from './Equal.mjs';
// flowControl
import installFlowControl from './flowControl.mjs';
// string
import installAppend from './string/Append.mjs';
// debug
import installLog from './debug/Log.mjs';
// async
import installAsync from './async.mjs';

export default function installLib(proma) {
  return {
    Literal: installLiteral(proma),
    GetProperty: installGetProperty(proma),
    SetProperty: installSetProperty(proma),
    GetPropertyAtPath: installGetPropertyAtPath(proma),
    ToString: installToString(proma),
    Equal: installEqual(proma),
    string: {
      Append: installAppend(proma),
    },
    flowControl: installFlowControl(proma),
    debug: {
      Log: installLog(proma),
    },
    async: installAsync(proma),
  };
}
