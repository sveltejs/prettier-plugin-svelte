export const snippedTagContentAttribute = '✂prettier:content✂'

export function snipTagContent(tagName: string, source: string, placeholder = ''): string {
    const regex = new RegExp(`[\\s\n]*<${tagName}([^]*?)>([^]*?)<\/${tagName}>[\\s\n]*`, 'gi');
    return source.replace(regex, (_, attributes, content) => {
        const encodedContent = Buffer.from(content).toString('base64');
        return `<${tagName}${attributes} ${snippedTagContentAttribute}="${encodedContent}">${placeholder}</${tagName}>`;
    });
}

export function hasSnippedContent(text: string) {
    return text.includes(snippedTagContentAttribute);
}

export function unsnipContent(text: string): string {
    const regex = /(<\w+.*?)\s*✂prettier:content✂="(.*?)">.*?(?=<\/)/gi;

    return text.replace(regex, (_, start, encodedContent) => {
        const content = Buffer.from(encodedContent, 'base64').toString('utf8');
        return `${start}>${content}`;
    });
}
