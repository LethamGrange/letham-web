// functions/_utils/html.js

// window.html = (strings, ...values) =>
//   strings.reduce((result, string, i) => {
//     let value = values[i] ?? '';
//
//     if (Array.isArray(value)) {
//       // Smart join: use spaces for numbers/CSS values, empty string for HTML tags
//       const needsSpaces = value.every(item => typeof item === 'number' || !String(item).trim().startsWith('<'));
//       value = value.join(needsSpaces ? ' ' : '');
//     }
//
//     return result + string + value;
//   }, '');

const html = (() => {
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
