import installLiteral from './Literal.mjs';
import installGetProperty from './GetProperty.mjs';
import installLog from './debug/Log.mjs';
import installQuerySelector from './html/QuerySelector.mjs';
import installBindEvent from './html/BindEvent.mjs';
import installSequence from './flow/Sequence.mjs';

export default function installLib(proma) {
  return {
    Literal: installLiteral(proma),
    GetProperty: installGetProperty(proma),
    flow: {
      Sequence: installSequence(proma),
    },
    debug: {
      Log: installLog(proma),
    },
    html: {
      QuerySelector: installQuerySelector(proma),
      BindEvent: installBindEvent(proma),
    },
  };
}
