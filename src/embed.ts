import { Doc, doc, FastPath, ParserOptions } from 'prettier';
import { getText } from './lib/getText';
import { snippedTagContentAttribute } from './lib/snipTagContent';
import { PrintFn } from './print';
import { isLine, trimRight } from './print/doc-helpers';
import {
    getAttributeTextValue,
    getLeadingComment,
    isIgnoreDirective,
    isNodeSupportedLanguage,
    isTypeScript,
} from './print/node-helpers';
import { Node } from './print/nodes';

const {
    builders: { concat, hardline, group, indent, literalline },
    utils: { removeLines },
} = doc;

export function embed(
    path: FastPath,
    print: PrintFn,
    textToDoc: (text: string, options: object) => Doc,
    options: ParserOptions,
): Doc | null {
    const node: Node = path.getNode();

    if (node.isJS) {
        try {
            const embeddedOptions: any = {
                parser: expressionParser,
            };
            if (node.forceSingleQuote) {
                embeddedOptions.singleQuote = true;
            }

            const docs = textToDoc(forceIntoExpression(getText(node, options)), embeddedOptions);
            return node.forceSingleLine ? removeLines(docs) : docs;
        } catch (e) {
            return getText(node, options);
        }
    }

    const embedType = (
        tag: string,
        parser: 'typescript' | 'babel-ts' | 'css',
        isTopLevel: boolean,
    ) =>
        embedTag(
            tag,
            path,
            (content) => formatBodyContent(content, parser, textToDoc, options),
            print,
            isTopLevel,
        );

    const embedScript = (isTopLevel: boolean) =>
        embedType(
            'script',
            // Use babel-ts as fallback because the absence does not mean the content is not TS,
            // the user could have set the default language. babel-ts will format things a little
            // bit different though, especially preserving parentheses around dot notation which
            // fixes https://github.com/sveltejs/prettier-plugin-svelte/issues/218
            isTypeScript(node) ? 'typescript' : 'babel-ts',
            isTopLevel,
        );
    const embedStyle = (isTopLevel: boolean) => embedType('style', 'css', isTopLevel);

    switch (node.type) {
        case 'Script':
            return embedScript(true);
        case 'Style':
            return embedStyle(true);
        case 'Element': {
            if (node.name === 'script') {
                return embedScript(false);
            } else if (node.name === 'style') {
                return embedStyle(false);
            }
        }
    }

    return null;
}

function forceIntoExpression(statement: string) {
    // note the trailing newline: if the statement ends in a // comment,
    // we can't add the closing bracket right afterwards
    return `(${statement}\n)`;
}

function expressionParser(text: string, parsers: any, options: any) {
    const ast = parsers.babel(text, parsers, options);

    return { ...ast, program: ast.program.body[0].expression };
}

function preformattedBody(str: string): Doc {
    const firstNewline = /^[\t\f\r ]*\n/;
    const lastNewline = /\n[\t\f\r ]*$/;

    // If we do not start with a new line prettier might try to break the opening tag
    // to keep it together with the string. Use a literal line to skip indentation.
    return concat([literalline, str.replace(firstNewline, '').replace(lastNewline, ''), hardline]);
}

function getSnippedContent(node: Node) {
    const encodedContent = getAttributeTextValue(snippedTagContentAttribute, node);

    if (encodedContent) {
        return Buffer.from(encodedContent, 'base64').toString('utf-8');
    } else {
        return '';
    }
}

function formatBodyContent(
    content: string,
    parser: 'typescript' | 'babel-ts' | 'css',
    textToDoc: (text: string, options: object) => Doc,
    options: ParserOptions,
) {
    const indentContent = options.svelteIndentScriptAndStyle;

    try {
        const indentIfDesired = (doc: Doc) => (indentContent ? indent(doc) : doc);

        const body = textToDoc(content, { parser });
        trimRight([body], isLine);
        return concat([indentIfDesired(concat([hardline, body])), hardline]);
    } catch (error) {
        if (process.env.PRETTIER_DEBUG) {
            throw error;
        }

        // We will wind up here if there is a syntax error in the embedded code. If we throw an error,
        // prettier will try to print the node with the printer. That will fail with a hard-to-interpret
        // error message (e.g. "Unsupported node type", referring to `<script>`).
        // Therefore, fall back on just returning the unformatted text.
        console.error(error);

        return preformattedBody(content);
    }
}

function embedTag(
    tag: string,
    path: FastPath,
    formatBodyContent: (content: string) => Doc,
    print: PrintFn,
    isTopLevel: boolean,
) {
    const node: Node = path.getNode();
    const content = getSnippedContent(node);
    const previousComment = getLeadingComment(path);

    const body: Doc =
        isNodeSupportedLanguage(node) && !isIgnoreDirective(previousComment)
            ? content.trim() !== ''
                ? formatBodyContent(content)
                : content === ''
                ? ''
                : hardline
            : preformattedBody(content);

    const attributes = concat(
        path.map(
            (childPath) =>
                childPath.getNode().name !== snippedTagContentAttribute
                    ? childPath.call(print)
                    : '',
            'attributes',
        ),
    );

    let result: Doc = group(
        concat(['<', tag, indent(group(attributes)), '>', body, '</', tag, '>']),
    );

    if (isTopLevel) {
        // top level embedded nodes have been moved from their normal position in the
        // node tree. if there is a comment referring to it, it must be recreated at
        // the new position.
        if (previousComment) {
            result = concat(['<!--', previousComment.data, '-->', hardline, result, hardline]);
        } else {
            result = concat([result, hardline]);
        }
    }

    return result;
}
