const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "../..");
const srcHtml = fs.readFileSync(path.join(root, "index_v2.0.html"), "utf8");
const tmpPage = path.join(root, "_verify_mount_fusion.html");

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
    const metricApi = window.MetricModule;
    push("ui=" + Boolean(ui) + " metricApi=" + Boolean(metricApi));

    /* 1. 打开创建表单，确认关联资产区块注入 */
    document.getElementById("termCreateBtn").click();
    await sleep(200);
    push("mountChipsEl=" + Boolean(document.getElementById("termFormMountChips")));
    push("mountAddBtn=" + Boolean(document.getElementById("termFormMountAdd")));
    push("mountPickerEl=" + Boolean(document.getElementById("termFormMountPicker")));

    /* 2. 切换为「业务资产」 */
    const assetRadio = document.querySelector('input[name="termFormKind"][value="asset"]');
    assetRadio.click();
    await sleep(150);
    const enhance = document.getElementById("termFormEnhance");
    push("enhanceVisible=" + Boolean(enhance && !enhance.hidden));

    /* 3. 选第一个数据域 */
    const domainInputs = [...document.querySelectorAll('#termDomainList input[name="termFormDomain"]')];
    push("domainOptions=" + domainInputs.length);
    domainInputs[0].checked = true;
    domainInputs[0].dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(180);
    const domainName = domainInputs[0].value;
    push("domainTags=" + document.getElementById("termDomainTags").textContent.trim());

    /* 4. 打开关联资产选择器（按所选数据域过滤） */
    document.getElementById("termFormMountAdd").click();
    await sleep(150);
    const scope1 = document.getElementById("termFormMountScope").textContent;
    const items1 = [...document.querySelectorAll("#termFormMountPickerList input[data-formmount]")].map((i) => i.value);
    const g1 = (p) => items1.filter((k) => k.startsWith(p)).length;
    push("scope1=" + scope1);
    push("cand1=" + items1.length + " (metric:" + g1("metric:") + " dim:" + g1("dimension:") + " field:" + g1("field:") + ")");

    /* 5. 再选一个生效模型 → 候选应收窄 */
    const modelInputs = [...document.querySelectorAll('#termModelList input[name="termFormModel"]')];
    push("modelOptions=" + modelInputs.length);
    if (modelInputs.length) {
      modelInputs[0].checked = true;
      modelInputs[0].dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(180);
      const scope2 = document.getElementById("termFormMountScope").textContent;
      const items2 = [...document.querySelectorAll("#termFormMountPickerList input[data-formmount]")].map((i) => i.value);
      const modelName = modelInputs[0].value;
      const allFieldInModel = items2.filter((k) => k.startsWith("field:")).every((k) => k.startsWith("field:" + modelName + "|"));
      push("scope2=" + scope2);
      push("cand2=" + items2.length + " narrowed=" + (items2.length <= items1.length) + " fieldsAllInModel=" + allFieldInModel);

      /* 6. 勾选：指标 + 维度 + 字段 各一个 */
      const pickKey = (key) => {
        const input = document.querySelector('#termFormMountPickerList input[data-formmount][value="' + key + '"]');
        if (!input) return "miss";
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return "ok";
      };
      const mKey = items2.find((k) => k.startsWith("metric:"));
      const dKey = items2.find((k) => k.startsWith("dimension:"));
      const fKey = items2.find((k) => k.startsWith("field:"));
      push("pick=" + [mKey && pickKey(mKey), dKey && pickKey(dKey), fKey && pickKey(fKey)].join(","));
      await sleep(150);
      push("chips=" + document.getElementById("termFormMountChips").textContent.replace(/\\s+/g, " ").trim());
      window.__picked = { mKey, dKey, fKey, modelName, domainName };
      document.getElementById("termFormMountPickerDone").click();
    }

    /* 7. 填写名称/描述并保存 */
    document.getElementById("termFormName").value = "走查关联资产术语A";
    document.getElementById("termFormDescription").value = "走查用描述";
    document.getElementById("termFormSaveBtn").click();
    await sleep(400);
    const confirmBtn = document.getElementById("termSaveConfirmBtn");
    if (confirmBtn && !document.getElementById("termSaveConfirm").hidden) {
      push("confirmShown=1");
      confirmBtn.click();
      await sleep(400);
    }

    /* 8. 校验 term.mounts 落盘 */
    const created = (window.TermModule.readTerms() || []).find((t) => t.name === "走查关联资产术语A");
    push("created=" + Boolean(created));
    const mountKeys = (created?.mounts || []).map((m) => m.key);
    push("createdMounts=" + JSON.stringify(mountKeys));
    push("kindAsset=" + (created?.kind === "asset"));

    /* 9. 校验指标侧双写 metric.termIds */
    if (window.__picked?.mKey && created) {
      const metricId = window.__picked.mKey.split(":").slice(1).join(":");
      const metric = (metricApi.readMetrics() || []).find((mm) => String(mm.id || mm.name) === metricId);
      push("doubleWrite=" + Boolean(metric && (metric.termIds || []).includes(created.id)));
    }

    /* 10. 编辑反显 */
    if (created) {
      const editLink = document.querySelector('#termTableBody tr[data-id="' + created.id + '"] [data-term-action="edit"]');
      push("editLink=" + Boolean(editLink));
      if (editLink) {
        editLink.click();
        await sleep(250);
        push("editChips=" + document.getElementById("termFormMountChips").textContent.replace(/\\s+/g, " ").trim());
        document.getElementById("termFormMountAdd").click();
        await sleep(150);
        const checkedKeys = [...document.querySelectorAll("#termFormMountPickerList input[data-formmount]:checked")].map((i) => i.value);
        push("editPickerChecked=" + JSON.stringify(checkedKeys));
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
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--user-data-dir=C:\\Windows\\Temp\\edge-mount-fusion-" + Date.now(), "--virtual-time-budget=20000", "--dump-dom", url],
    { maxBuffer: 300 * 1024 * 1024, encoding: "utf8" }
  );
} catch (err) {
  console.log("EDGE ERR", String(err.message).slice(0, 200));
}

const m = out.match(/<div id="probeOut">([\s\S]*?)<\/div>/);
console.log(m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "PROBE NOT FOUND");
fs.unlinkSync(tmpPage);
