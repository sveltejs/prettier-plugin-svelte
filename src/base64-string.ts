// Base64 string encoding and decoding module.
// Uses Buffer for Node.js and btoa/atob for browser environments.

export const stringToBase64 =
    typeof Buffer !== 'undefined'
        ? (str: string) => Buffer.from(str).toString('base64')
        : (str: string) => btoa(str);

export const base64ToString =
    typeof Buffer !== 'undefined'
        ? (str: string) => Buffer.from(str, 'base64').toString()
        : (str: string) => atob(str);
