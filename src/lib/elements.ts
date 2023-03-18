export type TagName = keyof HTMLElementTagNameMap | 'svg';

// @see http://xahlee.info/js/html5_non-closing_tag.html
export const selfClosingTags = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
];

// https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements#Elements
export const blockElements: TagName[] = [
    'address',
    'article',
    'aside',
    'blockquote',
    'details',
    'dialog',
    'dd',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'li',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
];

/**
 * HTML attributes that we may safely reformat (trim whitespace, add or remove newlines)
 */
export const formattableAttributes: string[] = [
    // None at the moment
    // Prettier HTML does not format attributes at all
    // and to be consistent we leave this array empty for now
    
    "class"
];
