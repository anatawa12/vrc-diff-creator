import { diffCharacters, longestCommonSubsequence } from "https://deno.land/x/diff@v0.3.3/mod.ts";

if (import.meta.main) {
    console.log(makeTosDiff(await Deno.readTextFile("tos.old.formatted.txt"), await Deno.readTextFile("tos.new.formatted.txt")))
}

function preProcess(input) {
    // General changes are applied at first
    return input
            .replaceAll("TOU", "TOS")  // Terms of Use -> Terms of Service
            .replaceAll("This TOS", "These Terms")
            .replaceAll("this TOS", "these Terms")
            .replaceAll(/\[(\s+)/g, "$1[")  // fix link style
            .replaceAll("\u00A0", " ")  // No Break Space
            .split(/\r|\n|\r\n/g)
}

function wordLine(line) {
    return line
            .replaceAll(/\b|(?<=([\*\.,#\u201C\u201D\(\) ]))(?=[\*\.,#\u201C\u201D\(\) ])(?!\1)/g, "%")
            .split("%")
            .filter(s => !!s);
}

export function makeTosDiff(oldFile, newFile) {
    const oldLines = preProcess(oldFile);
    const newLines = preProcess(newFile);
    const diffList = makeDiff(oldLines, newLines, 3);
    let result = "";
    result += "The following changes are not included in this patch because they're small & generally found:\n";
    result += "  - 'TOS' <-> 'TOU'\n";
    result += "  - 'This TOS' <-> 'Those Terms'\n";
    result += "\n"
    for (const diff of diffList) {
        switch (diff.type) {
            case '@':
                result += "@@@@\n";
                break;
            case ' ':
            case '+':
            case '-':
                result += `${diff.type}${diff.line}\n`;
                break;
            case '*':
                const oldWards = wordLine(diff.oldLine);
                const newWards = wordLine(diff.newLine);
                const wordDiffs = makeDiff(oldWards, newWards, Infinity);
                let oldResult = "-";
                let newResult = "+";

                for (const wordDiff of wordDiffs) {
                    //console.log(JSON.stringify(wordDiff))
                    switch (wordDiff.type) {
                        case '@':
                            throw new Error("logic failure");
                            break;
                        case ' ':
                            oldResult += wordDiff.line;
                            newResult += wordDiff.line;
                            break;
                        case '+':
                            oldResult += '%'.repeat(wordDiff.line.length);
                            newResult += wordDiff.line;
                            break;
                        case '-':
                            oldResult += '%'.repeat(wordDiff.line.length);
                            newResult += wordDiff.line;
                            break;
                        case '*':
                            const lengthDiff = wordDiff.oldLine.length - wordDiff.newLine.length;
                            if (lengthDiff == 0) {
                                oldResult += '%'.repeat(wordDiff.newLine.length) + wordDiff.oldLine;
                                newResult += wordDiff.newLine + '%'.repeat(wordDiff.oldLine.length);
                            } else {
                                oldResult += wordDiff.oldLine + '%'.repeat(Math.max(0, -lengthDiff));
                                newResult += wordDiff.newLine + '%'.repeat(Math.max(0, lengthDiff));
                            }
                            break;
                    }
                }

                result += `${oldResult}\n`;
                result += `${newResult}\n`;
                break;
            default:
                throw new Error();
        }
    }

    return result;
}

// diffCharacters will output to console so wrap it
function diffChars(oldString, newString) {
    const consoleLog = console.log;
    console.log = ()=>{};
    const result = diffCharacters(oldString, newString, false);
    console.log = consoleLog;
    return result;
}

function toLineChars(database, lines) {
    return lines.map(line => String.fromCharCode(addOrFindIndex(database, line))).join("");
}

function addOrFindIndex(database, line) {
    let index = database.indexOf(line);
    if (index != -1) return index;
    index = database.length;
    database.push(line);
    return index;
}

function makeDiff(oldLines, newLines, unifiedCount) {
    // create diff first
    const database = []

    if (oldLines.length == 0) {
        if (newLines.length == 0) {
            return []
        } else {
            return newLines.map(line => ({type: '+', line}));
        }
    } else {
        if (newLines.length == 0) {
            return oldLines.map(line => ({type: '-', line}));
        } else {
            // fallback to normal process
        }
    }

    const oldLineChars = toLineChars(database, oldLines);
    const newLineChars = toLineChars(database, newLines);

    const diffList = diffChars(oldLineChars, newLineChars);

    // create resuult
    // {type: " +-"[number], line: string} | {type: '*', oldLine: string, newLine: string} | {type:'@'}
    const result = [];

    let postUnified = 0;
    let unifiedLines = [];
    let removedLines = [];
    let addedLines = [];

    for (const charInfo of diffList) {
        const line = database[charInfo.character.charCodeAt(0)];
        if (charInfo.wasAdded) {
            emitUnified();
            addedLines.push(line);
            postUnified = unifiedCount;
        } else if (charInfo.wasRemoved) {
            emitUnified();
            removedLines.push(line);
            postUnified = unifiedCount;
        } else {
            emitAddRemoved();
            if (postUnified-- > 0) {
                result.push({type: ' ', line});
            } else {
                unifiedLines.push(line);
                if (unifiedLines.length > unifiedCount) {
                    if (result[result.length - 1]?.type == ' ')
                        result.push({type:'@'});
                    unifiedLines.shift();
                }
            }
        }
    }

    emitAddRemoved();

    // utils for crete result
    function modificationAndAddOrRemove(aLines, bLines, modification, aName, bName) {
        let restOffset = bLines.length - aLines.length;

        while (aLines.length != 0) {
            const currentALine = aLines.shift();

            let bestOffset = 0;
            let bestCommonSubseqLen = 0;
            for (let offset = 0; offset <= restOffset; offset++) {
                if (bLines[offset].length == 0) continue; // bLines[offset].length == 0: it must not be the best
                let LCS = longestCommonSubsequence(currentALine, bLines[offset]);
                if (bestCommonSubseqLen < LCS.length) {
                    bestCommonSubseqLen = LCS.length;
                    bestOffset = offset;
                }
            }

            for (let i = 0; i < bestOffset; i++) {
                result.push({type: modification, line: bLines.shift()});
            }

            restOffset -= bestOffset;

            let currentBLine = bLines.shift();

            result.push({type: '*', [aName]: currentALine, [bName]: currentBLine});

            if (restOffset == 0) break;
        }
        while (aLines.length != 0) {
            result.push({type: '*', [aName]: aLines.shift(), [bName]: bLines.shift()});
        }
    }

    function emitAddRemoved() {
        if (removedLines.length == 0) {
            // fast path: add only
            for (const line of addedLines)
                result.push({type: '+', line});
            addedLines = [];
        } else if (addedLines.length == 0) {
            // fast path: delete only
            for (const line of removedLines)
                result.push({type: '-', line});
            removedLines = [];
        } else if (removedLines.length == addedLines.length) {
            // fast path: modification only
            for (let i = 0; i < removedLines.length; i++) {
                result.push({type: '*', oldLine: removedLines[i], newLine: addedLines[i]});
            }
            addedLines = [];
            removedLines = [];
        } else if (removedLines.length < addedLines.length) {
            // slow path: modification & add
            modificationAndAddOrRemove(removedLines, addedLines, '+', "oldLine", "newLine");
        } else {
            // slow path: modification & remove
            modificationAndAddOrRemove(addedLines, removedLines, '-', "newLine", "oldLine");
        }
    }

    function emitUnified() {
        for (const line of unifiedLines)
            result.push({type: ' ', line});
        unifiedLines = [];
    }

    return result;
}
