import * as proma from '../api.mjs';
import installStd from './std/index.mjs';
import installWeb from './web/index.mjs';
import installNode from './node/index.mjs';

export const std = installStd(proma);
export const web = installWeb(proma);
export const node = installNode(proma);
