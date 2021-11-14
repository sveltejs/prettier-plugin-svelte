/**
 * Use this for a browser/node-crossplatform compatible way of
 * converting a string to a base64 string
 */
export function stringToBase64(str: string): string {
    return typeof btoa !== 'undefined' ? btoa(str) : Buffer.from(str).toString('base64');
}

/**
 * Use this for a browser/node-crossplatform compatible way of
 * converting a base64 string to a string
 */
export function base64ToString(str: string): string {
    return typeof atob !== 'undefined' ? atob(str) : Buffer.from(str, 'base64').toString();
}
