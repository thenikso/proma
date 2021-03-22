import installLiteral from './Literal.mjs';
import installGetProperty from './GetProperty.mjs';
import installSetProperty from './SetProperty.mjs';
// string
import installAppend from './string/Append.mjs';
// flow
import installFlowControl from './utils/flowControl.mjs';
// html
import installQuerySelector from './html/QuerySelector.mjs';
import installBindEvent from './html/BindEvent.mjs';
// network
import installFetchJson from './network/FetchJson.mjs';
// debug
import installLog from './debug/Log.mjs';

export default function installLib(proma) {
  return {
    Literal: installLiteral(proma),
    GetProperty: installGetProperty(proma),
    SetProperty: installSetProperty(proma),
    string: {
      Append: installAppend(proma),
    },
    flowControl: installFlowControl(proma),
    html: {
      QuerySelector: installQuerySelector(proma),
      BindEvent: installBindEvent(proma),
    },
    network: {
      FetchJson: installFetchJson(proma),
    },
    debug: {
      Log: installLog(proma),
    },
  };
}
