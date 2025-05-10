import { visit } from 'unist-util-visit';

/**
 * Converts numbers 1-99 to Chinese numeral representation
 * @param {number} num - Integer between 1 and 99
 * @returns {string} Chinese numeral representation of the input number
 */
function numberToChinese(num) {
    // Parameter validation
    if (!Number.isInteger(num) || num < 1 || num > 99) {
        throw new Error(`Please input an integer between 1-99: ${num}`);
    }

    // Basic numeral mapping
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

    // Return directly for single digits
    if (num < 10) {
        return digits[num];
    }

    // Handle double digits
    const tens = Math.floor(num / 10);
    const ones = num % 10;

    let result = '';

    // Process tens place
    if (tens === 1) {
        result = '十';
    } else {
        result = digits[tens] + '十';
    }

    // Process ones place
    if (ones !== 0) {
        result += digits[ones];
    }

    return result;
}

/**
 * Applies a regex pattern to node children and replaces matches with a template
 * @param {Object} node - AST node containing children to process
 * @param {RegExp} regex - Regular expression pattern to match
 * @param {string} template - Template string to replace matches
 * @returns {Array} New array of node children with replacements applied
 */
function regex(node, regex, template) {
    const newChildren = [];

    for (const child of node.children) {
        // Process both html and text nodes to avoid missing matches
        if (child.type !== 'text' && child.type !== 'html' && child.type !== 'blockquote') {
            newChildren.push(child);
            continue;
        }

        if (child.value.replace(regex, template) === child.value) {
            if (child.type === "html") {
                newChildren.push(child)
            } else {
                newChildren.push({
                    type: "text",
                    value: child.value
                })
            }
        } else {
            newChildren.push({
                type: "html",
                value: child.value.replace(regex, template)
            })
        }
    }

    return newChildren;
}

/**
 * Processes image nodes and adds numbered figure captions
 * @param {Object} node - AST node containing children to process
 * @returns {Array} New array of node children with image captions added
 */
function imgRegex(node) {
    const newChildren = [];

    if (typeof imgRegex.imgNum === 'undefined') {
        imgRegex.imgNum = 0;
    }

    for (const child of node.children) {
        if (child.type !== 'image') {
            newChildren.push(child);
            continue;
        }

        newChildren.push(child)

        imgRegex.imgNum = imgRegex.imgNum + 1;
        newChildren.push({
            type: "html",
            value: `<p class="img_title"><a href="#img_forward_link_图${numberToChinese(imgRegex.imgNum)}" id="img_backward_link_图${numberToChinese(imgRegex.imgNum)}">图${numberToChinese(imgRegex.imgNum)}</a>：${child.alt}</p>`
        })
    }

    return newChildren;
}

/**
 * Processes table nodes and adds numbered table captions
 * @param {Object} node - AST node containing children to process
 * @returns {Array} New array of node children with table captions added
 */
function tblRegex(node) {
    const newChildren = [];
    let isInTbl = false;
    let isFirstRow = true;
    let currentTblTitle = "";

    if (typeof tblRegex.tblNum === 'undefined') {
        tblRegex.tblNum = 0;
    }

    for (const child of node.children) {
        if (child.type !== 'tableRow') {
            if (isInTbl === true) {
                tblRegex.tblNum = tblRegex.tblNum + 1;
                newChildren.push({
                    type: "html",
                    value: `<p class="tbl_title"><a href="#tbl_forward_link_表${numberToChinese(tblRegex.tblNum)}" id="tbl_backward_link_表${numberToChinese(tblRegex.tblNum)}">表${numberToChinese(tblRegex.tblNum)}</a>：${currentTblTitle}</p>`
                });
                isInTbl = false;
            }
            newChildren.push(child);
            continue;
        }

        isInTbl = true;

        if (isFirstRow && child.children && child.children[0]) {
            const firstCell = child.children[0];
            if (firstCell.children && firstCell.children[0]) {
                currentTblTitle = firstCell.children[0].value || "";
                firstCell.children[0].value = "";
            }
            isFirstRow = false;
        }

        newChildren.push(child);
    }

    if (isInTbl === true) {
        tblRegex.tblNum = tblRegex.tblNum + 1;
        newChildren.push({
            type: "html",
            value: `<p class="tbl_title"><a href="#tbl_forward_link_表${numberToChinese(tblRegex.tblNum)}" id="tbl_backward_link_表${numberToChinese(tblRegex.tblNum)}">表${numberToChinese(tblRegex.tblNum)}</a>：${currentTblTitle}</p>`
        });
    }

    return newChildren;
}

