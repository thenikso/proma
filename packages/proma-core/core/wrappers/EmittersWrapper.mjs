import recast from '../../vendor/recast.mjs';

export default {
  compileEnd({ chip, chipInfo, compiledEmitters }) {
    const program = recast.parse('');
    program.program.body = compiledEmitters;
    return program;
  },
};
