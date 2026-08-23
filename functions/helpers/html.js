// functions/_utils/html.js

/**
 * Stripless html template literal tag for Cloudflare Functions.
 * Unlocks Neovim formatting and cleanly flattens map loops without escaping.
 */
export const html = (strings, ...values) =>
  strings.reduce((result, string, i) => {
    let value = values[i] ?? '';

    if (Array.isArray(value)) {
      value = value.join('');
    }

    return result + string + value;
  }, '');
