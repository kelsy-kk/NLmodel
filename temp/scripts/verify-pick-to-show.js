const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "../..");
const srcHtml = fs.readFileSync(path.join(root, "index_v2.0.html"), "utf8");
const tmpPage = path.join(root, "_verify_pick_to_show.html");

const probe = `
<script>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__probe = { steps: [], errors: [] };
const outEl = document.createElement("div");
outEl.id = "probeOut";
document.body.appendChild(outEl);
const flush = () => { outEl.textContent = JSON.stringify(window.__probe); };
const push = (t) => { window.__probe.steps.push(t); flush(); };
window.addEventListener("error", (e) => { window.__probe.errors.push(e.message); flush(); });
(async function () {
  try {
    await sleep(1200);
    const ui = window.BizTermUI;
    const chipCount = () => document.querySelectorAll("#termFormMountChips [data-mountchip-remove]").length;
    const openPicker = async () => {
      const picker = document.getElementById("termFormMountPicker");
      if (picker && !picker.hidden) { picker.hidden = true; await sleep(80); }
      document.getElementById("termFormMountAdd").click();
      await sleep(150);
      return picker;
    };
    const groups = () => [...document.querySelectorAll("#termFormMountPickerList .term-mount-picker-group")].map((g) => g.textContent.trim());

    /* 1. 打开创建表单，切业务资产 → 不自动展示已选 */
    document.getElementById("termCreateBtn").click();
    await sleep(200);
    document.querySelector('input[name="termFormKind"][value="asset"]').click();
    await sleep(200);
    push("noAutoChips=" + (chipCount() === 0));

    /* 2. 数据集类型：候选下拉只加载数据集组 */
    await openPicker();
    push("datasetScopeGroups=" + JSON.stringify(groups()));
    push("scopeLabel=" + document.getElementById("termFormMountScope").textContent);

    /* 3. 勾选一个数据集 → 才展示为 chip */
    const dsInput = document.querySelector('#termFormMountPickerList input[data-formmount][value^="dataset:"]');
    dsInput.checked = true;
    dsInput.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    push("chipAfterPick=" + (chipCount() === 1) + " " + document.getElementById("termFormMountChips").textContent.replace(/\\s+/g, " ").trim());

    /* 4. 切维度类型：候选组变为维度，已选数据集 chip 保留 */
    const typeEl = document.getElementById("termFormType");
    typeEl.value = "dimension";
    typeEl.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    push("dimScopeGroups=" + JSON.stringify(groups()));
    push("pickedKept=" + (chipCount() === 1));

    /* 5. 勾选一个维度 → 2 个 chip */
    const dimInput = document.querySelector('#termFormMountPickerList input[data-formmount][value^="dimension:"]');
    dimInput.checked = true;
    dimInput.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    push("chipsTwo=" + (chipCount() === 2));

    /* 6. 过滤类型：候选组为全部 */
    typeEl.value = "filter";
    typeEl.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    push("filterGroupsAll=" + JSON.stringify(groups()));

    /* 7. 保存落盘 */
    document.getElementById("termFormName").value = "走查勾选展示术语C";
    document.getElementById("termFormSaveBtn").click();
    await sleep(400);
    const confirmBtn = document.getElementById("termSaveConfirmBtn");
    if (confirmBtn && !document.getElementById("termSaveConfirm").hidden) {
      confirmBtn.click();
      await sleep(400);
    }
    const created = (window.TermModule.readTerms() || []).find((t) => t.name === "走查勾选展示术语C");
    const keys = (created?.mounts || []).map((m) => m.key);
    push("created=" + Boolean(created) + " mounts=" + JSON.stringify(keys));
    push("exactlyPicked=" + (keys.length === 2 && keys.some((k) => k.startsWith("dataset:")) && keys.some((k) => k.startsWith("dimension:"))));
  } catch (err) {
    window.__probe.errors.push("probe:" + err.message);
  }
  flush();
})();
</script>
`;

const idx = srcHtml.lastIndexOf("</body>");
fs.writeFileSync(tmpPage, srcHtml.slice(0, idx) + probe + srcHtml.slice(idx), "utf8");

const url = "file:///" + tmpPage.replace(/\\/g, "/");
let out = "";
try {
  out = execFileSync(
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--user-data-dir=C:\\Windows\\Temp\\edge-pick-show-" + Date.now(), "--virtual-time-budget=20000", "--dump-dom", url],
    { maxBuffer: 300 * 1024 * 1024, encoding: "utf8" }
  );
} catch (err) {
  console.log("EDGE ERR", String(err.message).slice(0, 200));
}

const m = out.match(/<div id="probeOut">([\s\S]*?)<\/div>/);
console.log(m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "PROBE NOT FOUND");
fs.unlinkSync(tmpPage);
