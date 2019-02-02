export function snipTagContent(tagName: string, source: string, placeholder = '') {
    const regex = new RegExp(`<${tagName}([^]*?)>([^]*?)<\/${tagName}>`, 'gi');
    return source.replace(regex, (_, attributes, content) => {
        const encodedContext = Buffer.from(content).toString('base64');
        return `<${tagName}${attributes} ✂prettier:content✂="${encodedContext}">${placeholder}</${tagName}>`;
    });
}
