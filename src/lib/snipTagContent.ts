export const snippedTagContentAttribute = '✂prettier:content✂';

export function snipScriptAndStyleTagContent(source: string): string {
    const scriptMatchSpans = getMatchIndexes('script');
    const styleMatchSpans = getMatchIndexes('style');

    return snipTagContent(
        snipTagContent(source, 'script', '{}', scriptMatchSpans, styleMatchSpans),
        'style',
        '',
        styleMatchSpans,
        scriptMatchSpans,
    );

    function getMatchIndexes(tagName: string) {
        const regex = getRegexp(tagName);
        const indexes: [number, number][] = [];
        let match = null;
        while ((match = regex.exec(source)) != null) {
            indexes.push([match.index, regex.lastIndex]);
        }
        return indexes;
    }

    function snipTagContent(
        _source: string,
        tagName: string,
        placeholder: string,
        ownSpans: [number, number][],
        otherSpans: [number, number][],
    ) {
        const regex = getRegexp(tagName);
        let idx = 0;
        return _source.replace(regex, (match, attributes, content) => {
            if (match.startsWith('<!--') || withinOtherSpan(idx)) {
                return match;
            }
            const encodedContent = Buffer.from(content).toString('base64');
            return `<${tagName}${attributes} ${snippedTagContentAttribute}="${encodedContent}">${placeholder}</${tagName}>`;
        });

        function withinOtherSpan(idx: number) {
            return otherSpans.some(
                (otherSpan) => ownSpans[idx][0] > otherSpan[0] && ownSpans[idx][1] < otherSpan[1],
            );
        }
    }

    function getRegexp(tagName: string) {
        return new RegExp(`<!--[^]*?-->|<${tagName}([^]*?)>([^]*?)<\/${tagName}>`, 'g');
    }
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
