import { describe, Try } from '../runner/riteway.mjs';
import { chip, Registry } from '../../core/index.mjs';

import { Literal, Log } from '../lib.mjs';

const CustomLog = chip('Log', () => {});

describe('[core/registry] Registry.add', async (assert) => {
  assert({
    given: 'registry.add with an invalid chip',
    should: 'throw an error',
    actual: Try(() => new Registry().add({}, 'test')),
    expected: new Error('chip must be a Chip'),
  });

  assert({
    given: 'registry.add with a single chip',
    should: 'add the chip',
    actual: new Registry().add(Literal, 'test').has('Literal'),
    expected: true,
  });

  assert({
    given: 'registry.add with an array of chips',
    should: 'add the chips',
    actual: new Registry().add([Literal, Log], 'test').qualifiedNames,
    expected: ['test#Literal', 'test#Log'],
  });

  assert({
    given: 'registry.add with a tree of chips',
    should: 'add the chips',
    actual: new Registry().add({ test: { debug: { Log }, Literal } }, 'test')
      .qualifiedNames,
    expected: ['test#Log', 'test#Literal'],
  });
});

describe('[core/registry] Registry.has', async (assert) => {
  const registry = new Registry()
    .add(Literal, 'test')
    .add(Log, 'test')
    .add(CustomLog, 'custom');

  assert({
    given: 'registry.has with unqualified name',
    should: 'return true for unambiguous chip',
    actual: registry.has('Literal'),
    expected: true,
  });

  assert({
    given: 'registry.has with unqualified name',
    should: 'return false for ambiguous chip',
    actual: registry.has('Log'),
    expected: false,
  });

  assert({
    given: 'registry.has with qualified name',
    should: 'return true',
    actual: registry.has('custom#Log'),
    expected: true,
  });
});

describe('[core/registry] Registry.resolver/use', async (assert) => {
  const registry = new Registry().resolver(/^test(?:#(.+))/, (add, match) => {
    switch (match[1]) {
      case 'Literal':
        add(Literal, 'test');
        break;
      case 'Log':
        add(Log, 'test');
        break;
      default:
        add([Literal, Log], 'test');
    }
  });

  assert({
    given: 'registry.use with a resolvable name',
    should: 'use the resolver and find the chip',
    actual: (await registry.use('test#Literal')).has('Literal'),
    expected: true,
  });
});

describe('[core/registry] Registry.get', async (assert) => {
  const registry = new Registry()
    .add(Literal, 'test')
    .add(Log, 'test')
    .add(CustomLog, 'custom');

  assert({
    given: 'registry.get with a registered chip',
    should: 'return the chip class',
    actual: registry.get('Literal'),
    expected: Literal,
  });
});

describe('[core/registry] Registry.qualifiedName', async (assert) => {
  const registry = new Registry()
    .add(Literal, 'test')
    .add(Log, 'test')
    .add(CustomLog, 'custom');

  assert({
    given: 'registry.qualifiedName with a registered chip',
    should: 'return the qualified name of the chip',
    actual: registry.qualifiedName(Literal),
    expected: 'test#Literal',
  });

  assert({
    given: 'registry.qualifiedNames',
    should: 'be the list of all qualified names in the registry',
    actual: registry.qualifiedNames,
    expected: ['test#Literal', 'test#Log', 'custom#Log'],
  });
});
