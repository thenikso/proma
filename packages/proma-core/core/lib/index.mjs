import installLiteral from './Literal.mjs';
import installLog from './debug/Log.mjs';
import installQuerySelector from './html/QuerySelector.mjs';

export default function installLib(proma) {
  return {
    // TODO same structure as chip URIs
    Literal: installLiteral(proma),
    debug: {
      Log: installLog(proma),
    },
    html: {
      QuerySelector: installQuerySelector(proma),
    },
  };
}
