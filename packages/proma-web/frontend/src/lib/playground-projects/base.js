export default () => ({
  'endpoints/greet.proma': `{
  "URI": "backend/Greet",
  "target": "node",
  "in": [
    { "name": "exec", "kind": "flow" },
    { "name": "request", "kind": "data", "canonical": true }
  ],
  "out": [
    { "name": "then", "kind": "flow" },
    { "name": "body", "kind": "data", "computeOn": ["then"] }
  ],
  "chips": [
    { "id": "OnCreate_1", "chipURI": "OnCreate:event" },
    {
      "id": "lib_debug_Log_1",
      "chipURI": "lib/debug/Log",
      "args": ["chip created"]
    },
    {
      "id": "lib_string_Append_1",
      "chipURI": "lib/string/Append",
      "args": ["Hello ", null, "!"]
    },
    {
      "id": "lib_network_FetchJson_1",
      "chipURI": "lib/network/FetchJson",
      "args": ["https://jsonplaceholder.typicode.com/todos/1"]
    },
    {
      "id": "lib_GetPropertyAtPath_1",
      "chipURI": "lib/GetPropertyAtPath",
      "args": ["query.name"]
    },
    { "id": "lib_Equal_1", "chipURI": "lib/Equal", "args": ["GET"] },
    { "id": "lib_debug_Log_2", "chipURI": "lib/debug/Log" },
    { "id": "lib_ToString_1", "chipURI": "lib/ToString" },
    {
      "id": "lib_string_Append_2",
      "chipURI": "lib/string/Append",
      "args": ["is GET: "]
    },
    {
      "id": "lib_flowControl_Sequence_1",
      "chipURI": "lib/flowControl/Sequence"
    },
    {
      "id": "lib_GetProperty_1",
      "chipURI": "lib/GetProperty",
      "args": [null, "method"]
    }
  ],
  "connections": [
    { "source": "lib_debug_Log_1.in.exec", "sink": "OnCreate_1.out.then" },
    { "source": "in.exec", "sink": "lib_flowControl_Sequence_1.in.exec" },
    { "source": "lib_string_Append_1.out.value", "sink": "out.body" },
    { "source": "in.request", "sink": "lib_GetPropertyAtPath_1.in.target" },
    {
      "source": "lib_GetPropertyAtPath_1.out.value",
      "sink": "lib_string_Append_1.in.B"
    },
    { "source": "lib_GetProperty_1.out.value", "sink": "lib_Equal_1.in.B" },
    { "source": "lib_Equal_1.out.equal", "sink": "lib_ToString_1.in.target" },
    {
      "source": "lib_ToString_1.out.string",
      "sink": "lib_string_Append_2.in.B"
    },
    {
      "source": "lib_string_Append_2.out.value",
      "sink": "lib_debug_Log_2.in.message"
    },
    { "source": "lib_flowControl_Sequence_1.out.then0", "sink": "out.then" },
    {
      "source": "lib_debug_Log_2.in.exec",
      "sink": "lib_flowControl_Sequence_1.out.then1"
    },
    { "source": "in.request", "sink": "lib_GetProperty_1.in.target" }
  ],
  "metadata": {
    "$": { "panX": -228, "panY": -203, "zoom": 1, "selected": [] },
    "$in": { "x": -755, "y": 5 },
    "$out": { "x": 610, "y": 0 },
    "OnCreate_1": { "x": -380, "y": -215 },
    "lib_debug_Log_1": { "x": -130, "y": -195 },
    "lib_string_Append_1": { "x": -65, "y": 70, "in_input_variadicSize": 2 },
    "lib_network_FetchJson_1": { "x": 835, "y": 290 },
    "lib_GetPropertyAtPath_1": { "x": -495, "y": 100 },
    "lib_GetProperty_1": { "x": -840, "y": 330 },
    "lib_Equal_1": { "x": -470, "y": 325 },
    "lib_debug_Log_2": { "x": 560, "y": 195 },
    "lib_ToString_1": { "x": -160, "y": 360 },
    "lib_string_Append_2": { "x": 105, "y": 325, "in_input_variadicSize": 2 },
    "lib_flowControl_Sequence_1": {
      "x": 240,
      "y": -25,
      "out_then_variadicSize": 2
    }
  }
}
`,
  'www/index.html': `<html lang="en">
<head>
  <title>Proma Program</title>
</head>
<body>
  <div id="app">
    <input type="text" id="name" />
    <button type="button" id="button">Greet</button>
    <h2 id="greet">Hello!</h2>
  </div>
  <script type="module">
    import App from '/app.js';
    new App(window, document.getElementById('app'));
  </script>
</body>
</html>`,
  'www/app.proma': `{
    "URI": "frontend/App",
    "target": "web",
    "in": [
      { "name": "window", "kind": "data", "canonical": true },
      { "name": "target", "kind": "data", "canonical": true }
    ],
    "chips": [
      {
        "id": "lib_html_QuerySelector_1",
        "chipURI": "lib/html/QuerySelector",
        "args": [null, "button"]
      },
      {
        "id": "lib_html_BindEvent_1",
        "chipURI": "lib/html/BindEvent",
        "args": [null, "click"]
      },
      { "id": "CustomEvent_1", "chipURI": "CustomEvent:event(event:Event)" },
      { "id": "OnCreate_3", "chipURI": "OnCreate:event" },
      { "id": "lib_debug_Log_5", "chipURI": "lib/debug/Log", "args": ["clicked"] }
    ],
    "connections": [
      { "source": "in.target", "sink": "lib_html_QuerySelector_1.in.target" },
      {
        "source": "lib_html_QuerySelector_1.out.element",
        "sink": "lib_html_BindEvent_1.in.target"
      },
      {
        "source": "CustomEvent_1.out.handle",
        "sink": "lib_html_BindEvent_1.in.event"
      },
      { "source": "lib_html_BindEvent_1.in.bind", "sink": "OnCreate_3.out.then" },
      { "source": "lib_debug_Log_5.in.exec", "sink": "CustomEvent_1.out.then" }
    ],
    "metadata": {
      "$": { "panX": -154, "panY": -273, "zoom": 1, "selected": [] },
      "$in": { "x": -755, "y": 5 },
      "$out": { "x": -400, "y": 0 },
      "lib_html_QuerySelector_1": { "x": -495, "y": 105 },
      "lib_html_BindEvent_1": { "x": -33.5, "y": 55 },
      "CustomEvent_1": { "x": -265, "y": 355 },
      "OnCreate_3": { "x": -260.5, "y": -87 },
      "lib_debug_Log_5": { "x": 16.5, "y": 416 }
    }
  }
`,
  'index.js': `const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('www'));

const endpoints = fs
  .readdirSync('./endpoints')
  .filter((f) => f.endsWith('.js'));
for (let i = 0, l = endpoints.length; i < l; i++) {
  const endpointFileName = endpoints[i];
  const endpointName = endpointFileName.substring(
    0,
    endpointFileName.lastIndexOf('.'),
  );
  const endpointClass = require('./endpoints/' + endpointFileName);
  const endpointInstance = new endpointClass();
  app.get('/' + endpointName, (req, res) => {
    endpointInstance.out.then(() => {
      const body = endpointInstance.out.body();
      res.send(body);
    });
    endpointInstance.in.request = req;
    endpointInstance.in.exec();
  });
}

app.listen(port, () => {
  console.log(\`App listening at http://localhost:\${port}\`);
});
`,
  'readme.md': 'Hello world!',
});
