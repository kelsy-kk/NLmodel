// 验证工具栏联动改动
const s = require("fs").readFileSync("index.html", "utf8");
console.log("fn-defined:", s.includes("function syncTermToolbarState()"));
console.log("tab-click-hook:", s.includes("tab.classList.add(\"active\"); syncTermToolbarState();"));
console.log("observer-hook:", s.includes("renderHeader(); syncTermToolbarState(); }).observe"));
console.log("init-hook:", s.includes("renderHeader(); syncTermToolbarState(); document.getElementById(\"glossaryList\")"));
console.log("call-count:", (s.match(/syncTermToolbarState\(\)/g) || []).length);
