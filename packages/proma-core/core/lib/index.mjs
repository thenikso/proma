import installLiteral from './Literal.mjs';
import installLog from './debug/Log.mjs';
import installQuerySelector from './html/QuerySelector.mjs';
import installBindEvent from './html/BindEvent.mjs';

export default function installLib(proma) {
  return {
    Literal: installLiteral(proma),
    debug: {
      Log: installLog(proma),
    },
    html: {
      QuerySelector: installQuerySelector(proma),
      BindEvent: installBindEvent(proma),
    },
  };
}
