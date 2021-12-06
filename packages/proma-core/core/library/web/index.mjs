import installQuerySelector from './html/QuerySelector.mjs';
import installBindEvent from './html/BindEvent.mjs';
// network
import installFetchJson from './network/FetchJson.mjs';

export default function installLib(proma) {
  return {
    html: {
      QuerySelector: installQuerySelector(proma),
      BindEvent: installBindEvent(proma),
    },
    network: {
      FetchJson: installFetchJson(proma),
    },
  };
}
