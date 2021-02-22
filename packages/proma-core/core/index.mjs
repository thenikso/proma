// TODO if there is a window.promaRegistry warn?
// or return that here?

export { Chip } from './chip.mjs';
export * from './api.mjs';
export { registry } from './registry.mjs';

import * as proma from './api.mjs';
import installLib from './lib/index.mjs';

export const Lib = installLib(proma);
