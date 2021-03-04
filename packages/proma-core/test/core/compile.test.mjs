import { describe } from '../runner/riteway.mjs';
import { chip, fromJSON } from '../../core/index.mjs';
import { Log } from '../lib.mjs';

describe('[core/compile] compilation regression checks', async (assert) => {
  const TestChip = fromJSON(chip, {
    URI: 'Main',
    in: [
      {
        name: 'target',
        kind: 'data',
        canonical: true,
      },
    ],
    chips: [
      {
        id: 'OnCreate_1',
        chipURI: 'OnCreate:event',
      },
      {
        id: 'lib_debug_Log_1',
        chipURI: 'lib/debug/Log',
      },
      {
        id: 'lib_html_QuerySelector_1',
        chipURI: 'lib/html/QuerySelector',
        args: [null, 'button'],
      },
      {
        id: 'lib_html_BindEvent_1',
        chipURI: 'lib/html/BindEvent',
        args: [null, 'click'],
      },
      {
        id: 'OnDestroy_1',
        chipURI: 'OnDestroy:event',
      },
      {
        id: 'CustomEvent_1',
        chipURI: 'CustomEvent:event<event:Event>',
      },
    ],
    connections: [
      {
        source: 'lib_html_QuerySelector_1.in.exec',
        sink: 'OnCreate_1.out.then',
      },
      {
        source: 'in.target',
        sink: 'lib_html_QuerySelector_1.in.target',
      },
      {
        source: 'lib_html_QuerySelector_1.out.element',
        sink: 'lib_html_BindEvent_1.in.target',
      },
      {
        source: 'lib_html_BindEvent_1.in.bind',
        sink: 'lib_html_QuerySelector_1.out.then',
      },
      {
        source: 'lib_html_BindEvent_1.in.unbind',
        sink: 'OnDestroy_1.out.then',
      },
      {
        source: 'CustomEvent_1.out.handle',
        sink: 'lib_html_BindEvent_1.in.event',
      },
      {
        source: 'lib_debug_Log_1.in.exec',
        sink: 'CustomEvent_1.out.then',
      },
      {
        source: 'CustomEvent_1.out.event',
        sink: 'lib_debug_Log_1.in.message',
      },
    ],
  });

  assert({
    given: 'the same compilation twice',
    should: 'be identical',
    actual: TestChip.compile(),
    expected: TestChip.compile(),
  });
});
