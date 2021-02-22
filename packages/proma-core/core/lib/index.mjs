import installLog from './Log.mjs';
import installLiteral from './Literal.mjs';

export default function installLib(proma) {
  return {
    Log: installLog(proma),
    Literal: installLiteral(proma),
  };
}
