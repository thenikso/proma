/**
 * Returns a letter from an index.
 * 0, 1, ... N becomes A, B, .., Z, AA, AB, ...
 */
function variadicLetterFromIndex(index) {
  let n = index % 26;
  let res = [String.fromCharCode(65 + n)];
  index = Math.floor(index / 26);
  while (index) {
    n = index % 26;
    res.unshift(String.fromCharCode(65 + n - 1));
    index = Math.floor(index / 26);
  }
  return res.join('');
}

function indexFromVariadicLetter(letter) {
  let res = letter.charCodeAt(letter.length - 1) - 65;
  for (let i = letter.length - 2; i >= 0; i--) {
    res += (letter.charCodeAt(i) - 65 + 1) * ((letter.length - i - 1) * 26);
  }
  return res;
}

/**
 * Transforms variadic string names containing `{index}` or `{letter}` to
 * name building functions receiving an index and generating a string name.
 */
export function variadicStringNameToFunc(name) {
  const parser = /((?:.(?!index}|letter}))*)(?:\{(index|letter)\})?/g;
  let parsed;
  const strs = [];
  const vals = [];
  let counterParser = '^';
  let counterFirstValType;
  parse: while ((parsed = parser.exec(name))) {
    strs.push(parsed[1]);
    counterParser += parsed[1];
    switch (parsed[2]) {
      case 'index':
        vals.push((x) => String(x));
        counterParser += '(\\d+)';
        if (!counterFirstValType) counterFirstValType = 'index';
        break;
      case 'letter':
        vals.push(variadicLetterFromIndex);
        counterParser += '([A-Z]+)';
        if (!counterFirstValType) counterFirstValType = 'letter';
        break;
      default:
        break parse;
    }
  }
  if (vals.length === 0) {
    return () => name;
  }
  counterParser = new RegExp(counterParser + '$');
  return (index, str) => {
    if (str) {
      const unparsed = counterParser.exec(str);
      if (!unparsed || !unparsed[1]) return -1;
      switch (counterFirstValType) {
        case 'index':
          return parseInt(unparsed[1]);
          break;
        case 'letter':
          return indexFromVariadicLetter(unparsed[1]);
          break;
        default:
          return -1;
      }
    }
    const res = [];
    for (let i = 0; i < strs.length; i++) {
      res.push(strs[i]);
      vals[i] && res.push(vals[i](index));
    }
    return res.join('');
  };
}
