const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const srcHtml = fs.readFileSync(path.join(root, "index_v2.0.html"), "utf8");
const tmpPage = path.join(root, "_verify_vq.html");

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
    await sleep(1000);
    const ui = window.BizTermUI;
    const bridge = window.SemanticBridge;
    const editLink = document.querySelector('#termTableBody tr[data-id] [data-term-action="edit"]');
    const termId = editLink.dataset.id;
    editLink.click();
    await sleep(200);
    push("vqRowsEl=" + Boolean(document.getElementById("termVerifiedQueryRows")) + " addBtn=" + Boolean(document.getElementById("termVerifiedQueryAdd")));
    document.getElementById("termVerifiedQueryAdd").click();
    await sleep(120);
    const row = document.querySelector("#termVerifiedQueryRows .term-vq-row");
    push("rowAdded=" + Boolean(row));
    const q = row.querySelector('[data-vq-role="question"]');
    const s = row.querySelector('[data-vq-role="sql"]');
    const QUESTION = "上月各项目确收金额";
    const SQL = "SELECT project_name, SUM(recognized_amt) AS amt\\nFROM dwd_revenue_detail\\nWHERE biz_month = LAST_MONTH\\nGROUP BY project_name";
    q.value = QUESTION;
    q.dispatchEvent(new Event("input", { bubbles: true }));
    s.value = SQL;
    s.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(120);
    document.getElementById("termFormSaveBtn").click();
    await sleep(400);
    const confirmBtn = document.getElementById("termSaveConfirmBtn");
    if (confirmBtn && !document.getElementById("termSaveConfirm").hidden) { push("confirmShown=1"); confirmBtn.click(); await sleep(400); }
    const saved = ui.getTermById(termId);
    push("savedVQ=" + JSON.stringify(saved?.verifiedQueries || []).slice(0, 220));
    push("lastVersionKind=" + ((saved?.versions || []).slice(-1)[0] || {}).changeKind);
    ui.openDetail(termId);
    await sleep(300);
    const cards = document.querySelectorAll("#termDetailOverviewPanel .td-card");
    const vqCard = [...cards].find((c) => c.textContent.includes("验证查询"));
    push("vqCard=" + (vqCard ? vqCard.textContent.replace(/\\s+/g, " ").slice(0, 200) : "none"));
    const bridged = (bridge?.getTerms?.() || []).find((t) => t.termId === termId);
    push("bridgeVQ=" + JSON.stringify(bridged?.verifiedQueries || []).slice(0, 180));
    /* 问数模拟：输入相同问法，应复用标准 SQL */
    const entry = document.getElementById("termSimEntryBtn");
    push("simEntry=" + Boolean(entry));
    if (entry) {
      entry.click();
      await sleep(150);
      const input = document.getElementById("termSimQuestion");
      input.value = "上月各项目确收金额";
      document.getElementById("termSimRun").click();
      await sleep(250);
      const steps = document.getElementById("termSimSteps").textContent.replace(/\\s+/g, " ");
      const sql = document.getElementById("termSimSql").textContent;
      push("simHitVerified=" + steps.includes("验证查询命中"));
      push("simSql=" + sql.replace(/\\s+/g, " ").slice(0, 180));
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
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--user-data-dir=C:\\Windows\\Temp\\edge-vq", "--virtual-time-budget=20000", "--dump-dom", url],
    { maxBuffer: 300 * 1024 * 1024, encoding: "utf8" }
  );
} catch (err) {
  console.log("EDGE ERR", String(err.message).slice(0, 200));
}

const m = out.match(/<div id="probeOut">([\s\S]*?)<\/div>/);
console.log(m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "PROBE NOT FOUND");
fs.unlinkSync(tmpPage);
