// network
import installFetchJson from './network/FetchJson.mjs';

export default function installLib(proma) {
  return {
    network: {
      FetchJson: installFetchJson(proma),
    },
  };
}
