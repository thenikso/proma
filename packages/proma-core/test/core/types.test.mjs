import { describe } from '../runner/riteway.mjs';
import { type, Type } from '../../core/types.mjs';

describe('[core/types] type parsing and serializing', async (assert) => {
  assert({
    given: 'a type declaration',
    should: 'produce a Type',
    actual: type('Test{any: string}') instanceof Type,
    expected: true,
  });

  assert({
    given: 'a type declaration signature',
    should: 'render the normalized type signature',
    actual: type('Test { Key : string }').signature,
    expected: 'Test{Key: String}',
  });

  assert({
    given: 'two type definitions with the same declaration',
    should: 'be the same type',
    actual: type('string'),
    expected: type('String'),
  });

  assert({
    given: 'an object type',
    should: 'have an "object" definitionKinds',
    actual: type('Test { Key : string }').definitionKinds,
    expected: ['object'],
  });

  assert({
    given: 'a function type',
    should: 'have a "funciton" definitionKinds',
    actual: type('(Event) => void').definitionKinds,
    expected: ['function'],
  });

  assert({
    given: 'a function type',
    should: 'render the normalized signature',
    actual: type('( Event , number ) => String').signature,
    expected: '(Event, Number) => String',
  });
});

describe('[core/types] type checking', async (assert) => {
  const StringType = type('string');

  assert({
    given: 'StringType a string to check',
    should: 'return true',
    actual: StringType.check('ok'),
    expected: true,
  });

  assert({
    given: 'StringType a number to check',
    should: 'return false',
    actual: StringType.check(4),
    expected: false,
  });

  const NumberArrayType = type('[Number]');

  assert({
    given: 'NumberArrayType a number array',
    should: 'return true',
    actual: NumberArrayType.check([1, 2, 3]),
    expected: true,
  });

  assert({
    given: 'NumberArrayType a mixed array',
    should: 'return false',
    actual: NumberArrayType.check([1, 2, '3']),
    expected: false,
  });

  assert({
    given: 'NumberArrayType a non array',
    should: 'return false',
    actual: NumberArrayType.check({ a: 1 }),
    expected: false,
  });

  assert({
    given: 'NumberArrayType a number',
    should: 'return false',
    actual: NumberArrayType.check(1),
    expected: false,
  });

  const ToupleType = type('(Number, String)');

  assert({
    given: 'ToupleType a valid tuple',
    should: 'return true',
    actual: ToupleType.check([6, 'grande']),
    expected: true,
  });

  assert({
    given: 'ToupleType a short tuple',
    should: 'return false',
    actual: ToupleType.check([1]),
    expected: false,
  });

  assert({
    given: 'ToupleType a long tuple',
    should: 'return false',
    actual: ToupleType.check([4, 'ever', 'more']),
    expected: false,
  });

  assert({
    given: 'ToupleType a non array',
    should: 'return false',
    actual: ToupleType.check({ a: 1 }),
    expected: false,
  });

  assert({
    given: 'ToupleType a number',
    should: 'return false',
    actual: ToupleType.check(1),
    expected: false,
  });

  const ObjectType = type('{ num: Number, str: String }');

  assert({
    given: 'ObjectType a valid object',
    should: 'return true',
    actual: ObjectType.check({ num: 4, str: 'ever' }),
    expected: true,
  });

  assert({
    given: 'ObjectType an incomplete object',
    should: 'return false',
    actual: ObjectType.check({ num: 4 }),
    expected: false,
  });

  assert({
    given: 'ObjectType a bigger object',
    should: 'return false',
    actual: ObjectType.check({ num: 4, str: 'ever', and: 'more' }),
    expected: false,
  });

  assert({
    given: 'ObjectType a number',
    should: 'return false',
    actual: ObjectType.check(1),
    expected: false,
  });

  const ObjectSubsetType = type('{ num: Number, str: String, ... }');

  assert({
    given: 'ObjectSubsetType an incomplete object',
    should: 'return false',
    actual: ObjectSubsetType.check({ num: 4 }),
    expected: false,
  });

  assert({
    given: 'ObjectSubsetType a bigger object',
    should: 'return true',
    actual: ObjectSubsetType.check({ num: 4, str: 'ever', and: 'more' }),
    expected: true,
  });

  const FunctionType = type('(String, Number) => void');

  assert({
    given: 'FunctionType a function with exact number of parameters',
    should: 'return true',
    actual: FunctionType.check((one, two) => 4),
    expected: true,
  });
});

describe('[core/types] type matching', async (assert) => {
  assert({
    given: 'a complex type to any',
    should: 'return true, as "any" can use any type',
    actual: type('{ b: number, a: string }').match(type('any')),
    expected: true,
  });

  assert({
    given: 'to any a complex type to match',
    should: 'return true, as "any" makes no restrictions',
    actual: type('any').match(type('{ b: number, a: string }')),
    expected: true,
  });

  const StringType = type('string');

  assert({
    given: 'StringType a string type to match',
    should: 'return true',
    actual: StringType.match(type('string')),
    expected: true,
  });

  assert({
    given: 'StringType a number type to match',
    should: 'return false',
    actual: StringType.match(type('number')),
    expected: false,
  });

  class A {
    constructor() {
      this.a = 'a';
    }

    toString() {
      return 'A';
    }
  }

  class B extends A {
    constructor() {
      super();
      this.b = 'b';
    }

    toString() {
      return 'B';
    }
  }

  const AType = type(A);
  const BType = type('B');

  assert({
    given: 'AType the A class to match',
    should: 'match',
    actual: AType.match(A),
    expected: true,
  });

  assert({
    given: 'AType the BType to match',
    should: 'not match',
    actual: AType.match(BType, { A, B }),
    expected: false,
  });

  assert({
    given: 'BType the AType to match',
    should: 'match, because B is subclass of A so it matches and exceed',
    actual: BType.match(AType, { A, B }),
    expected: true,
  });

  // objects

  assert({
    given: 'and object type with more properties than a second object type',
    should:
      'match, because the first object can work for someone using the second one',
    actual: type('{ b: number, a: string }').match(type('{ a: string }')),
    expected: true,
  });

  // arrays

  assert({
    given: 'an array of B matching array of A',
    should: 'match',
    actual: type('[B]').match(type('[A]'), { A, B }),
    expected: true,
  });

  // tuples

  assert({
    given: 'a tuple of B matching tuple of A',
    should: 'match',
    actual: type('(B, A, number)').match(type('(A, A, Number)'), { A, B }),
    expected: true,
  });

  // functions

  assert({
    given: 'a pair of compatible function types',
    should: 'match',
    actual: type('(B, A) => void').match(type('(A, A) => null'), { A, B }),
    expected: true,
  });
});
