// 验证工具栏与页签同行改动
const s = require("fs").readFileSync("index.html", "utf8");
console.log("js-append-into-row:", s.includes("if (toolbar.parentElement !== tabRow) tabRow.appendChild(toolbar)"));
console.log("css-row-flex:", s.includes("#glossaryTabRow { display:flex;align-items:center;justify-content:space-between"));
console.log("css-toolbar-in-row:", s.includes("#glossaryTabRow .toolbar { flex:1;min-width:0;justify-content:flex-end"));
console.log("old-insert-after-row-gone:", !s.includes("tabRow.insertAdjacentElement(\"afterend\", toolbar)"));
