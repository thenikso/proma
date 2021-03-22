export default {
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
      chipURI: 'CustomEvent:event(event:Event)',
    },
    {
      id: 'lib_flow_Sequence_2',
      chipURI: 'lib/flow/Sequence',
    },
    {
      id: 'lib_debug_Log_3',
      chipURI: 'lib/debug/Log',
    },
    {
      id: 'lib_flow_Sequence_3',
      chipURI: 'lib/flow/Sequence',
    },
    {
      id: 'lib_html_QuerySelector_2',
      chipURI: 'lib/html/QuerySelector',
      args: [null, 'input'],
    },
    {
      id: 'lib_GetProperty_1',
      chipURI: 'lib/GetProperty',
      args: [null, 'value'],
    },
    {
      id: 'lib_html_QuerySelector_3',
      chipURI: 'lib/html/QuerySelector',
      args: [null, 'h1'],
    },
    {
      id: 'lib_SetProperty_1',
      chipURI: 'lib/SetProperty',
      args: [null, 'innerText'],
    },
    {
      id: 'lib_string_Append_1',
      chipURI: 'lib/string/Append',
      args: ['Hello ', null, '!'],
    },
  ],
  connections: [
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
      source: 'lib_flow_Sequence_2.in.exec',
      sink: 'CustomEvent_1.out.then',
    },
    {
      source: 'CustomEvent_1.out.event',
      sink: 'lib_debug_Log_1.in.message',
    },
    {
      source: 'lib_debug_Log_1.in.exec',
      sink: 'lib_flow_Sequence_2.out.then1',
    },
    {
      source: 'lib_flow_Sequence_3.in.exec',
      sink: 'OnCreate_1.out.then',
    },
    {
      source: 'lib_html_QuerySelector_1.in.exec',
      sink: 'lib_flow_Sequence_3.out.then0',
    },
    {
      source: 'lib_html_QuerySelector_2.in.exec',
      sink: 'lib_flow_Sequence_3.out.then1',
    },
    {
      source: 'in.target',
      sink: 'lib_html_QuerySelector_2.in.target',
    },
    {
      source: 'lib_debug_Log_3.in.exec',
      sink: 'lib_flow_Sequence_2.out.then0',
    },
    {
      source: 'lib_html_QuerySelector_2.out.element',
      sink: 'lib_GetProperty_1.in.target',
    },
    {
      source: 'lib_GetProperty_1.out.value',
      sink: 'lib_debug_Log_3.in.message',
    },
    {
      source: 'lib_html_QuerySelector_3.in.exec',
      sink: 'lib_flow_Sequence_3.out.then2',
    },
    {
      source: 'in.target',
      sink: 'lib_html_QuerySelector_3.in.target',
    },
    {
      source: 'lib_html_QuerySelector_3.out.element',
      sink: 'lib_SetProperty_1.in.target',
    },
    {
      source: 'lib_SetProperty_1.in.exec',
      sink: 'lib_flow_Sequence_2.out.then2',
    },
    {
      source: 'lib_string_Append_1.out.value',
      sink: 'lib_SetProperty_1.in.value',
    },
    {
      source: 'lib_GetProperty_1.out.value',
      sink: 'lib_string_Append_1.in.B',
    },
  ],
  metadata: {
    $in: {
      x: -575,
      y: 5,
    },
    $out: {
      x: -400,
      y: 0,
    },
    OnCreate_1: {
      x: -540,
      y: -115,
    },
    lib_debug_Log_1: {
      x: 205,
      y: 575,
    },
    lib_html_QuerySelector_1: {
      x: -125,
      y: -160,
    },
    lib_html_BindEvent_1: {
      x: 340,
      y: 280,
    },
    OnDestroy_1: {
      x: -580,
      y: 115,
    },
    CustomEvent_1: {
      x: -305,
      y: 495,
    },
    lib_flow_Sequence_1: {
      x: -370,
      y: -225,
      variadicCount: 2,
      out_then_variadicSize: 3,
    },
    lib_debug_Log_2: {
      x: -79.65625,
      y: -233,
    },
    lib_GetProperty_1: {
      x: 190,
      y: 695,
    },
    lib_flow_Sequence_2: {
      x: -55,
      y: 505,
      out_then_variadicSize: 3,
    },
    lib_debug_Log_3: {
      x: 610,
      y: 620,
    },
    lib_flow_Sequence_3: {
      x: -345,
      y: -140,
      out_then_variadicSize: 3,
    },
    lib_html_QuerySelector_2: {
      x: -122.65625,
      y: 47,
    },
    lib_html_QuerySelector_3: {
      x: -115,
      y: 210,
    },
    lib_SetProperty_1: {
      x: 209.34375,
      y: 918,
    },
    lib_string_Append_1: {
      x: -160,
      y: 905,
      in_input_variadicSize: 3,
    },
  },
};
