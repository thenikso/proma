export { Chip } from './chip.mjs';
export * from './api.mjs';
export { registry } from './registry.mjs';
export { edit } from './edit.mjs';
export { fromJSON } from './deserialize.mjs';

import * as proma from './api.mjs';
import { registry } from './registry.mjs';
import installLib from './lib/index.mjs';

export const lib = installLib({ ...proma, registry });

// TODO rename
export { Registry } from './registry2.mjs';
