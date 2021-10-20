import { base64ToString, stringToBase64 } from '../helpers';

export const snippedTagContentAttribute = '✂prettier:content✂';

export function snipScriptAndStyleTagContent(source: string): string {
    const scriptMatchSpans = getMatchIndexes('script');
    const styleMatchSpans = getMatchIndexes('style');

    return snipTagContent(
        snipTagContent(source, 'script', '{}', styleMatchSpans),
        'style',
        '',
        scriptMatchSpans,
    );

    function getMatchIndexes(tagName: string) {
        const regex = getRegexp(tagName);
        const indexes: [number, number][] = [];
        let match = null;
        while ((match = regex.exec(source)) != null) {
            if (!source.substr(match.index, 10).startsWith('<!--')) {
                indexes.push([match.index, regex.lastIndex]);
            }
        }
        return indexes;
    }

    function snipTagContent(
        _source: string,
        tagName: string,
        placeholder: string,
        otherSpans: [number, number][],
    ) {
        // Replace valid matches
        const regex = getRegexp(tagName);
        const newSource = _source.replace(regex, (match, attributes, content, index) => {
            if (match.startsWith('<!--') || withinOtherSpan(index)) {
                return match;
            }
            const encodedContent = stringToBase64(content);
            return `<${tagName}${attributes} ${snippedTagContentAttribute}="${encodedContent}">${placeholder}</${tagName}>`;
        });

        // Adjust the spans because the source now has a different content length
        adjustSpans(scriptMatchSpans);
        adjustSpans(styleMatchSpans);

        return newSource;

        function withinOtherSpan(idx: number) {
            return otherSpans.some((otherSpan) => idx > otherSpan[0] && idx < otherSpan[1]);
        }
        function adjustSpans(spans: [number, number][]) {
            const lengthDiff = _source.length - newSource.length;
            spans.forEach((span) => {
                span[0] -= lengthDiff;
                span[1] -= lengthDiff;
            });
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
        const content = base64ToString(encodedContent);
        return `${start}>${content}`;
    });
}
