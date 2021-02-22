import installLog from './Log.mjs';
import installLiteral from './Literal.mjs';

export default function installLib(proma) {
  return {
    // TODO same structure as chip URIs
    Literal: installLiteral(proma),
    debug: {
      Log: installLog(proma),
    },
  };
}
