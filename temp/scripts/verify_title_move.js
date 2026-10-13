// 验证术语标题移动到描述卡
const s = require("fs").readFileSync("index.html", "utf8");
console.log("inline-count:", (s.match(/id="glossaryHeaderInline"/g) || []).length);
const cardPos = s.indexOf('id="glossaryDescCard"');
const inlinePos = s.indexOf('id="glossaryHeaderInline"');
const metaPos = s.indexOf('class="glossary-desc-meta"');
console.log("inline-inside-card-top:", inlinePos > cardPos && inlinePos < metaPos);
console.log("name-span-inside-card:", s.indexOf('id="glossaryHeaderNameInline"') > cardPos && s.indexOf('id="glossaryHeaderNameInline"') < metaPos);
console.log("toolbar-left-clean:", !/toolbar-left[\s\S]{0,120}glossaryHeaderInline/.test(s));
console.log("edit-btn-inside-card:", s.indexOf('id="glossaryEditBtn"') > cardPos && s.indexOf('id="glossaryEditBtn"') < metaPos);
