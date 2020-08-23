import test from 'ava';
import prettier, { Doc } from 'prettier';
import { time } from 'console';

const printDocToString = prettier.doc.printer.printDocToString;

const docGithubBug = {
    "type": "group",
    "contents": {
      "type": "concat",
      "parts": [
        {
          "type": "concat",
          "parts": [
            "",
            {
              "type": "concat",
              "parts": [
                {
                  "type": "break-parent"
                },
                {
                  "type": "group",
                  "contents": {
                    "type": "concat",
                    "parts": [
                      "<",
                      "div",
                      {
                        "type": "indent",
                        "contents": {
                          "type": "group",
                          "contents": {
                            "type": "concat",
                            "parts": [
                              "",
                              ""
                            ]
                          },
                          "break": false
                        }
                      },
                      ">",
                      {
                        "type": "indent",
                        "contents": {
                          "type": "concat",
                          "parts": [
                            {
                              "type": "line",
                              "soft": true
                            },
                            {
                              "type": "concat",
                              "parts": [
                                {
                                    "type": "group",
                                    "contents": {
                                    "type": "concat",
                                    "parts": [
                                        "<",
                                        "a",
                                        {
                                        "type": "indent",
                                        "contents": {
                                            "type": "group",
                                            "contents": {
                                            "type": "concat",
                                            "parts": [
                                                "",
                                                {
                                                "type": "concat",
                                                "parts": [
                                                    {
                                                    "type": "line"
                                                    },
                                                    {
                                                    "type": "group",
                                                    "contents": {
                                                        "type": "concat",
                                                        "parts": [
                                                        "href",
                                                        "=",
                                                        "\"",
                                                        {
                                                            "type": "fill",
                                                            "parts": [
                                                            "/some-long-href-lorem-ipsum/"
                                                            ]
                                                        },
                                                        "\""
                                                        ]
                                                    },
                                                    "break": false
                                                    }
                                                ]
                                                },
                                                ""
                                            ]
                                            },
                                            "break": false
                                        }
                                        },
                                        ">",
                                        {
                                        "type": "indent",
                                        "contents": {
                                            "type": "concat",
                                            "parts": [
                                            "",
                                            {
                                                "type": "fill",
                                                "parts": [
                                                "Lorem",
                                                {
                                                    "type": "line"
                                                },
                                                "ipsum",
                                                {
                                                    "type": "line"
                                                },
                                                "lorem",
                                                {
                                                    "type": "line"
                                                },
                                                "ipsum",
                                                {
                                                    "type": "line"
                                                },
                                                "1"
                                                ]
                                            },
                                            ""
                                            ]
                                        }
                                        },
                                        {
                                        "type": "concat",
                                        "parts": [
                                            "</",
                                            "a",
                                            ">"
                                        ]
                                        }
                                    ]
                                    },
                                    "break": false
                                },
                                {
                                  "type": "fill",
                                  "parts": [
                                    ",",
                                    {
                                      "type": "line"
                                    }
                                  ]
                                },
                                {
                                  "type": "concat",
                                  "parts": [
                                    {
                                      "type": "group",
                                      "contents": {
                                        "type": "concat",
                                        "parts": [
                                          "<",
                                          "a",
                                          {
                                            "type": "indent",
                                            "contents": {
                                              "type": "group",
                                              "contents": {
                                                "type": "concat",
                                                "parts": [
                                                  "",
                                                  {
                                                    "type": "concat",
                                                    "parts": [
                                                      {
                                                        "type": "line"
                                                      },
                                                      {
                                                        "type": "group",
                                                        "contents": {
                                                          "type": "concat",
                                                          "parts": [
                                                            "href",
                                                            "=",
                                                            "\"",
                                                            {
                                                              "type": "fill",
                                                              "parts": [
                                                                "/some-long-href-lorem-ipsum/"
                                                              ]
                                                            },
                                                            "\""
                                                          ]
                                                        },
                                                        "break": false
                                                      }
                                                    ]
                                                  },
                                                  ""
                                                ]
                                              },
                                              "break": false
                                            }
                                          },
                                          ">",
                                          {
                                            "type": "indent",
                                            "contents": {
                                              "type": "concat",
                                              "parts": [
                                                "",
                                                {
                                                  "type": "fill",
                                                  "parts": [
                                                    "Lorem",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "ipsum",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "lorem",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "ipsum",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "2"
                                                  ]
                                                },
                                                ""
                                              ]
                                            }
                                          },
                                          {
                                            "type": "concat",
                                            "parts": [
                                              "</",
                                              "a",
                                              ">"
                                            ]
                                          }
                                        ]
                                      },
                                      "break": false
                                    }
                                  ]
                                },
                                {
                                  "type": "fill",
                                  "parts": [
                                    ",",
                                    {
                                      "type": "line"
                                    }
                                  ]
                                },
                                {
                                  "type": "concat",
                                  "parts": [
                                    {
                                      "type": "group",
                                      "contents": {
                                        "type": "concat",
                                        "parts": [
                                          "<",
                                          "a",
                                          {
                                            "type": "indent",
                                            "contents": {
                                              "type": "group",
                                              "contents": {
                                                "type": "concat",
                                                "parts": [
                                                  "",
                                                  {
                                                    "type": "concat",
                                                    "parts": [
                                                      {
                                                        "type": "line"
                                                      },
                                                      {
                                                        "type": "group",
                                                        "contents": {
                                                          "type": "concat",
                                                          "parts": [
                                                            "href",
                                                            "=",
                                                            "\"",
                                                            {
                                                              "type": "fill",
                                                              "parts": [
                                                                "/some-long-href-lorem-ipsum/"
                                                              ]
                                                            },
                                                            "\""
                                                          ]
                                                        },
                                                        "break": false
                                                      }
                                                    ]
                                                  },
                                                  ""
                                                ]
                                              },
                                              "break": false
                                            }
                                          },
                                          ">",
                                          {
                                            "type": "indent",
                                            "contents": {
                                              "type": "concat",
                                              "parts": [
                                                "",
                                                {
                                                  "type": "fill",
                                                  "parts": [
                                                    "Lorem",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "ipsum",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "lorem",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "ipsum",
                                                    {
                                                      "type": "line"
                                                    },
                                                    "3"
                                                  ]
                                                },
                                                ""
                                              ]
                                            }
                                          },
                                          {
                                            "type": "concat",
                                            "parts": [
                                              "</",
                                              "a",
                                              ">"
                                            ]
                                          }
                                        ]
                                      },
                                      "break": false
                                    }
                                  ]
                                }
                              ]
                            },
                            {
                              "type": "align",
                              "contents": {
                                "type": "line",
                                "soft": true
                              },
                              "n": -1
                            }
                          ]
                        }
                      },
                      {
                        "type": "concat",
                        "parts": [
                          "</",
                          "div",
                          ">"
                        ]
                      }
                    ]
                  },
                  "break": true
                }
              ]
            },
            "",
            {
              "type": "concat",
              "parts": [
                {
                  "type": "line",
                  "hard": true
                },
                {
                  "type": "break-parent"
                }
              ]
            }
          ]
        }
      ]
    },
    "break": true
  }

