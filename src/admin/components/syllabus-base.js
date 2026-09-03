export class SyllabusBase extends HTMLElement {
  generateId = (() => {
    const ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
    return (e = 12) => {
      let t = '',
        r = window.crypto.getRandomValues(new Uint8Array((e |= 0)));
      for (; e--;) t += ALPHABET[63 & r[e]];
      return t;
    };
  })();

  html = (() => {
    const smartJoin = arr => {
      const needsSpaces = arr.every(item => typeof item === 'number' || !String(item).trim().startsWith('<'));
      return arr.join(needsSpaces ? ' ' : '');
    };

    return (strings, ...values) =>
      strings.reduce((result, string, i) => {
        let value = values[i] ?? '';
        if (Array.isArray(value)) value = smartJoin(value);
        return result + string + value;
      }, '');
  })();
}
