const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "../..");
const srcHtml = fs.readFileSync(path.join(root, "index_v2.0.html"), "utf8");
const tmpPage = path.join(root, "_verify_type_driven.html");

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

    /* 1. 打开创建表单 */
    document.getElementById("termCreateBtn").click();
    await sleep(200);
    const enhance = document.getElementById("termFormEnhance");
    const fields = [...enhance.querySelectorAll(":scope > .term-form-field")];
    const firstHasType = Boolean(fields[0]?.querySelector("#termFormType"));
    const secondHasMount = Boolean(fields[1]?.querySelector("#termFormMountChips"));
    push("mountRightAfterType=" + (firstHasType && secondHasMount));
    push("vqBlockGone=" + (document.getElementById("termVerifiedQueryRows") === null));
    push("vbHiddenDefault=" + document.getElementById("termValueBindingField").hidden);
    push("entityRenamed=" + (document.querySelector('#termFormType option[value="entity"]')?.textContent.includes("数据集") || ""));

    /* 2. 切到业务资产 → 数据集类型自动挂载语义模型数据集节点 */
    document.querySelector('input[name="termFormKind"][value="asset"]').click();
    await sleep(200);
    const chips1 = document.getElementById("termFormMountChips").textContent.replace(/\\s+/g, " ");
    push("autoDatasetChips=" + chips1.trim());
    const datasetChipCount = document.querySelectorAll('#termFormMountChips [data-mountchip-remove^="dataset:"]').length;
    push("datasetChipCount=" + datasetChipCount);

    /* 3. 类型切换联动 */
    const typeEl = document.getElementById("termFormType");
    const setType = async (val) => {
      typeEl.value = val;
      typeEl.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(150);
    };
    await setType("dimension");
    const dimChips = document.querySelectorAll('#termFormMountChips [data-mountchip-remove^="dimension:"]').length;
    push("dimAuto=" + dimChips + " vbHiddenOnDim=" + document.getElementById("termValueBindingField").hidden);
    await setType("metric");
    const metricChips = document.querySelectorAll('#termFormMountChips [data-mountchip-remove^="metric:"]').length;
    push("metricAuto=" + metricChips);
    await setType("filter");
    push("vbVisibleOnFilter=" + !document.getElementById("termValueBindingField").hidden);
    push("filterKeepsChips=" + (document.getElementById("termFormMountChips").textContent.includes("指标")));
    await setType("entity");

    /* 4. 保存 → 落盘数据集挂载 */
    document.getElementById("termFormName").value = "走查数据集术语B";
    document.getElementById("termFormSaveBtn").click();
    await sleep(400);
    const confirmBtn = document.getElementById("termSaveConfirmBtn");
    if (confirmBtn && !document.getElementById("termSaveConfirm").hidden) {
      confirmBtn.click();
      await sleep(400);
    }
    const created = (window.TermModule.readTerms() || []).find((t) => t.name === "走查数据集术语B");
    push("created=" + Boolean(created));
    const keys = (created?.mounts || []).map((m) => m.key);
    push("savedMounts=" + JSON.stringify(keys));
    push("allDatasetMounts=" + (keys.length > 0 && keys.every((k) => k.startsWith("dataset:"))));

    /* 5. 编辑反显：类型数据集 + chips 一致 */
    if (created) {
      const editLink = document.querySelector('#termTableBody tr[data-id="' + created.id + '"] [data-term-action="edit"]');
      if (editLink) {
        editLink.click();
        await sleep(250);
        push("editTypeDataset=" + (document.getElementById("termFormType").value === "entity"));
        push("editChipsCount=" + document.querySelectorAll("#termFormMountChips [data-mountchip-remove]").length);
      }
    }
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
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--user-data-dir=C:\\Windows\\Temp\\edge-type-driven-" + Date.now(), "--virtual-time-budget=20000", "--dump-dom", url],
    { maxBuffer: 300 * 1024 * 1024, encoding: "utf8" }
  );
} catch (err) {
  console.log("EDGE ERR", String(err.message).slice(0, 200));
}

const m = out.match(/<div id="probeOut">([\s\S]*?)<\/div>/);
console.log(m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "PROBE NOT FOUND");
fs.unlinkSync(tmpPage);