const docSvelte = {
    type: 'group',
    contents: {
        type: 'concat',
        parts: [
            '<div>',
            {
                type: 'indent',
                contents: {
                    type: 'concat',
                    parts: [
                        { type: 'line', soft: true },
                        {
                            type: 'group',
                            contents: {
                                type: 'concat',
                                parts: [
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                    { type: 'line' },
                                    'hubbabubba',
                                ],
                            },
                        },
                    ],
                },
            },
            { type: 'line', soft: true },
            '</div>',
        ],
    },
};

const docSO = {
    type: 'group',
    contents: {
        type: 'concat',
        parts: [
            '<div>',
            {
                type: 'indent',
                contents: {
                    type: 'concat',
                    parts: [{ type: 'line', soft: true }, 'Text', { type: 'break-parent' }],
                },
            },
            { type: 'line', soft: true },
            '</div>',
        ],
    },
}

function repeat(ch: string, times: number) {
    let result = '';

    for (let i = 0; i < times; i++) {
        result += ch;
    }

    return result;
}

test(`deleteme`, (t) => {
    const printWidth = 80;

    const { formatted } = printDocToString(docGithubBug as Doc, {
        printWidth,
        useTabs: false,
        tabWidth: 2,
    });

    t.is(`<div>
  <a href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 1</a>, <a
    href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 2</a>, <a
    href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 3</a>
</div>
`, formatted);
});
