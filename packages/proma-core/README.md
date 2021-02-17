# Proma Core

- [x] test output ports with executions
      `js chip(() => { const input = inputData('input'); const exec = inputFlow('exec', () => { output(input() + 1); }); const output = outputData('output'); }) `
- [x] same as before but for pure output port
- [x] test output ports in pure chips
- [!] remove initIns/initCont in defualt wrapper, use config instead
  - [x] default values applicable with `chip.in.port = 'value'`
  - [x] chip id assignable with `chip.id = 'id'`
  - [x] chip no longer accpet id/defaultValues on construction
  - [x] chip stores config
  - [x] chip.config accessors
  - [x] add `config` api for ChipInfo construction
  - [!] consider in compilation by removing inputInit/contInit
- [x] convert `config` to private/canonical ports
      `` js chip('Literal', () => { const value = inputData('value', { canonical: true, conceiled: true }); // or just `true` outputData('value', () => value()); });  ``
- [x] default input/then do not || but are just assigned
- [x] `Literal` chip
- [x] connected ouptuts. check what blueprint does? allow for manual implementation?
      probably not, just have array of outputFlow
  - [x] wrap continuations to allow for updates
  - [x] accept updates for output data
  - [x] compile the update
  - [x] accept array of outlets
  - [x] try in chip instance instead of outlet
  - [x] `computePorts` out flows should use inlet assing, other use just inlet ident
  - [x] auto add updateOn if connection and update on previous outputFlow
  - [x] allow for output `compute` on `computeOn`
- [x] multiple uses of same port generate function
  - [x] multiple conn to input flow
  - [x] multiple conn from output data
  - [x] no connections at all?!
- [x] variadic input ports
- [x] execution without compilation
- [x] delegates/terminals/plate? to make events like blueprint
      Handle/ref output ports hat can be used to execute an output flow?
- [x] rename `isPure` to something else? if reading an prop from an object
      it's not pure but "pristine". `isFlowless` or invert logic and call it `hasFlow`
- [ ] do we need emitters now? or should they use a handler?
      It would be nice to get handled chips sent to the chip build function
      like: `chip('MyChip', ({ start }) => { ... })`
- [ ] editability
- [ ] how to have a library of loaded chips to be created by name?
- [ ] save/restore JSON of a chip
- [ ] use this? or have a self? inputs that take it as default?
- [ ] web component wrapper `webChip`? `chip.webComponent`?
      chip builder params could be used to send chip instances of special
      chips like mount, destroy, ... - `WebComponent.initChip` is a `chip.preset({ chips: { mount: chip(...) } })` that can be used to construct
      new chips that get preset chips as params
- [ ] types
- [ ] variadic output ports
- [ ] variadic outlets compilation with proxy an all?
- [ ] check all errors:
  - [ ] pure output only allow input/config usage
  - [ ] if outlet not used anywhere, warning
  - [ ] moar
- [ ] when building chip, have a pass with recast to allow for:
      config for chips may also get labels
      `js const exec = inputFlow(() => { ... }); // converted with recast to const exec = inputFlow('exec', () => { ... }); `
- [ ] disallow shadowing by only allowing port names to be in callexpressions
- [ ] honor conceiled input ports

## To test

- [ ] test output ports must not use side-effects
- [ ] test using `then` in an assignment errors
- [ ] test configs

## Ideas

- [ ] a chip should allow a literal assignment to a port like
      ```js
      const log = Log();
      log.in.message = 'hello world';

      // instead of `const log = Log({ message: 'hello world' })`
      ```

- [ ] chips may need "configurations", basically inputs that are not shown as ports
      ie: a `Literal` chip where "value" is a config rather than a port
      `js chip('Literal', (value) => { // The problem here is that pure outputs should not allow non-input access. // Maybe we can also allow config access (but not function calls?) outputData('value', () => value); }); `

      ```js
      class Literal {
        constructor(value) {
          this.config = { value };
          this.out = {};
          Object.defineProperties(this.out, {
            value: {
              enumerable: true,
              get: () => this.config.value;
            }
          });
        }
      }
      ```

## Web component

 TODO generate web components with Proma

```js
// WebComponent

const template = document.createElement('template');
template.innerHTML = `
<div class="inner-template">
  <slot></slot>
</div>`;

class WebComponent extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.addEventListener('slotchange', (event) =>
      console.log(event),
    );
  }

  connectedCallback() {
    // mount
  }

  disconnectedCallback() {
    // unmount
  }

  adoptedCallback() {
    // moved to a new document
  }

  static get observedAttributes() {
    return [];
  }

  attributeChangedCallback(name, oldVal, newVal) {}
}

window.customElements.define('web-component', WebActor);
```