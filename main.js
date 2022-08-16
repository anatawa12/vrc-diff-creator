import {formatHTML2Markdown} from "./format.js"
import {makeTosDiff} from "./diff.js"
import {writeAll} from "https://deno.land/std@0.152.0/streams/conversion.ts";

async function downloadAndFromat2Markdown(link, version) {
    let waybackPrefix
    if (version == "" || version == "current") {
        waybackPrefix = "";
    } else {
        waybackPrefix = `http://web.archive.org/web/${version.padEnd('0', 8 + 6)}/`;
    }
    const rawHtml = await fetch(`${waybackPrefix}https://hello.vrchat.com/${link}`).then(x => x.text());
    return formatHTML2Markdown(rawHtml, waybackPrefix);
}

if (import.meta.main) {
    const link = Deno.args[0] ?? 'legal';
    const oldName = Deno.args[1] ?? 'current';
    const newName = Deno.args[2] ?? 'current';
    const [oldMark, newMark] = await Promise.all([
        downloadAndFromat2Markdown(link, oldName),
        downloadAndFromat2Markdown(link, newName),
    ]);
    const diffText = makeTosDiff(oldMark, newMark);
    console.log(`compareing ${oldName} and ${newName}`);
    await writeAll(Deno.stdout, new TextEncoder().encode(diffText));
}
