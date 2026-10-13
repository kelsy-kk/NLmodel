// 验证描述块改动是否就位
const s = require("fs").readFileSync("index.html", "utf8");
console.log("meta-fill(renderHeader):", s.includes('mc.textContent = g.creator || "系统管理员"'));
console.log("meta-fill-time:", s.includes('mt.textContent = g.createdAt || "—"'));
console.log("meta-fill-domain:", s.includes('md.textContent = g.domain || "—"'));
console.log("seed-creator:", s.includes('creator: "王丽"'));
console.log("desc-card-before-tabs:", s.indexOf('id="glossaryDescCard"') < s.indexOf('id="glossaryTabRow"'));
console.log("meta-css:", s.includes(".glossary-desc-meta"));
