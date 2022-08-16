import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
async function fetchText(url) { return await (await fetch(url)).text() }
// library loading
Function(await fetchText("https://unpkg.com/showdown@2.1.0/dist/showdown.min.js")).call(globalThis);
// showdown requires window.document support
globalThis.window.document = new DOMParser().parseFromString("", "text/html");

if (import.meta.main) {
    // load input
    const waybackPrefix = "http://web.archive.org/web/20220809180003/";
    //const rawHtml = await fetchText("https://hello.vrchat.com/legal");
    const rawHtml = await fetchText(`${waybackPrefix}https://hello.vrchat.com/legal`);
    //const rawHtml = await Deno.readTextFile("tos.new.html");
    console.log(formatHTML2Markdown(await fetchText(`${waybackPrefix}https://hello.vrchat.com/legal`)));
}

export function formatHTML2Markdown(rawHtml) {
    const rawDom = new DOMParser().parseFromString(rawHtml, "text/html");
    // name of document such as "TERMS OF SERVICE"
    const document_name = rawDom.querySelector("h3")
    // find section element
    let section = document_name
    while (section.tagName != "SECTION") section = section.parentElement
    // next section is body of
    const bodyDomElement = section.nextElementSibling

    //const bodyDomElement = rawDom.querySelector("h2").parentElement.parentElement.parentElement

    // remove span based decorations
    bodyDomElement.querySelectorAll("span").forEach(e => e.replaceWith(...e.childNodes))
    //const contents = bodyDomElement.querySelectorAll(":scope > div > div > *")
    const contents = bodyDomElement.querySelectorAll(".sqs-block-content > *")
    const bodyHTML = Array.from(contents).map((k) => k.outerHTML).join("");

    const rawMarkdown = new showdown.Converter().makeMarkdown(bodyHTML)
        .replaceAll(/https?:\/\/web.archive.org\/web\/\d+\//g, "") // wayback prefix
        .replaceAll(/\/web\/20220809180027\/https:\/\/hello.vrchat.com/g, "") // another format of prefix
        .replaceAll("<br>", "");

    //console.log(rawMarkdown);
    //console.log("=============================================");

    const markdown = rawMarkdown
            .replaceAll(/(?<!https)(?<!http)(?<!mailto)(?<!Notice)([;:])( and| or)? *(?=.)/g, "$1\n  ")
            .replaceAll(/(?<!Inc)(?<!\d)(?<!\\)(?<!\n.)\.(\**)( +)/g, ".$1\n");

    return markdown;
}

// 's.\n/g; s/TOU/TOS/g'

// tos location:

//https://hello.vrchat.com/legal
//#page-section-5f08b266b6577277d96cb28e > div:nth-child(1) > div:nth-child(1)

//http://web.archive.org/web/20220809180003/https://hello.vrchat.com/legal
//#page-section-5f08b266b6577277d96cb28e > div:nth-child(1) > div:nth-child(1)