// 提取 termCount 定义与 renderHeader 完整行
const fs = require("fs");
const lines = fs.readFileSync("index.html", "utf8").split("\n");
const out = [];
lines.forEach((line, i) => {
  if (/function termCount|termCount\s*=/.test(line) || /glossaryEmptyState/.test(line)) {
    out.push(`===== line ${i + 1} =====\n${line}`);
  }
});
fs.writeFileSync("temp/data/termcount_lines.txt", out.join("\n\n"), "utf8");
console.log("matched", out.length);
