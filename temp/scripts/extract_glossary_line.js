// 提取 index.html 中 initGlossary / glossary 相关超长行到 temp/data/ 便于阅读
const fs = require("fs");
const lines = fs.readFileSync("index.html", "utf8").split("\n");
const out = [];
lines.forEach((line, i) => {
  if (/initGlossary|renderHeader|glossaryTabs|switchGlossaryTab|GLOSSARY/.test(line)) {
    out.push(`===== line ${i + 1} (len ${line.length}) =====\n${line}`);
  }
});
fs.writeFileSync("temp/data/glossary_lines.txt", out.join("\n\n"), "utf8");
console.log("done, matched", out.length, "lines");