// Global storage for footnotes
let collectedFootnotes = [];

/**
 * Processes standard format footnotes [^content]
 * @param {Object} node - AST node containing children to process
 * @returns {Array} New array of node children with footnote references added
 */
function footnoteRegex(node) {
    if (typeof footnoteRegex.footNoteNum === 'undefined') {
        footnoteRegex.footNoteNum = 0;
    }

    const newChildren = [];

    for (const child of node.children) {
        if (child.type !== 'text' && child.type !== 'html') {
            newChildren.push(child);
            continue;
        }

        // Only match standard footnote format: [^content]
        let modified = false;
        let modifiedText = child.value;
        let contentToProcess = child.value;

        // Process standard format footnotes [^content]
        const properFootnoteRegex = /\[\^(?!表|图)([^\]]*?)\]/g;
        let properMatch;
        while ((properMatch = properFootnoteRegex.exec(contentToProcess)) !== null) {
            footnoteRegex.footNoteNum++;
            const footnoteNum = footnoteRegex.footNoteNum;
            const footnoteContent = properMatch[1];

            // Replace with reference link
            const reference = `<a class="comment_forward_link" href="#comment_backward_link_${footnoteNum}" id="comment_forward_link_${footnoteNum}">[${footnoteNum}]</a>`;

            // Create escaped version of original match for replacement
            const escapedOriginal = properMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const replaceRegex = new RegExp(escapedOriginal, 'g');
            modifiedText = modifiedText.replace(replaceRegex, reference);
            modified = true;

            // Store footnote for later insertion
            collectedFootnotes.push({
                num: footnoteNum,
                content: footnoteContent
            });
        }

        // Add modified or original text
        if (modified) {
            newChildren.push({
                type: "html",
                value: modifiedText
            });
        } else {
            newChildren.push(child);
        }
    }

    return newChildren;
}

/**
 * Main plugin function that replaces markdown elements with HTML
 * @returns {Function} Transformer function to be used by unified/remark
 */
export default function markdownReplace() {
    imgRegex.imgNum = 0;
    tblRegex.tblNum = 0;
    footnoteRegex.footNoteNum = 0;
    collectedFootnotes = [];

    return (tree) => {
        visit(tree, ['paragraph', 'table', 'tableCell'], (node) => {
            if (!node.children) return;

            node.children = footnoteRegex(node);

            node.children = imgRegex(node);
            node.children = regex(node, /\[\^(图.*?)\]/g, '<a href="#img_backward_link_$1" id="img_forward_link_$1">$1</a>');

            node.children = tblRegex(node);
            node.children = regex(node, /\[\^(表.*?)\]/g, '<a href="#tbl_backward_link_$1" id="tbl_forward_link_$1">$1</a>');

            // Add italic formatting for text within Chinese angle brackets 「」
            node.children = regex(node, /「([^」]*?)」/g, '「<em>$1</em>」');

            // Add bold formatting for text within Chinese double quotes ""
            node.children = regex(node, /“([^”]*?)”/g, '“<strong>$1</strong>”');

            node.children = regex(node, /(——.*)/g, '<p style="text-align: right">$1</p>');
        });

        // Add footnotes section at the end if we have any footnotes
        if (collectedFootnotes.length > 0) {
            // Add a divider
            tree.children.push({
                type: "html",
                value: "<hr class='footnote-separator'>"
            });

            // Add a heading for footnotes
            // tree.children.push({
            //     type: "html",
            //     value: "<h3 class='footnotes-title'>脚注</h3>"
            // });

            // Add all footnotes
            for (const footnote of collectedFootnotes) {
                tree.children.push({
                    type: "html",
                    value: `<table class="comment"><tr class="comment"><td class="comment"><a href="#comment_forward_link_${footnote.num}" id="comment_backward_link_${footnote.num}">[${footnote.num}]</a></td><td class="comment">${footnote.content}</td></tr></table>`
                });
            }
        }
    };
}
