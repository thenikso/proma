import installQuerySelector from './QuerySelector.mjs';
import installBindEvent from './BindEvent.mjs';
// network
import installFetchJson from './network/FetchJson.mjs';

export default function installLib(proma) {
  return {
    QuerySelector: installQuerySelector(proma),
    BindEvent: installBindEvent(proma),
    network: {
      FetchJson: installFetchJson(proma),
    },
  };
}
