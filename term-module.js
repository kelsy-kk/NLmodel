/**
 * 业务建模 · 术语设置（导入 / 上线 / 详情）
 */
(function (global) {
  const STORAGE_KEY = "biz-modeling-terms-v3";
  const FIELD_TERM_KEY = "biz-modeling-field-terms-v1";
  const FIELD_TERM_DISMISS_KEY = "biz-modeling-field-term-dismiss-v1";
  const DEFAULT_PROJECT = "pmlead-市场指标";

  const CSV_HEADERS = ["术语名称", "同义词", "术语描述"];

  const TERM_POOL = [
    { name: "合同额", synonyms: "合同金额, 签约额", description: "统计周期内签订的合同总金额，按签订日期归属。", domain: "收入管理" },
    { name: "目标额", synonyms: "签约目标, 目标金额", description: "合同签约目标金额合计。", domain: "收入管理" },
    { name: "销售量", synonyms: "销量, 销售数量", description: "商品销售的总数量，通常按门店与产品种类汇总。", domain: "经营管理" },
    { name: "GMV", synonyms: "成交总额, 成交额", description: "成交订单金额合计，包含优惠前销售金额。", domain: "经营管理" },
    { name: "交易月份", synonyms: "月份, 业务月", description: "按交易发生时间归集的月份维度，用于趋势分析。", domain: "经营管理" },
    { name: "产品种类", synonyms: "品类, 商品类别", description: "产品分类维度，用于品类分析。", domain: "经营管理" },
    { name: "门店编号", synonyms: "门店ID, 店铺编号", description: "门店唯一标识，用于关联区域与经营数据。", domain: "经营管理" },
    { name: "订单金额", synonyms: "销售额, 营收", description: "订单实际成交金额，可按区域、月份等维度聚合。", domain: "收入管理" },
    { name: "签订日期", synonyms: "签约日期, 合同日期", description: "合同正式签订的日期，用于合同类指标统计。", domain: "收入管理" },
    { name: "成本金额", synonyms: "成本合计, 归集成本", description: "按权责归集的项目成本金额，内部往来不计入。", domain: "成本管理" },
  ];

  const FIELD_MOUNT_DEMO_TERMS = [
    { name: "合同额", synonyms: "合同金额, 签约额", description: "统计周期内签订的合同总金额，按签订日期归属。", domain: "收入管理" },
    { name: "目标额", synonyms: "签约目标, 目标金额", description: "合同签约目标金额合计。", domain: "收入管理" },
    { name: "订单金额", synonyms: "销售额, 营收", description: "订单实际成交金额，可按区域、月份等维度聚合。", domain: "收入管理" },
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightHtml(value, query) {
    const text = String(value ?? "");
    const keyword = String(query || "").trim();
    if (!keyword) return escapeHtml(text);
    const reg = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let html = "";
    let last = 0;
    let hit = false;
    text.replace(reg, (match, index) => {
      hit = true;
      html += escapeHtml(text.slice(last, index));
      html += `<span class="list-highlight">${escapeHtml(match)}</span>`;
      last = index + match.length;
      return match;
    });
    if (!hit) return escapeHtml(text);
    return html + escapeHtml(text.slice(last));
  }

  function createId() {
    return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDate(date = new Date()) {
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function randomPastDate(daysBackMax = 45) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBackMax));
    date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
    return date;
  }

  function termDomainList(item) {
    if (Array.isArray(item?.domains) && item.domains.length) {
      return item.domains.map((d) => String(d).trim()).filter(Boolean);
    }
    return String(item?.domain || "")
      .split(/[、,，]/)
      .map((d) => d.trim())
      .filter(Boolean);
  }

  function termHasDomain(item, domain) {
    return termDomainList(item).includes(domain);
  }

  function termModelList(item) {
    if (Array.isArray(item?.modelNames) && item.modelNames.length) {
      return item.modelNames.map((name) => String(name).trim()).filter(Boolean);
    }
    return [];
  }

  function listBusinessModels() {
    if (typeof global.MetricModule?.listBusinessModels === "function") {
      return global.MetricModule.listBusinessModels();
    }
    return [];
  }

  function modelsForDomains(domains) {
    const set = new Set(domains || []);
    return listBusinessModels().filter((model) => set.has(model.domain));
  }

  function termAppliesToModels(term, context = {}) {
    const modelNames = (context.modelNames || []).filter(Boolean);
    const domains = (context.domains || []).filter(Boolean);
    const locked = termModelList(term);
    if (!modelNames.length) {
      if (locked.length) return false;
      if (domains.length) return domains.some((domain) => termHasDomain(term, domain));
      return true;
    }
    if (locked.length) return modelNames.every((name) => locked.includes(name));
    const catalog = listBusinessModels();
    return modelNames.every((name) => {
      const model = catalog.find((item) => item.name === name);
      return model && termHasDomain(term, model.domain);
    });
  }

  function normalizeTerm(item, fallbackDomains = [], project = DEFAULT_PROJECT) {
    const domains = termDomainList(item);
    const resolved = domains.length ? domains : [fallbackDomains[0] || "收入管理"];
    const modelNames = termModelList(item).filter((name) => {
      const model = listBusinessModels().find((entry) => entry.name === name);
      return !model || resolved.includes(model.domain);
    });
    const modelIds = modelNames.map((name) => {
      const fromItem = Array.isArray(item?.modelIds) ? item.modelIds : [];
      const known = listBusinessModels().find((entry) => entry.name === name);
      return known?.id || fromItem[termModelList(item).indexOf(name)] || name;
    });
    return {
      ...item,
      domains: resolved,
      domain: resolved.join("、"),
      modelNames,
      modelIds,
      project: item?.project || project,
      online: item?.online !== false,
    };
  }

  function readTerms(fallbackDomains = [], project = DEFAULT_PROJECT) {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem("biz-modeling-terms-v2") || localStorage.getItem("biz-modeling-terms-v1");
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            const migrated = parsed.map((item) => normalizeTerm(item, fallbackDomains, project));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            return migrated;
          }
        }
        return null;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeTerm(item, fallbackDomains, project));
      }
    } catch (_err) {
      /* ignore */
    }
    return null;
  }

  function writeTerms(terms) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
      global.dispatchEvent(new CustomEvent("biz-terms-updated", { detail: terms }));
    } catch (_err) {
      /* ignore */
    }
  }

  function seedTerms(fallbackDomains = [], project = DEFAULT_PROJECT) {
    const count = 5 + Math.floor(Math.random() * 3);
    const copy = [...TERM_POOL];
    const picked = [];
    while (picked.length < count && copy.length) {
      const index = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(index, 1)[0]);
    }
    return picked.map((item, index) => ({
      id: createId(),
      ...item,
      domain: item.domain || fallbackDomains[index % Math.max(fallbackDomains.length, 1)] || "收入管理",
      project,
      online: index < 3,
      creator: "管理员",
      createdAt: formatDate(randomPastDate()),
    }));
  }

  function readFieldTermMap() {
    try {
      const raw = localStorage.getItem(FIELD_TERM_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeFieldTermMap(map) {
    try {
      localStorage.setItem(FIELD_TERM_KEY, JSON.stringify(map));
      global.dispatchEvent(new CustomEvent("biz-field-terms-updated", { detail: map }));
    } catch (_err) {
      /* ignore */
    }
  }

  function fieldTermKey(modelName, fieldEn) {
    return `${modelName || ""}|${fieldEn || ""}`;
  }

  function readFieldTermDismiss() {
    try {
      const raw = localStorage.getItem(FIELD_TERM_DISMISS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeFieldTermDismiss(map) {
    try {
      localStorage.setItem(FIELD_TERM_DISMISS_KEY, JSON.stringify(map));
    } catch (_err) {
      /* ignore */
    }
  }

  function isFieldTermDismissed(key, termId) {
    return (readFieldTermDismiss()[key] || []).includes(termId);
  }

  function markFieldTermsDismissed(key, termIds) {
    if (!key || !termIds?.length) return;
    const dismiss = readFieldTermDismiss();
    const hidden = new Set(dismiss[key] || []);
    termIds.forEach((id) => {
      if (id) hidden.add(id);
    });
    dismiss[key] = [...hidden];
    writeFieldTermDismiss(dismiss);
  }

  function dismissFieldTerm(key, termId) {
    if (!key || !termId) return;
    markFieldTermsDismissed(key, [termId]);
    const map = readFieldTermMap();
    if (Array.isArray(map[key])) {
      map[key] = map[key].filter((id) => id !== termId);
      if (!map[key].length) delete map[key];
    }
    writeFieldTermMap(map);
  }

  function clearFieldTermDismiss(key, termIds) {
    if (!key || !termIds?.length) return;
    const dismiss = readFieldTermDismiss();
    const hidden = new Set(dismiss[key] || []);
    termIds.forEach((id) => hidden.delete(id));
    if (hidden.size) dismiss[key] = [...hidden];
    else delete dismiss[key];
    writeFieldTermDismiss(dismiss);
  }

  function normalizeMatchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[，。；、,.!！?？:：()（）【】\[\]"'“”‘’]/g, "");
  }

  function textTokens(value) {
    const text = normalizeMatchText(value);
    const tokens = new Set();
    if (!text) return tokens;
    (text.match(/[a-z0-9_]+/g) || []).forEach((token) => {
      if (token.length >= 2) tokens.add(token);
    });
    const chinese = text.replace(/[a-z0-9_]+/g, "");
    for (let i = 0; i < chinese.length - 1; i += 1) {
      tokens.add(chinese.slice(i, i + 2));
    }
    return tokens;
  }

  function textSimilarity(left, right) {
    const a = normalizeMatchText(left);
    const b = normalizeMatchText(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length >= 4 && b.includes(a)) return 0.92;
    if (b.length >= 4 && a.includes(b)) return 0.92;
    const leftTokens = textTokens(a);
    const rightTokens = textTokens(b);
    if (!leftTokens.size || !rightTokens.size) return 0;
    let overlap = 0;
    leftTokens.forEach((token) => {
      if (rightTokens.has(token)) overlap += 1;
    });
    return overlap / Math.min(leftTokens.size, rightTokens.size);
  }

  function isDescriptionSimilar(fieldDesc, termDesc) {
    return textSimilarity(fieldDesc, termDesc) >= 0.45;
  }

  function matchTermsForField(field, termList) {
    const modelName = String(field?.modelName || "").trim();
    const fieldEn = String(field?.fieldEn || "").replace(/\s+/g, " ").trim();
    const fieldZh = String(field?.fieldZh || "").replace(/\s+/g, " ").trim();
    const fieldDesc = String(field?.fieldDesc || "").replace(/\s+/g, " ").trim() || fieldZh;
    const labels = [fieldEn, fieldZh].map((value) => value.toLowerCase()).filter(Boolean);
    if (!modelName || (!labels.length && !fieldDesc)) return [];
    const model = listBusinessModels().find((item) => item.name === modelName);
    const domain = model?.domain || "";
    if (!domain) return [];
    const source = Array.isArray(termList) ? termList : readTerms() || [];
    const results = [];
    source.forEach((term) => {
      if (term.online === false) return;
      if (!termAppliesToModels(term, { modelNames: [modelName], domains: [domain] })) return;
      const aliases = [term.name, ...String(term.synonyms || "").split(/[,，]/)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const exact = labels.some((label) => aliases.includes(label));
      if (exact) {
        results.push({ ...term, matchKind: "exact" });
        return;
      }
      const termDesc = String(term.description || "").trim();
      if (fieldDesc && termDesc && isDescriptionSimilar(fieldDesc, termDesc)) {
        results.push({ ...term, matchKind: "recommend" });
      }
    });
    results.sort((a, b) => {
      if (a.matchKind === b.matchKind) return 0;
      return a.matchKind === "exact" ? -1 : 1;
    });
    return results;
  }

  function collectFieldSettingRows() {
    if (typeof document === "undefined") return [];
    return [...document.querySelectorAll('.model-pane[data-model-pane="fields"] .field-table tbody tr')].map((row) => {
      const aliasCell = row.cells?.[3];
      const fieldEn = String(row.cells?.[2]?.textContent || "")
        .replace(/\s+/g, " ")
        .replace(/关联字段/g, "")
        .trim();
      const fieldZh = String(aliasCell?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const fieldDesc = String(aliasCell?.getAttribute("title") || aliasCell?.dataset?.desc || "")
        .replace(/\s+/g, " ")
        .trim();
      return { fieldEn, fieldZh, fieldDesc };
    }).filter((row) => row.fieldEn || row.fieldZh);
  }

  function normalizeCsvHeader(header) {
    return String(header || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/^"|"$/g, "");
  }

  function mapCsvHeader(header) {
    const raw = normalizeCsvHeader(header);
    const aliases = {
      词典名称: "词典名称",
      工程: "词典名称",
      所属工程: "词典名称",
      产线: "词典名称",
      术语名称: "术语名称",
      名称: "术语名称",
      同义词: "同义词",
      同义词标签: "同义词",
      "同义词/标签": "同义词",
      术语描述: "术语描述",
      描述: "术语描述",
    };
    return aliases[raw] || raw;
  }

  function parseCsvText(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const delimiter = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
    const split = (line) => {
      const cells = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuote = !inQuote;
          }
        } else if (ch === delimiter && !inQuote) {
          cells.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    };
    const headers = split(lines[0]).map(mapCsvHeader);
    const rows = lines.slice(1).map((line, idx) => {
      const cells = split(line);
      const obj = { __line: idx + 2 };
      headers.forEach((h, i) => {
        if (!h || h === "__line") return;
        obj[h] = cells[i] ?? "";
      });
      return obj;
    });
    return { headers, rows };
  }

  function csvHasRequiredHeaders(headers) {
    const set = new Set((headers || []).map(normalizeCsvHeader));
    return CSV_HEADERS.every((h) => set.has(h));
  }

  async function readCsvFile(file) {
    const buf = await file.arrayBuffer();
    const tryDecode = (label) => {
      try {
        return new TextDecoder(label).decode(buf);
      } catch (_err) {
        return "";
      }
    };
    const candidates = ["utf-8", "gbk", "gb18030"];
    let best = { text: "", parsed: { headers: [], rows: [] } };
    for (const label of candidates) {
      const text = tryDecode(label);
      if (!text) continue;
      const parsed = parseCsvText(text);
      if (csvHasRequiredHeaders(parsed.headers)) {
        return { text, parsed, encoding: label };
      }
      if (parsed.rows.length > best.parsed.rows.length) {
        best = { text, parsed, encoding: label };
      }
    }
    return best;
  }

  function sampleCsvText() {
    return [
      CSV_HEADERS.join(","),
      `合同额,"合同金额,签约额",统计周期内签订的合同总金额`,
      `目标额,签约目标,合同签约目标金额`,
      `,同义词错误,缺少术语名称`,
      `合同额,重复名,与已有或文件内重名示意`,
    ].join("\n");
  }

  function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function mount(deps = {}) {
    const setTip = typeof deps.setTip === "function" ? deps.setTip : () => {};
    const collectUniqueDomainLabels = typeof deps.collectUniqueDomainLabels === "function"
      ? deps.collectUniqueDomainLabels
      : () => ["收入管理", "成本管理", "经营管理"];
    const getCurrentProject = typeof deps.getCurrentProject === "function"
      ? deps.getCurrentProject
      : () => DEFAULT_PROJECT;
    const openMetricById = typeof deps.openMetricById === "function" ? deps.openMetricById : null;
    const openFieldByKey = typeof deps.openFieldByKey === "function" ? deps.openFieldByKey : null;

    const searchEl = document.getElementById("termSearchInput");
    const createBtnEl = document.getElementById("termCreateBtn");
    const importBtnEl = document.getElementById("termImportBtn");
    const exportBtnEl = document.getElementById("termExportBtn");
    const templateBtnEl = document.getElementById("termTemplateBtn");
    const selectAllEl = document.getElementById("termSelectAll");
    const tableBodyEl = document.getElementById("termTableBody");
    const termListMetaEl = document.getElementById("termListMeta");
    const termPagerEl = document.getElementById("termPager");
    const termPagerSummaryEl = document.getElementById("termPagerSummary");
    const termPagerStateEl = document.getElementById("termPagerState");
    const termPrevPageBtnEl = document.getElementById("termPrevPageBtn");
    const termNextPageBtnEl = document.getElementById("termNextPageBtn");
    const formOverlayEl = document.getElementById("termFormOverlay");
    const formTitleEl = document.getElementById("termFormTitle");
    const formNameEl = document.getElementById("termFormName");
    const formSynonymsEl = document.getElementById("termFormSynonyms");
    const formDescEl = document.getElementById("termFormDescription");
    const formSaveBtnEl = document.getElementById("termFormSaveBtn");
    const formCancelBtnEl = document.getElementById("termFormCancelBtn");
    const formCloseBtnEl = document.getElementById("closeTermFormBtn");

    const importOverlayEl = document.getElementById("termImportOverlay");
    const importStepEls = () => Array.from(document.querySelectorAll("[data-term-import-step-panel]"));
    const importModeEls = () => Array.from(document.querySelectorAll('input[name="termImportMode"]'));
    const importFileInputEl = document.getElementById("termImportFileInput");
    const importFileStatusEl = document.getElementById("termImportFileStatus");
    const importPreviewBodyEl = document.getElementById("termImportPreviewBody");
    const importSummaryEl = document.getElementById("termImportSummary");
    const importPrevBtnEl = document.getElementById("termImportPrevBtn");
    const importNextBtnEl = document.getElementById("termImportNextBtn");
    const importCloseBtnEl = document.getElementById("closeTermImportBtn");
    const importCancelBtnEl = document.getElementById("termImportCancelBtn");
    const importUseSampleBtnEl = document.getElementById("termImportUseSampleBtn");

    const detailDrawerEl = document.getElementById("termDetailDrawer");
    const detailBodyEl = document.getElementById("termDetailDrawerBody");
    const detailTitleEl = document.getElementById("termDetailDrawerTitle");
    const detailCloseBtnEl = document.getElementById("closeTermDetailDrawerBtn");

    const domainLabels = () => {
      const labels = collectUniqueDomainLabels() || [];
      return labels.length ? labels : ["收入管理", "成本管理", "经营管理"];
    };

    const currentProject = () => getCurrentProject() || DEFAULT_PROJECT;

    let terms = readTerms(domainLabels(), currentProject()) || seedTerms(domainLabels(), currentProject());
    writeTerms(terms);
    /* 需求：关系图谱演示种子 —— 无任何字段挂载时，按「模型字段名 = 术语名」补挂术语，并给术语补生效模型，使图谱可直接演示 */
    (function seedGraphFieldRelations() {
      try {
        const existing = readFieldTermMap();
        if (Object.keys(existing).some((k) => (existing[k] || []).length)) return;
        const models = listBusinessModels();
        if (!terms.length || !models.length) return;
        const byName = new Map(terms.map((t) => [t.name, t]));
        const map = {};
        let touched = false;
        models.forEach((m) => {
          let hits = 0;
          (m.fieldNames || []).forEach((fieldName) => {
            const term = byName.get(fieldName);
            if (!term || hits >= 3) return;
            hits += 1;
            map[fieldTermKey(m.name, fieldName)] = [term.id];
            const row = terms.find((x) => x.id === term.id);
            if (row && !(row.modelNames || []).length) { row.modelNames = [m.name]; touched = true; }
          });
        });
        if (!Object.keys(map).length) return;
        writeFieldTermMap(map);
        if (touched) writeTerms(terms);
      } catch (_err) { /* ignore */ }
    })();
    const selection = new Set();
    let editingId = null;
    let domainFilter = "";
    let onlineFilter = "";
    /* 需求：术语列表分页 + 顶部总数统计 */
    const TERM_PAGE_SIZE = 15;
    let termCurrentPage = 1;
    let lastTermFilterKey = null;
    let importStep = 1;
    let importRows = [];
    let validatedRows = [];
    let importSourceFile = null;
    let importSourceText = "";
    let importSourceName = "";

    let selectedFormDomains = new Set();
    let selectedFormModels = new Set();
    let selectedImportDomains = new Set();
    let selectedBatchMoveDomains = new Set();
    let domainPickerBound = false;
    let modelPickerBound = false;
    let importDomainPickerBound = false;
    let batchMoveDomainPickerBound = false;

    function setTermDomainPickerOpen(open) {
      const trigger = document.getElementById("termDomainTrigger");
      const dropdown = document.getElementById("termDomainDropdown");
      if (!trigger || !dropdown) return;
      trigger.classList.toggle("is-open", open);
      dropdown.hidden = !open;
    }

    function renderTermDomainTags() {
      const tagsEl = document.getElementById("termDomainTags");
      if (!tagsEl) return;
      const selected = [...selectedFormDomains];
      tagsEl.innerHTML = selected
        .map((name) => `
          <span class="metric-domain-tag" data-name="${escapeHtml(name)}">
            <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <button type="button" data-remove-term-domain="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `)
        .join("");
    }

    // 数据域/模型下拉共用的「全选」项（数据域与模型两个选择器复用同一套逻辑）
    function renderDomainSelectAllHtml(action) {
      return `
        <label class="metric-domain-item metric-domain-select-all">
          <input type="checkbox" data-domain-select-all="${escapeHtml(action)}" />
          <span>全选</span>
        </label>
      `;
    }

    // 同步「全选」复选框状态：全部选中勾选、部分选中半选
    function syncDomainSelectAllState(listEl, visibleCount, selectedCount) {
      const input = listEl?.querySelector("[data-domain-select-all]");
      if (!input) return;
      input.checked = visibleCount > 0 && selectedCount >= visibleCount;
      input.indeterminate = selectedCount > 0 && selectedCount < visibleCount;
      input.closest(".metric-domain-item")?.classList.toggle("is-checked", input.checked);
    }

    function renderTermDomainDropdown(keyword = "") {
      const listEl = document.getElementById("termDomainList");
      if (!listEl) return;
      const q = keyword.trim().toLowerCase();
      const labels = domainLabels().filter((label) => !q || label.toLowerCase().includes(q));
      if (!labels.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">没有匹配的数据域</div>`;
        return;
      }
      const selectedCount = labels.filter((label) => selectedFormDomains.has(label)).length;
      listEl.innerHTML = `${renderDomainSelectAllHtml("term-domain")}${labels
        .map((label) => {
          const checked = selectedFormDomains.has(label);
          return `
            <label class="metric-domain-item ${checked ? "is-checked" : ""}">
              <input type="checkbox" name="termFormDomain" value="${escapeHtml(label)}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>
          `;
        })
        .join("")}`;
      syncDomainSelectAllState(listEl, labels.length, selectedCount);
    }

    // ===== 术语库数据域继承（需求：术语库下新建/编辑/导入术语，所属数据域默认继承当前术语库的数据域，反显并提示，支持修改） =====
    function currentGlossaryInfo() {
      try {
        const g = typeof global.GlossaryUI?.getCurG === "function" ? global.GlossaryUI.getCurG() : null;
        const domain = String(g?.domain || "").trim();
        return domain ? { name: String(g.name || "当前术语库").trim() || "当前术语库", domain } : null;
      } catch (_err) {
        return null;
      }
    }

    function showDomainInheritHint(id, pickerId, glossaryName, domain) {
      const picker = document.getElementById(pickerId);
      if (!picker?.parentElement) return;
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("p");
        el.id = id;
        el.className = "modal-hint";
        picker.parentElement.appendChild(el);
      }
      el.textContent = `ⓘ 已默认继承当前术语库「${glossaryName}」的数据域「${domain}」，可按需修改。`;
      el.style.color = "#1677d2";
      el.style.display = "";
    }

    function hideDomainInheritHint(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }

    function initTermDomainPicker(selected = []) {
      const list = Array.isArray(selected) ? selected : String(selected || "").split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
      selectedFormDomains = new Set(list.filter(Boolean));
      const searchEl = document.getElementById("termDomainSearch");
      if (searchEl) searchEl.value = "";
      renderTermDomainTags();
      renderTermDomainDropdown("");
      setTermDomainPickerOpen(false);
    }

    function bindTermDomainPicker() {
      const picker = document.getElementById("termDomainPicker");
      const trigger = document.getElementById("termDomainTrigger");
      const searchEl = document.getElementById("termDomainSearch");
      const listEl = document.getElementById("termDomainList");
      const tagsEl = document.getElementById("termDomainTags");
      if (!picker || domainPickerBound) return;
      domainPickerBound = true;
      trigger?.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove-term-domain]")) return;
        setTermDomainPickerOpen(true);
        searchEl?.focus();
      });
      searchEl?.addEventListener("focus", () => setTermDomainPickerOpen(true));
      searchEl?.addEventListener("input", () => {
        setTermDomainPickerOpen(true);
        renderTermDomainDropdown(searchEl.value);
      });
      listEl?.addEventListener("change", (event) => {
        // 「全选」：一次选中/取消当前下拉中可见的全部数据域（受搜索过滤影响）
        const selectAllInput = event.target.closest('[data-domain-select-all="term-domain"]');
        if (selectAllInput) {
          const q = (searchEl?.value || "").trim().toLowerCase();
          const labels = domainLabels().filter((label) => !q || label.toLowerCase().includes(q));
          labels.forEach((label) => {
            if (selectAllInput.checked) selectedFormDomains.add(label);
            else selectedFormDomains.delete(label);
          });
          renderTermDomainTags();
          renderTermDomainDropdown(searchEl?.value || "");
          syncFormModelsWithDomains();
          renderTermNameDupHint();
          hideDomainInheritHint("termFormDomainInheritHint");
          return;
        }
        const input = event.target.closest('input[name="termFormDomain"]');
        if (!input) return;
        if (input.checked) selectedFormDomains.add(input.value);
        else selectedFormDomains.delete(input.value);
        renderTermDomainTags();
        renderTermDomainDropdown(searchEl?.value || "");
        syncFormModelsWithDomains();
        renderTermNameDupHint();
        hideDomainInheritHint("termFormDomainInheritHint");
      });
      tagsEl?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-term-domain]");
        if (!btn) return;
        event.preventDefault();
        selectedFormDomains.delete(btn.dataset.removeTermDomain);
        renderTermDomainTags();
        renderTermDomainDropdown(searchEl?.value || "");
        syncFormModelsWithDomains();
        renderTermNameDupHint();
        hideDomainInheritHint("termFormDomainInheritHint");
      });
      document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) setTermDomainPickerOpen(false);
      });
    }

    function setTermModelPickerOpen(open) {
      const trigger = document.getElementById("termModelTrigger");
      const dropdown = document.getElementById("termModelDropdown");
      if (!trigger || !dropdown) return;
      trigger.classList.toggle("is-open", open);
      dropdown.hidden = !open;
    }

    function renderTermModelTags() {
      const tagsEl = document.getElementById("termModelTags");
      if (!tagsEl) return;
      tagsEl.innerHTML = [...selectedFormModels]
        .map((name) => `
          <span class="metric-domain-tag" data-name="${escapeHtml(name)}">
            <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <button type="button" data-remove-term-model="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `)
        .join("");
    }

    function renderTermModelDropdown(keyword = "") {
      const listEl = document.getElementById("termModelList");
      if (!listEl) return;
      const domains = [...selectedFormDomains];
      if (!domains.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">请先选择数据域</div>`;
        return;
      }
      const q = keyword.trim().toLowerCase();
      const models = modelsForDomains(domains).filter((model) => !q || model.name.toLowerCase().includes(q) || String(model.domain || "").toLowerCase().includes(q));
      if (!models.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">所选数据域下没有模型</div>`;
        return;
      }
      const selectedCount = models.filter((model) => selectedFormModels.has(model.name)).length;
      listEl.innerHTML = `${renderDomainSelectAllHtml("term-model")}${models
        .map((model) => {
          const checked = selectedFormModels.has(model.name);
          return `
            <label class="metric-domain-item ${checked ? "is-checked" : ""}">
              <input type="checkbox" name="termFormModel" value="${escapeHtml(model.name)}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(model.name)}</span>
              <span class="metric-model-domain">${escapeHtml(model.domain || "")}</span>
            </label>
          `;
        })
        .join("")}`;
      syncDomainSelectAllState(listEl, models.length, selectedCount);
    }

    function syncFormModelsWithDomains() {
      const allowed = new Set(modelsForDomains([...selectedFormDomains]).map((model) => model.name));
      selectedFormModels = new Set([...selectedFormModels].filter((name) => allowed.has(name)));
      renderTermModelTags();
      renderTermModelDropdown(document.getElementById("termModelSearch")?.value || "");
    }

    function initTermModelPicker(selected = []) {
      const list = Array.isArray(selected) ? selected : [];
      selectedFormModels = new Set(list.filter(Boolean));
      const searchEl = document.getElementById("termModelSearch");
      if (searchEl) searchEl.value = "";
      syncFormModelsWithDomains();
      setTermModelPickerOpen(false);
    }

    function bindTermModelPicker() {
      const picker = document.getElementById("termModelPicker");
      const trigger = document.getElementById("termModelTrigger");
      const searchEl = document.getElementById("termModelSearch");
      const listEl = document.getElementById("termModelList");
      const tagsEl = document.getElementById("termModelTags");
      if (!picker || modelPickerBound) return;
      modelPickerBound = true;
      trigger?.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove-term-model]")) return;
        setTermModelPickerOpen(true);
        searchEl?.focus();
      });
      searchEl?.addEventListener("focus", () => {
        setTermModelPickerOpen(true);
        renderTermModelDropdown(searchEl.value || "");
      });
      searchEl?.addEventListener("input", () => {
        setTermModelPickerOpen(true);
        renderTermModelDropdown(searchEl.value);
      });
      listEl?.addEventListener("change", (event) => {
        // 「全选」：一次选中/取消当前下拉中可见的全部模型（受搜索过滤影响）
        const selectAllInput = event.target.closest('[data-domain-select-all="term-model"]');
        if (selectAllInput) {
          const domains = [...selectedFormDomains];
          const q = (searchEl?.value || "").trim().toLowerCase();
          const models = modelsForDomains(domains).filter((model) => !q || model.name.toLowerCase().includes(q) || String(model.domain || "").toLowerCase().includes(q));
          models.forEach((model) => {
            if (selectAllInput.checked) selectedFormModels.add(model.name);
            else selectedFormModels.delete(model.name);
          });
          renderTermModelTags();
          renderTermModelDropdown(searchEl?.value || "");
          return;
        }
        const input = event.target.closest('input[name="termFormModel"]');
        if (!input) return;
        if (input.checked) selectedFormModels.add(input.value);
        else selectedFormModels.delete(input.value);
        renderTermModelTags();
        renderTermModelDropdown(searchEl?.value || "");
      });
      tagsEl?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-term-model]");
        if (!btn) return;
        event.preventDefault();
        selectedFormModels.delete(btn.dataset.removeTermModel);
        renderTermModelTags();
        renderTermModelDropdown(searchEl?.value || "");
      });
      document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) setTermModelPickerOpen(false);
      });
    }

    function setImportDomainPickerOpen(open) {
      const trigger = document.getElementById("termImportDomainTrigger");
      const dropdown = document.getElementById("termImportDomainDropdown");
      if (!trigger || !dropdown) return;
      trigger.classList.toggle("is-open", open);
      dropdown.hidden = !open;
    }

    function renderImportDomainTags() {
      const tagsEl = document.getElementById("termImportDomainTags");
      if (!tagsEl) return;
      tagsEl.innerHTML = [...selectedImportDomains]
        .map((name) => `
          <span class="metric-domain-tag" data-name="${escapeHtml(name)}">
            <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <button type="button" data-remove-import-domain="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `)
        .join("");
    }

    function renderImportDomainDropdown(keyword = "") {
      const listEl = document.getElementById("termImportDomainList");
      if (!listEl) return;
      const q = keyword.trim().toLowerCase();
      const labels = domainLabels().filter((label) => !q || label.toLowerCase().includes(q));
      if (!labels.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">没有匹配的数据域</div>`;
        return;
      }
      listEl.innerHTML = labels
        .map((label) => {
          const checked = selectedImportDomains.has(label);
          return `
            <label class="metric-domain-item ${checked ? "is-checked" : ""}">
              <input type="checkbox" name="termImportDomainPick" value="${escapeHtml(label)}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>
          `;
        })
        .join("");
    }

    function initImportDomainPicker(selected = []) {
      // 需求：支持默认继承术语库数据域（openImportWizard 传入），可多选可修改
      const list = Array.isArray(selected) ? selected : String(selected || "").split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
      selectedImportDomains = new Set(list.filter(Boolean));
      const searchEl = document.getElementById("termImportDomainSearch");
      if (searchEl) searchEl.value = "";
      renderImportDomainTags();
      renderImportDomainDropdown("");
      setImportDomainPickerOpen(false);
    }

    function setBatchMoveDomainPickerOpen(open) {
      const trigger = document.getElementById("catalogBatchTermDomainTrigger");
      const dropdown = document.getElementById("catalogBatchTermDomainDropdown");
      if (!trigger || !dropdown) return;
      trigger.classList.toggle("is-open", open);
      dropdown.hidden = !open;
    }

    function renderBatchMoveDomainTags() {
      const tagsEl = document.getElementById("catalogBatchTermDomainTags");
      if (!tagsEl) return;
      tagsEl.innerHTML = [...selectedBatchMoveDomains]
        .map(
          (name) => `
          <span class="metric-domain-tag" data-name="${escapeHtml(name)}">
            <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <button type="button" data-remove-batch-move-domain="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `
        )
        .join("");
    }

    function renderBatchMoveDomainDropdown(keyword = "") {
      const listEl = document.getElementById("catalogBatchTermDomainList");
      if (!listEl) return;
      const q = keyword.trim().toLowerCase();
      const labels = domainLabels().filter((label) => !q || label.toLowerCase().includes(q));
      if (!labels.length) {
        listEl.innerHTML = `<div class="metric-domain-empty">没有匹配的数据域</div>`;
        return;
      }
      listEl.innerHTML = labels
        .map((label) => {
          const checked = selectedBatchMoveDomains.has(label);
          return `
            <label class="metric-domain-item ${checked ? "is-checked" : ""}">
              <input type="checkbox" name="catalogBatchTermDomainPick" value="${escapeHtml(label)}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>
          `;
        })
        .join("");
    }

    function initBatchMoveDomainPicker() {
      selectedBatchMoveDomains = new Set();
      const searchEl = document.getElementById("catalogBatchTermDomainSearch");
      if (searchEl) searchEl.value = "";
      renderBatchMoveDomainTags();
      renderBatchMoveDomainDropdown("");
      setBatchMoveDomainPickerOpen(false);
      renderBatchMoveDupHint();
    }

    function getBatchMoveDomains() {
      return [...selectedBatchMoveDomains];
    }

    function bindBatchMoveDomainPicker() {
      const picker = document.getElementById("catalogBatchTermDomainPicker");
      const trigger = document.getElementById("catalogBatchTermDomainTrigger");
      const searchEl = document.getElementById("catalogBatchTermDomainSearch");
      const listEl = document.getElementById("catalogBatchTermDomainList");
      const tagsEl = document.getElementById("catalogBatchTermDomainTags");
      if (!picker || batchMoveDomainPickerBound) return;
      batchMoveDomainPickerBound = true;
      trigger?.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove-batch-move-domain]")) return;
        setBatchMoveDomainPickerOpen(true);
        searchEl?.focus();
      });
      searchEl?.addEventListener("focus", () => setBatchMoveDomainPickerOpen(true));
      searchEl?.addEventListener("input", () => {
        setBatchMoveDomainPickerOpen(true);
        renderBatchMoveDomainDropdown(searchEl.value);
      });
      listEl?.addEventListener("change", (event) => {
        const input = event.target.closest('input[name="catalogBatchTermDomainPick"]');
        if (!input) return;
        if (input.checked) selectedBatchMoveDomains.add(input.value);
        else selectedBatchMoveDomains.delete(input.value);
        renderBatchMoveDomainTags();
        renderBatchMoveDomainDropdown(searchEl?.value || "");
        renderBatchMoveDupHint();
      });
      tagsEl?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-batch-move-domain]");
        if (!btn) return;
        event.preventDefault();
        selectedBatchMoveDomains.delete(btn.dataset.removeBatchMoveDomain);
        renderBatchMoveDomainTags();
        renderBatchMoveDomainDropdown(searchEl?.value || "");
        renderBatchMoveDupHint();
      });
      document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) setBatchMoveDomainPickerOpen(false);
      });
    }

    function bindImportDomainPicker() {
      const picker = document.getElementById("termImportDomainPicker");
      const trigger = document.getElementById("termImportDomainTrigger");
      const searchEl = document.getElementById("termImportDomainSearch");
      const listEl = document.getElementById("termImportDomainList");
      const tagsEl = document.getElementById("termImportDomainTags");
      if (!picker || importDomainPickerBound) return;
      importDomainPickerBound = true;
      trigger?.addEventListener("click", (event) => {
        if (event.target.closest("[data-remove-import-domain]")) return;
        setImportDomainPickerOpen(true);
        searchEl?.focus();
      });
      searchEl?.addEventListener("focus", () => setImportDomainPickerOpen(true));
      searchEl?.addEventListener("input", () => {
        setImportDomainPickerOpen(true);
        renderImportDomainDropdown(searchEl.value);
      });
      listEl?.addEventListener("change", (event) => {
        const input = event.target.closest('input[name="termImportDomainPick"]');
        if (!input) return;
        if (input.checked) selectedImportDomains.add(input.value);
        else selectedImportDomains.delete(input.value);
        renderImportDomainTags();
        renderImportDomainDropdown(searchEl?.value || "");
        hideDomainInheritHint("termImportDomainInheritHint");
      });
      tagsEl?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-import-domain]");
        if (!btn) return;
        event.preventDefault();
        selectedImportDomains.delete(btn.dataset.removeImportDomain);
        renderImportDomainTags();
        renderImportDomainDropdown(searchEl?.value || "");
        hideDomainInheritHint("termImportDomainInheritHint");
      });
      document.addEventListener("click", (event) => {
        if (!picker.contains(event.target)) setImportDomainPickerOpen(false);
      });
    }

    function isTermOnline(item) {
      return item?.online !== false;
    }

    function getFiltered() {
      const keyword = (searchEl?.value || "").trim().toLowerCase();
      const canAccessDomain = global.PermissionModule?.canAccessDomain || global.DataScope?.canAccessDomain;
      const project = (document.getElementById("projectFilterSelect")?.value || "pmlead-市场指标").trim();
      return terms.filter((item) => {
        if (canAccessDomain) {
          const domains = termDomainList(item);
          if (domains.length && !domains.some((d) => canAccessDomain(d, { project }))) return false;
        }
        if (domainFilter && !termHasDomain(item, domainFilter)) return false;
        if (onlineFilter === "online" && !isTermOnline(item)) return false;
        if (onlineFilter === "offline" && isTermOnline(item)) return false;
        if (!keyword) return true;
        return ["name", "synonyms", "description", "domain", "project"].some((field) =>
          String(item[field] ?? "").toLowerCase().includes(keyword)
        ) || termModelList(item).some((name) => name.toLowerCase().includes(keyword));
      });
    }

    function syncSelectionUi() {
      const visibleIds = new Set(getFiltered().map((item) => item.id));
      [...selection].forEach((id) => {
        if (!visibleIds.has(id)) selection.delete(id);
      });
      const hasRows = visibleIds.size > 0;
      if (selectAllEl) {
        selectAllEl.disabled = !hasRows;
        if (!hasRows) {
          selectAllEl.checked = false;
          selectAllEl.indeterminate = false;
        } else {
          const selectedVisible = [...selection].filter((id) => visibleIds.has(id)).length;
          selectAllEl.checked = selectedVisible > 0 && selectedVisible === visibleIds.size;
          selectAllEl.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.size;
        }
      }
    }

    function onlineTagHtml(online) {
      return online
        ? '<span class="online-tag is-online">已上线</span>'
        : '<span class="online-tag is-offline">未上线</span>';
    }

    function render() {
      if (!tableBodyEl) return;
      const keywordRaw = (searchEl?.value || "").trim();
      const items = getFiltered();
      const filterKey = `${keywordRaw}\u0001${domainFilter}\u0001${onlineFilter}`;
      if (filterKey !== lastTermFilterKey) {
        lastTermFilterKey = filterKey;
        termCurrentPage = 1;
      }
      const totalPages = Math.max(1, Math.ceil(items.length / TERM_PAGE_SIZE));
      termCurrentPage = Math.min(termCurrentPage, totalPages);
      const startIndex = (termCurrentPage - 1) * TERM_PAGE_SIZE;
      const pageItems = items.slice(startIndex, startIndex + TERM_PAGE_SIZE);
      if (termListMetaEl) {
        const totalEl = termListMetaEl.querySelector(".term-meta-total");
        if (totalEl) totalEl.textContent = String(items.length);
      }
      const termTableEl = document.querySelector("#listCatalogTermPanel .term-table");
      if (termPagerEl) {
        termPagerEl.hidden = !pageItems.length || Boolean(termTableEl?.hidden);
        if (termPagerSummaryEl) termPagerSummaryEl.textContent = `共 ${items.length} 条，每页 ${TERM_PAGE_SIZE} 条`;
        if (termPagerStateEl) termPagerStateEl.textContent = `第 ${termCurrentPage} / ${totalPages} 页`;
        if (termPrevPageBtnEl) termPrevPageBtnEl.disabled = termCurrentPage <= 1;
        if (termNextPageBtnEl) termNextPageBtnEl.disabled = termCurrentPage >= totalPages;
      }
      if (!items.length) {
        tableBodyEl.innerHTML = `
          <tr class="term-empty-row">
            <td colspan="11">
              <div class="term-empty">暂无术语，点击「创建」或「导入」添加</div>
            </td>
          </tr>
        `;
      } else {
        tableBodyEl.innerHTML = pageItems
          .map(
            (item, index) => {
              const modelText = termModelList(item).join("、") || "全部模型";
              return `
          <tr data-id="${item.id}" class="${item.online === false ? "is-offline" : ""}">
            <td class="col-check"><input type="checkbox" class="term-row-check" data-id="${item.id}" ${selection.has(item.id) ? "checked" : ""} aria-label="选择行" /></td>
            <td class="col-index">${startIndex + index + 1}</td>
            <td class="col-text"><a class="name-link term-name-link" href="#" data-term-action="detail" data-id="${item.id}" title="${escapeHtml(item.name)}">${highlightHtml(item.name, keywordRaw)}</a></td>
            <td class="domain-cell" title="${escapeHtml(item.domain || "")}">${highlightHtml(item.domain || "—", keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(termModelList(item).join("、") || "对该数据域下全部模型生效")}">${highlightHtml(modelText, keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(item.synonyms)}">${highlightHtml(item.synonyms || "—", keywordRaw)}</td>
            <td class="col-text-wide" title="${escapeHtml(item.description)}">${highlightHtml(item.description || "—", keywordRaw)}</td>
            <td>${escapeHtml(item.creator)}</td>
            <td>${escapeHtml(item.createdAt)}</td>
            <td class="col-online">${onlineTagHtml(isTermOnline(item))}</td>
            <td class="col-actions">
              <a class="op-link" href="#" data-term-action="online" data-id="${item.id}">${isTermOnline(item) ? "下线" : "上线"}</a>
              <a class="op-link" href="#" data-term-action="edit" data-id="${item.id}">编辑</a>
              <a class="op-link" href="#" data-term-action="delete" data-id="${item.id}">删除</a>
            </td>
          </tr>
        `;
            }
          )
          .join("");
      }
      syncSelectionUi();
      syncGlossaryEmptyState();
    }

    /* 需求调整：无术语数据时隐藏空状态卡片下方的空列表（与 index.html renderHeader 同口径：按术语库数据域统计） */
    function syncGlossaryEmptyState() {
      if (typeof window.GlossaryUI?.getCurG !== "function") return;
      const g = window.GlossaryUI.getCurG();
      if (!g) return;
      const domainsOf = (t) => t.domains || (t.domain || "").split(/[、,，]/).map((d) => d.trim()).filter(Boolean);
      const cnt = terms.filter((t) => domainsOf(t).includes(g.domain)).length;
      const es = document.getElementById("glossaryEmptyState");
      if (es) es.hidden = cnt > 0;
      const tt = document.querySelector("#listCatalogTermPanel .term-table");
      if (tt) tt.hidden = cnt === 0;
      const badge = document.getElementById("glossaryTabTermCount");
      if (badge) badge.textContent = cnt;
    }

    function openForm(item = null) {
      editingId = item?.id || null;
      if (formTitleEl) formTitleEl.textContent = item ? "编辑术语" : "创建术语";
      if (formNameEl) formNameEl.value = item?.name || "";
      // 需求：所属数据域默认继承当前术语库的数据域（新建且未显式带域时直接继承；编辑时反显术语自身域，无域则继承库域），并提示已继承，可修改
      const glossary = currentGlossaryInfo();
      let formDomains = termDomainList(item);
      let inherited = false;
      if (!formDomains.length && glossary) {
        formDomains = [glossary.domain];
        inherited = true;
      } else if (glossary && formDomains.includes(glossary.domain)) {
        inherited = true;
      }
      initTermDomainPicker(formDomains);
      if (inherited) showDomainInheritHint("termFormDomainInheritHint", "termDomainPicker", glossary.name, glossary.domain);
      else hideDomainInheritHint("termFormDomainInheritHint");
      initTermModelPicker(termModelList(item));
      if (formSynonymsEl) formSynonymsEl.value = item?.synonyms || "";
      if (formDescEl) formDescEl.value = item?.description || "";
      hideTermNameDupHint();
      if (formOverlayEl) formOverlayEl.hidden = false;
      formNameEl?.focus();
    }

    function closeForm() {
      if (formOverlayEl) formOverlayEl.hidden = true;
      editingId = null;
      setTermDomainPickerOpen(false);
      setTermModelPickerOpen(false);
      hideTermNameDupHint();
    }

    // ===== 重名实时联想校验 + 引用统计 =====

    function countTermReferences(termId) {
      let metricCount = 0;
      try {
        const metrics = global.MetricModule?.readMetrics?.() || [];
        metricCount = metrics.filter((metric) => (metric.termIds || []).includes(termId)).length;
      } catch (_err) {
        metricCount = 0;
      }
      let fieldCount = 0;
      const fieldMap = readFieldTermMap();
      Object.keys(fieldMap).forEach((key) => {
        if ((fieldMap[key] || []).includes(termId) && !isFieldTermDismissed(key, termId)) fieldCount += 1;
      });
      return { metricCount, fieldCount };
    }

    function duplicateRefSummary(term) {
      const { metricCount, fieldCount } = countTermReferences(term.id);
      return `已挂载 ${metricCount} 个指标、${fieldCount} 个字段`;
    }

    function findTermNameDuplicates(name, excludeId, domainList) {
      const value = String(name || "").trim();
      if (!value) return [];
      const domains = domainList || [];
      return terms.filter(
        (item) =>
          item.id !== excludeId &&
          item.name === value &&
          (!domains.length || domains.some((domain) => termHasDomain(item, domain)))
      );
    }

    /* 需求：重名提醒统一文案 —— 「数据域」已存在同名术语：名称、名称（顿号分割），确定则直接覆盖 */
    function formatDupGroups(duplicates, scopeDomains) {
      const groups = new Map();
      (duplicates || []).forEach((item) => {
        const domainsOfItem = termDomainList(item);
        const hitDomains = (scopeDomains || []).filter((d) => domainsOfItem.includes(d));
        (hitDomains.length ? hitDomains : domainsOfItem.length ? domainsOfItem : ["未分域"]).forEach((d) => {
          if (!groups.has(d)) groups.set(d, new Set());
          groups.get(d).add(item.name);
        });
      });
      return [...groups.entries()].map(([domain, names]) => `「${domain}」数据域已存在同名术语：${[...names].join("、")}`).join("；");
    }

    function ensureTermNameDupHintEl() {
      if (!formNameEl?.parentElement) return null;
      let hintEl = document.getElementById("termFormNameDupHint");
      if (!hintEl) {
        hintEl = document.createElement("p");
        hintEl.id = "termFormNameDupHint";
        hintEl.className = "modal-hint";
        hintEl.style.display = "none";
        formNameEl.parentElement.appendChild(hintEl);
      }
      return hintEl;
    }

    function hideTermNameDupHint() {
      const hintEl = document.getElementById("termFormNameDupHint");
      if (!hintEl) return;
      hintEl.style.display = "none";
      hintEl.textContent = "";
    }

    function renderTermNameDupHint() {
      const hintEl = ensureTermNameDupHintEl();
      if (!hintEl) return [];
      const name = (formNameEl?.value || "").trim();
      const duplicates = findTermNameDuplicates(name, editingId, [...selectedFormDomains]);
      if (!duplicates.length) {
        hideTermNameDupHint();
        return [];
      }
      const scope = selectedFormDomains.size ? "所选数据域" : "当前系统";
      hintEl.textContent = `⚠ 重名提醒：${formatDupGroups(duplicates, [...selectedFormDomains]) || scope}，请调整名称或数据域，确定则直接覆盖。`;
      hintEl.style.color = "#c2410c";
      hintEl.style.display = "";
      return duplicates;
    }

    function renderBatchMoveDupHint() {
      const host = document.getElementById("catalogBatchDomainMultiWrap");
      if (!host) return;
      let hintEl = document.getElementById("termBatchMoveDupHint");
      if (!hintEl) {
        hintEl = document.createElement("p");
        hintEl.id = "termBatchMoveDupHint";
        hintEl.className = "modal-hint";
        hintEl.style.display = "none";
        host.appendChild(hintEl);
      }
      const domains = [...selectedBatchMoveDomains];
      const hide = () => {
        hintEl.style.display = "none";
        hintEl.textContent = "";
      };
      if (!domains.length) {
        hide();
        return;
      }
      const visibleIds = new Set(getFiltered().map((item) => item.id));
      const conflicts = [];
      [...selection].forEach((id) => {
        if (!visibleIds.has(id)) return;
        const source = terms.find((item) => item.id === id);
        if (!source) return;
        const hit = terms.find(
          (item) => item.id !== id && item.name === source.name && domains.some((domain) => termHasDomain(item, domain))
        );
        if (hit) conflicts.push(hit);
      });
      if (!conflicts.length) {
        hide();
        return;
      }
      const detail = formatDupGroups(conflicts, domains) || "所选目标数据域";
      hintEl.textContent = `⚠ 重名提醒：${detail}，请调整名称或数据域，确定则直接覆盖。`;
      hintEl.style.color = "#c2410c";
      hintEl.style.display = "";
    }

    function saveForm() {
      const name = (formNameEl?.value || "").trim();
      if (!name) {
        window.alert("请填写术语名称");
        formNameEl?.focus();
        return;
      }
      const domains = [...selectedFormDomains];
      if (!domains.length) {
        window.alert("请至少选择一个数据域");
        document.getElementById("termDomainSearch")?.focus();
        return;
      }
      const project = currentProject();
      const duplicates = findTermNameDuplicates(name, editingId, domains);
      if (duplicates.length) {
        /* 需求：重名不再拦截，确认后直接覆盖保存 */
        const ok = window.confirm(`重名提醒：${formatDupGroups(duplicates, domains)}，请调整名称或数据域，确定则直接覆盖。`);
        renderTermNameDupHint();
        if (!ok) return;
      }
      const modelNames = [...selectedFormModels];
      const modelIds = modelNames.map((name) => modelsForDomains(domains).find((model) => model.name === name)?.id || name);
      const values = {
        name,
        domains,
        domain: domains.join("、"),
        modelNames,
        modelIds,
        synonyms: (formSynonymsEl?.value || "").trim(),
        description: (formDescEl?.value || "").trim(),
        project,
      };
      if (editingId) {
        const target = terms.find((item) => item.id === editingId);
        if (!target) {
          setTip("术语不存在或已删除");
          return;
        }
        Object.assign(target, values);
        setTip(`已更新术语：${name}`);
      } else {
        terms.unshift({
          id: createId(),
          ...values,
          online: false,
          creator: "当前用户",
          createdAt: formatDate(),
        });
        setTip(`已创建术语：${name}（默认未上线，上线后可供挂载）`);
      }
      writeTerms(terms);
      closeForm();
      render();
    }

    function deleteByIds(ids) {
      const idSet = new Set(ids);
      const removed = terms.filter((item) => idSet.has(item.id));
      if (!removed.length) return;
      terms = terms.filter((item) => !idSet.has(item.id));
      ids.forEach((id) => selection.delete(id));
      writeTerms(terms);
      render();
    }

    function getLinkedMetrics(termId) {
      const list = global.MetricModule?.readMetrics?.() || [];
      return list.filter((m) => Array.isArray(m.termIds) && m.termIds.includes(termId));
    }

    function getLinkedFields(termId) {
      const seen = new Set();
      const result = [];
      const push = (modelName, fieldEn) => {
        const key = fieldTermKey(modelName, fieldEn);
        if (!modelName || !fieldEn || seen.has(key)) return;
        seen.add(key);
        result.push({ key, modelName, fieldEn });
      };
      Object.entries(readFieldTermMap()).forEach(([key, ids]) => {
        if (!Array.isArray(ids) || !ids.includes(termId)) return;
        if (isFieldTermDismissed(key, termId)) return;
        const [modelName, fieldEn] = key.split("|");
        const model = listBusinessModels().find((item) => item.name === modelName);
        const term = terms.find((item) => item.id === termId);
        if (term && model && !termAppliesToModels(term, { modelNames: [modelName], domains: [model.domain] })) return;
        push(modelName, fieldEn);
      });
      collectFieldSettingRows().forEach((row) => {
        listBusinessModels().forEach((model) => {
          const hits = matchTermsForField(
            { modelName: model.name, fieldEn: row.fieldEn, fieldZh: row.fieldZh },
            terms
          );
          if (hits.some((item) => item.id === termId && !isFieldTermDismissed(fieldTermKey(model.name, row.fieldEn), termId))) {
            push(model.name, row.fieldEn || row.fieldZh);
          }
        });
      });
      return result;
    }

    function openDetail(termId) {
      const item = terms.find((t) => t.id === termId);
      if (!item || !detailDrawerEl || !detailBodyEl) return;
      if (detailTitleEl) detailTitleEl.textContent = `术语详情 · ${item.name}`;
      const metrics = getLinkedMetrics(item.id);
      const fields = getLinkedFields(item.id);
      detailBodyEl.innerHTML = `
        <div class="bridge-section">
          <h4>基本信息</h4>
          <p><strong>名称：</strong>${escapeHtml(item.name)}</p>
          <p><strong>数据域：</strong>${escapeHtml(item.domain || "—")}</p>
          <p><strong>生效模型：</strong>${escapeHtml(termModelList(item).join("、") || "对该数据域下全部模型生效")}</p>
          <p><strong>所属工程：</strong>${escapeHtml(item.project || "—")}</p>
          <p><strong>同义词：</strong>${escapeHtml(item.synonyms || "—")}</p>
          <p><strong>描述：</strong>${escapeHtml(item.description || "—")}</p>
          <p><strong>状态：</strong>${item.online !== false ? "已上线（可供指标/字段挂载）" : "未上线"}</p>
        </div>
        <div class="bridge-section">
          <h4>关联指标清单</h4>
          ${
            metrics.length
              ? `<ul class="term-link-list">${metrics
                  .map(
                    (m) =>
                      `<li><a href="#" data-open-metric="${escapeHtml(m.id)}">${escapeHtml(m.name)}</a> <span class="term-link-meta">${escapeHtml(m.code || "")}</span></li>`
                  )
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无指标挂载该术语</p>'
          }
        </div>
        <div class="bridge-section">
          <h4>关联字段清单</h4>
          ${
            fields.length
              ? `<ul class="term-link-list">${fields
                  .map(
                    (f) =>
                      `<li><a href="#" data-open-field="${escapeHtml(f.key)}">${escapeHtml(f.modelName)} · ${escapeHtml(f.fieldEn)}</a></li>`
                  )
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无字段挂载该术语</p>'
          }
        </div>
      `;
      detailDrawerEl.hidden = false;
      global.syncDrawerBackdrop?.();
    }

    function closeDetail() {
      if (detailDrawerEl) detailDrawerEl.hidden = true;
      global.syncDrawerBackdrop?.();
    }

    function setImportStep(step) {
      importStep = step;
      importStepEls().forEach((panel) => {
        panel.hidden = Number(panel.dataset.termImportStepPanel) !== step;
      });
      document.querySelectorAll("[data-term-import-step]").forEach((el) => {
        const n = Number(el.dataset.termImportStep);
        el.classList.toggle("is-active", n === step);
        el.classList.toggle("is-done", n < step);
      });
      if (importPrevBtnEl) importPrevBtnEl.hidden = step <= 1;
      if (importNextBtnEl) {
        importNextBtnEl.textContent = step >= 4 ? "完成并导入" : step === 3 ? "进入确认" : "下一步";
      }
    }

    function setImportFileStatus(message, type = "") {
      if (!importFileStatusEl) return;
      importFileStatusEl.textContent = message;
      importFileStatusEl.classList.remove("is-ok", "is-error");
      if (type === "ok") importFileStatusEl.classList.add("is-ok");
      if (type === "error") importFileStatusEl.classList.add("is-error");
    }

    function applyParsedImport(parsed, meta = {}) {
      const headers = parsed?.headers || [];
      const rows = parsed?.rows || [];
      importRows = rows;
      importSourceText = meta.text || "";
      importSourceName = meta.name || "";
      importSourceFile = meta.file || null;
      if (!csvHasRequiredHeaders(headers)) {
        const missing = CSV_HEADERS.filter((h) => !headers.includes(h));
        setImportFileStatus(
          `已读取「${importSourceName || "文件"}」，但缺少列：${missing.join("、")}。表头需为：${CSV_HEADERS.join("、")}`,
          "error"
        );
        return false;
      }
      if (!rows.length) {
        setImportFileStatus("文件只有表头，没有数据行。请至少填写一行术语。", "error");
        return false;
      }
      setImportFileStatus(`已载入「${importSourceName}」：${rows.length} 行，可点「下一步」。文件已自动保存到文档中心。`, "ok");
      notifyImportDocument({ stage: "upload" });
      return true;
    }

    function notifyImportDocument(extra = {}) {
      const onImportDocument = typeof deps.onImportDocument === "function" ? deps.onImportDocument : null;
      if (!onImportDocument || !(importSourceFile || importSourceText || importSourceName)) return;
      onImportDocument({
        file: importSourceFile,
        text: importSourceText,
        name: importSourceName || importSourceFile?.name || "术语导入.csv",
        domain: extra.domain || "",
        stage: extra.stage || "upload",
        added: extra.added,
        updated: extra.updated,
      });
    }

    async function ensureImportRowsFromFile() {
      const file = importFileInputEl?.files?.[0];
      if (!file) return false;
      try {
        const { text, parsed } = await readCsvFile(file);
        return applyParsedImport(parsed, { text, name: file.name, file });
      } catch (_err) {
        setImportFileStatus("读取文件失败，请重新选择 CSV。", "error");
        return false;
      }
    }

    function openImportWizard() {
      importRows = [];
      validatedRows = [];
      importSourceFile = null;
      importSourceText = "";
      importSourceName = "";
      // 需求：批量导入的目标数据域默认继承当前术语库的数据域（反显+提示），用户可修改
      const glossary = currentGlossaryInfo();
      initImportDomainPicker(glossary ? [glossary.domain] : []);
      if (glossary) showDomainInheritHint("termImportDomainInheritHint", "termImportDomainPicker", glossary.name, glossary.domain);
      else hideDomainInheritHint("termImportDomainInheritHint");
      importModeEls().forEach((el) => {
        el.checked = el.value === "create";
      });
      if (importFileInputEl) importFileInputEl.value = "";
      if (importPreviewBodyEl) importPreviewBodyEl.innerHTML = "";
      if (importSummaryEl) importSummaryEl.textContent = "请先上传 CSV 或使用示例文件";
      setImportFileStatus("尚未载入文件。请选择 CSV，或点「使用示例文件」。");
      setImportStep(1);
      if (importOverlayEl) importOverlayEl.hidden = false;
    }

    function closeImportWizard() {
      if (importOverlayEl) importOverlayEl.hidden = true;
      setImportDomainPickerOpen(false);
    }

    function validateImportRows(rows, domains, mode, project) {
      const domainList = (Array.isArray(domains) ? domains : [domains]).map((item) => String(item || "").trim()).filter(Boolean);
      const fileNameCount = new Map();
      rows.forEach((row) => {
        const name = String(row["术语名称"] || "").trim();
        if (!name) return;
        fileNameCount.set(name, (fileNameCount.get(name) || 0) + 1);
      });
      return rows.map((row) => {
        const name = String(row["术语名称"] || "").trim();
        const synonyms = String(row["同义词"] || "").trim();
        const description = String(row["术语描述"] || "").trim();
        const errors = [];
        if (!name) errors.push("术语名称不能为空");
        if (name && fileNameCount.get(name) > 1) errors.push("CSV 内术语名称重复");
        const hitDomains = name
          ? domainList.filter((domain) => terms.some((item) => item.name === name && termHasDomain(item, domain)))
          : [];
        if (mode === "create" && hitDomains.length) {
          errors.push(`数据域「${hitDomains.join("、")}」下术语已存在（新增模式不可覆盖）`);
        }
        const existing = terms.find((item) => item.name === name && domainList.some((domain) => termHasDomain(item, domain)));
        const status = errors.length ? "error" : existing && mode === "upsert" ? "update" : "ok";
        return {
          line: row.__line,
          name,
          synonyms,
          description,
          domains: domainList.slice(),
          domain: domainList.join("、"),
          project,
          status,
          errors,
          existingId: existing?.id || null,
        };
      });
    }

    function renderImportPreview() {
      const ok = validatedRows.filter((r) => r.status === "ok").length;
      const update = validatedRows.filter((r) => r.status === "update").length;
      const err = validatedRows.filter((r) => r.status === "error").length;
      if (importSummaryEl) {
        importSummaryEl.textContent = `共 ${validatedRows.length} 行：可新增 ${ok}，将更新 ${update}，失败 ${err}`;
      }
      if (!importPreviewBodyEl) return;
      importPreviewBodyEl.innerHTML = validatedRows
        .map(
          (r) => `
        <tr class="${r.status === "error" ? "is-import-error" : ""}">
          <td>${r.line}</td>
          <td>${escapeHtml(r.name || "—")}</td>
          <td>${escapeHtml(r.synonyms || "—")}</td>
          <td>${escapeHtml(r.description || "—")}</td>
          <td>${r.status === "error" ? "失败" : r.status === "update" ? "更新" : "新增"}</td>
          <td class="import-error-cell">${r.errors.length ? escapeHtml(r.errors.join("；")) : "—"}</td>
        </tr>
      `
        )
        .join("");
    }

    function applyImport() {
      const domains = [...selectedImportDomains];
      const mode = importModeEls().find((el) => el.checked)?.value || "create";
      const project = currentProject();
      const passRows = validatedRows.filter((r) => r.status !== "error");
      if (!domains.length) {
        setTip("请至少选择一个数据域");
        return false;
      }
      if (!passRows.length) {
        if (importSummaryEl) {
          importSummaryEl.textContent = "没有可导入的合法行，请返回预览检查失败原因。";
        }
        setTip("没有可导入的合法行");
        return false;
      }
      if (mode === "replace") {
        terms = terms.filter((item) => !domains.some((domain) => termHasDomain(item, domain)));
      }
      let added = 0;
      let updated = 0;
      passRows.forEach((row) => {
        const rowProject = row.project || project;
        const rowDomains = row.domains?.length ? row.domains : domains;
        if (row.existingId && (mode === "upsert" || mode === "replace")) {
          const target = terms.find((item) => item.id === row.existingId);
          if (target) {
            target.synonyms = row.synonyms;
            target.description = row.description;
            target.project = rowProject;
            target.domains = [...new Set([...termDomainList(target), ...rowDomains])];
            target.domain = target.domains.join("、");
            updated += 1;
            return;
          }
        }
        if (mode === "create" && row.existingId) return;
        const existedAfter = terms.find((item) => item.name === row.name && rowDomains.some((domain) => termHasDomain(item, domain)));
        if (existedAfter && mode === "upsert") {
          existedAfter.synonyms = row.synonyms;
          existedAfter.description = row.description;
          existedAfter.project = rowProject;
          existedAfter.domains = [...new Set([...termDomainList(existedAfter), ...rowDomains])];
          existedAfter.domain = existedAfter.domains.join("、");
          updated += 1;
          return;
        }
        if (existedAfter && mode === "create") return;
        terms.unshift({
          id: createId(),
          name: row.name,
          synonyms: row.synonyms,
          description: row.description,
          domains: rowDomains.slice(),
          domain: rowDomains.join("、"),
          project: rowProject,
          online: false,
          creator: "当前用户",
          createdAt: formatDate(),
        });
        added += 1;
      });
      writeTerms(terms);
      render();
      notifyImportDocument({
        stage: "import",
        domain: domains.join("、"),
        added,
        updated,
      });
      return true;
    }

    async function handleImportNext() {
      if (importStep === 1) {
        if (!importRows.length) {
          const hasFile = Boolean(importFileInputEl?.files?.[0]);
          if (hasFile) {
            setImportFileStatus("正在读取文件…");
            const ok = await ensureImportRowsFromFile();
            if (!ok) return;
          } else {
            setImportFileStatus("请先选择 CSV 文件，或点「使用示例文件」。", "error");
            return;
          }
        }
        const headers = Object.keys(importRows[0] || {}).filter((k) => k !== "__line");
        const missing = CSV_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length) {
          setImportFileStatus(`CSV 缺少列：${missing.join("、")}。表头需为：${CSV_HEADERS.join("、")}`, "error");
          return;
        }
        setImportStep(2);
        return;
      }
      if (importStep === 2) {
        const domains = [...selectedImportDomains];
        if (!domains.length) {
          setTip("请至少选择一个数据域");
          document.getElementById("termImportDomainSearch")?.focus();
          setImportDomainPickerOpen(true);
          return;
        }
        const mode = importModeEls().find((el) => el.checked)?.value || "create";
        validatedRows = validateImportRows(importRows, domains, mode, currentProject());
        renderImportPreview();
        setImportStep(3);
        return;
      }
      if (importStep === 3) {
        setImportStep(4);
        return;
      }
      if (importStep === 4) {
        if (applyImport()) closeImportWizard();
      }
    }

    createBtnEl?.addEventListener("click", () => openForm(null));
    templateBtnEl?.addEventListener("click", () => {
      const content = [CSV_HEADERS.join(","), `示例术语,"同义词1,同义词2",术语业务定义说明`].join("\n");
      downloadCsv("术语导入模板.csv", content);
      setTip("已下载标准 CSV 模板");
    });
    exportBtnEl?.addEventListener("click", () => {
      const items = getFiltered();
      if (!items.length) {
        setTip("暂无可导出的术语");
        return;
      }
      const cell = (value) => {
        const text = String(value ?? "");
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = [CSV_HEADERS.join(",")];
      items.forEach((item) => {
        lines.push([cell(item.name), cell(item.synonyms), cell(item.description)].join(","));
      });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadCsv(`术语导出_${stamp}.csv`, lines.join("\n"));
      setTip(`已导出 ${items.length} 条术语`);
    });
    importBtnEl?.addEventListener("click", openImportWizard);
    importCloseBtnEl?.addEventListener("click", closeImportWizard);
    importCancelBtnEl?.addEventListener("click", closeImportWizard);
    importPrevBtnEl?.addEventListener("click", () => {
      if (importStep > 1) setImportStep(importStep - 1);
    });
    importNextBtnEl?.addEventListener("click", () => {
      void handleImportNext();
    });
    importUseSampleBtnEl?.addEventListener("click", () => {
      const text = sampleCsvText();
      const parsed = parseCsvText(text);
      applyParsedImport(parsed, {
        text,
        name: "术语导入示例.csv",
        file: new File([`\uFEFF${text}`], "术语导入示例.csv", { type: "text/csv" }),
      });
      if (importFileInputEl) importFileInputEl.value = "";
    });
    importFileInputEl?.addEventListener("change", () => {
      void (async () => {
        const file = importFileInputEl.files?.[0];
        if (!file) {
          importRows = [];
          setImportFileStatus("尚未载入文件。请选择 CSV，或点「使用示例文件」。");
          return;
        }
        setImportFileStatus(`正在读取「${file.name}」…`);
        try {
          const { text, parsed } = await readCsvFile(file);
          applyParsedImport(parsed, { text, name: file.name, file });
        } catch (_err) {
          importRows = [];
          setImportFileStatus("读取文件失败，请重新选择 CSV。", "error");
        }
      })();
    });
    importOverlayEl?.addEventListener("click", (event) => {
      if (event.target === importOverlayEl) closeImportWizard();
    });

    selectAllEl?.addEventListener("change", () => {
      const checked = Boolean(selectAllEl.checked);
      getFiltered().forEach((item) => {
        if (checked) selection.add(item.id);
        else selection.delete(item.id);
      });
      render();
    });
    searchEl?.addEventListener("input", render);
    termPrevPageBtnEl?.addEventListener("click", () => {
      termCurrentPage = Math.max(1, termCurrentPage - 1);
      render();
    });
    termNextPageBtnEl?.addEventListener("click", () => {
      termCurrentPage += 1;
      render();
    });
    tableBodyEl?.addEventListener("change", (event) => {
      const check = event.target.closest(".term-row-check");
      if (!check) return;
      if (check.checked) selection.add(check.dataset.id);
      else selection.delete(check.dataset.id);
      syncSelectionUi();
    });
    tableBodyEl?.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-term-action]");
      if (!actionBtn) return;
      event.preventDefault();
      const { id, termAction: action } = actionBtn.dataset;
      const item = terms.find((row) => row.id === id);
      if (!item) return;
      if (action === "detail") openDetail(id);
      if (action === "edit") openForm(item);
      if (action === "online") {
        item.online = item.online === false;
        writeTerms(terms);
        render();
        setTip(
          item.online !== false
            ? `术语「${item.name}」已上线，可供指标/字段挂载`
            : `术语「${item.name}」已下线，暂不可挂载`
        );
      }
      if (action === "delete") {
        if (!window.confirm(`确定删除术语「${item.name}」吗？\n该术语${duplicateRefSummary(item)}，删除后指标/字段上的对应挂载引用将一并失效。`)) return;
        deleteByIds([id]);
        setTip(`已删除术语：${item.name}`);
      }
    });
    formSaveBtnEl?.addEventListener("click", saveForm);
    formCancelBtnEl?.addEventListener("click", closeForm);
    formCloseBtnEl?.addEventListener("click", closeForm);
    formOverlayEl?.addEventListener("click", (event) => {
      if (event.target === formOverlayEl) closeForm();
    });
    detailCloseBtnEl?.addEventListener("click", closeDetail);
    detailBodyEl?.addEventListener("click", (event) => {
      const metricLink = event.target.closest("[data-open-metric]");
      if (metricLink) {
        event.preventDefault();
        closeDetail();
        openMetricById?.(metricLink.dataset.openMetric);
        return;
      }
      const fieldLink = event.target.closest("[data-open-field]");
      if (fieldLink) {
        event.preventDefault();
        closeDetail();
        openFieldByKey?.(fieldLink.dataset.openField);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (importOverlayEl && !importOverlayEl.hidden) closeImportWizard();
      else if (formOverlayEl && !formOverlayEl.hidden) closeForm();
      else if (detailDrawerEl && !detailDrawerEl.hidden) closeDetail();
    });

    function ensureFieldMountDemoTerms() {
      let changed = false;
      FIELD_MOUNT_DEMO_TERMS.forEach((item) => {
        let term = terms.find((entry) => entry.name === item.name && termHasDomain(entry, item.domain));
        if (!term) {
          term = terms.find((entry) => entry.name === item.name);
        }
        if (!term) {
          terms.unshift({
            id: createId(),
            ...item,
            domains: [item.domain],
            domain: item.domain,
            modelNames: [],
            modelIds: [],
            project: currentProject(),
            online: true,
            creator: "管理员",
            createdAt: formatDate(),
          });
          changed = true;
          return;
        }
        if (!termHasDomain(term, item.domain)) {
          const domains = [...termDomainList(term), item.domain];
          term.domains = domains;
          term.domain = domains.join("、");
          changed = true;
        }
        if (term.online === false) {
          term.online = true;
          changed = true;
        }
        if (!String(term.description || "").trim()) {
          term.description = item.description;
          changed = true;
        }
        if (!String(term.synonyms || "").trim()) {
          term.synonyms = item.synonyms;
          changed = true;
        }
      });
      if (changed) writeTerms(terms);
    }

    const onlineFilterTriggerEl = document.getElementById("termOnlineFilterTrigger");
    const onlineFilterPanelEl = document.getElementById("termOnlineFilterPanel");
    const onlineFilterListEl = document.getElementById("termOnlineFilterList");

    function syncTermOnlineFilterUi() {
      if (onlineFilterTriggerEl) {
        const isOpen = Boolean(onlineFilterPanelEl && !onlineFilterPanelEl.hidden);
        onlineFilterTriggerEl.classList.toggle("is-active", Boolean(onlineFilter));
        onlineFilterTriggerEl.classList.toggle("is-open", isOpen);
        onlineFilterTriggerEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }
      if (onlineFilterListEl) {
        onlineFilterListEl.querySelectorAll("[data-online-value]").forEach((item) => {
          item.classList.toggle("is-selected", (item.dataset.onlineValue || "") === onlineFilter);
        });
      }
    }

    function closeTermOnlineFilterPanel() {
      if (!onlineFilterPanelEl || onlineFilterPanelEl.hidden) {
        syncTermOnlineFilterUi();
        return;
      }
      onlineFilterPanelEl.hidden = true;
      onlineFilterPanelEl.style.position = "";
      onlineFilterPanelEl.style.top = "";
      onlineFilterPanelEl.style.left = "";
      onlineFilterPanelEl.style.zIndex = "";
      const host = onlineFilterTriggerEl?.closest(".th-cell");
      if (host && onlineFilterPanelEl.parentElement !== host) {
        host.appendChild(onlineFilterPanelEl);
      }
      syncTermOnlineFilterUi();
    }

    function openTermOnlineFilterPanel() {
      if (!onlineFilterPanelEl || !onlineFilterTriggerEl) return;
      if (onlineFilterPanelEl.parentElement !== document.body) {
        document.body.appendChild(onlineFilterPanelEl);
      }
      onlineFilterPanelEl.hidden = false;
      const rect = onlineFilterTriggerEl.getBoundingClientRect();
      onlineFilterPanelEl.style.position = "fixed";
      onlineFilterPanelEl.style.top = `${Math.round(rect.bottom + 4)}px`;
      onlineFilterPanelEl.style.left = `${Math.round(rect.left)}px`;
      onlineFilterPanelEl.style.zIndex = "1200";
      syncTermOnlineFilterUi();
    }

    function toggleTermOnlineFilterPanel() {
      if (!onlineFilterPanelEl || !onlineFilterTriggerEl) return;
      if (!onlineFilterPanelEl.hidden) {
        closeTermOnlineFilterPanel();
      } else {
        openTermOnlineFilterPanel();
      }
    }

    function bindTermOnlineFilter() {
      onlineFilterTriggerEl?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTermOnlineFilterPanel();
      });
      onlineFilterListEl?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-online-value]");
        if (!item) return;
        event.stopPropagation();
        onlineFilter = item.dataset.onlineValue || "";
        render();
        closeTermOnlineFilterPanel();
        const label = onlineFilter === "online" ? "已上线" : onlineFilter === "offline" ? "未上线" : "全部";
        setTip(onlineFilter ? `已按上线状态「${label}」筛选` : "已显示全部上线状态");
      });
      document.addEventListener("click", (event) => {
        if (!onlineFilterPanelEl || onlineFilterPanelEl.hidden) return;
        if (
          event.target.closest("#termOnlineFilterPanel")
          || event.target.closest("[data-term-online-filter-trigger]")
        ) {
          return;
        }
        closeTermOnlineFilterPanel();
      });
    }

    bindTermDomainPicker();
    bindTermModelPicker();
    bindImportDomainPicker();
    bindBatchMoveDomainPicker();
    bindTermOnlineFilter();
    formNameEl?.addEventListener("blur", renderTermNameDupHint);
    formNameEl?.addEventListener("input", hideTermNameDupHint);
    ensureFieldMountDemoTerms();
    render();

    return {
      render,
      readTerms: () => [...terms],
      ensureFieldMountDemoTerms,
      readOnlineTerms: (project) =>
        terms.filter(
          (item) =>
            item.online !== false &&
            (!project || !item.project || item.project === project)
        ),
      getSelectedIds() {
        const visible = new Set(getFiltered().map((item) => item.id));
        return [...selection].filter((id) => visible.has(id));
      },
      batchMoveDomain(ids, domainOrDomains) {
        const domains = (Array.isArray(domainOrDomains) ? domainOrDomains : [domainOrDomains])
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        if (!domains.length) return;
        const domainSet = new Set(domains);
        const idSet = new Set(ids || []);
        let count = 0;
        terms.forEach((item) => {
          if (!idSet.has(item.id)) return;
          item.domains = [...domains];
          item.domain = domains.join("、");
          const kept = termModelList(item).filter((name) => {
            const model = listBusinessModels().find((entry) => entry.name === name);
            return model && domainSet.has(model.domain);
          });
          item.modelNames = kept;
          item.modelIds = kept.map((name) => listBusinessModels().find((entry) => entry.name === name)?.id || name);
          count += 1;
        });
        writeTerms(terms);
        render();
        setTip(`已将 ${count} 条术语移动到数据域「${domains.join("、")}」`);
      },
      initBatchMoveDomainPicker,
      getBatchMoveDomains,
      batchSetOnline(ids, online) {
        const idSet = new Set(ids || []);
        let count = 0;
        terms.forEach((item) => {
          if (!idSet.has(item.id)) return;
          item.online = Boolean(online);
          count += 1;
        });
        writeTerms(terms);
        render();
        setTip(`已将 ${count} 条术语${online ? "上线" : "下线"}`);
      },
      batchDelete(ids) {
        deleteByIds(ids || []);
        setTip(`已处理批量删除`);
      },
      summarizeTermReferences(ids) {
        const idSet = new Set(ids || []);
        let metricCount = 0;
        try {
          const metrics = global.MetricModule?.readMetrics?.() || [];
          metricCount = metrics.filter((metric) => (metric.termIds || []).some((id) => idSet.has(id))).length;
        } catch (_err) {
          metricCount = 0;
        }
        let fieldCount = 0;
        const fieldMap = readFieldTermMap();
        Object.keys(fieldMap).forEach((key) => {
          const hit = (fieldMap[key] || []).some(
            (id) => idSet.has(id) && !isFieldTermDismissed(key, id)
          );
          if (hit) fieldCount += 1;
        });
        return { metricCount, fieldCount };
      },
      setDomainFilter(value) {
        domainFilter = value || "";
        render();
      },
      setOnlineFilter(value) {
        onlineFilter = value || "";
        syncTermOnlineFilterUi();
        render();
      },
      clearFilters() {
        onlineFilter = "";
        domainFilter = "";
        if (searchEl) searchEl.value = "";
        closeTermOnlineFilterPanel();
        syncTermOnlineFilterUi();
        render();
      },
      openDetail,
      getTermById: (id) => terms.find((t) => t.id === id) || null,
      readFieldTermMap,
      writeFieldTermMap,
      fieldTermKey,
      isFieldTermDismissed,
      dismissFieldTerm,
      markFieldTermsDismissed,
      clearFieldTermDismiss,
      matchTermsForField: (field) => matchTermsForField(field, terms),
      DEFAULT_PROJECT,
    };
  }

  global.TermModule = {
    mount,
    readTerms: () => readTerms() || [],
    readOnlineTerms: (project) =>
      (readTerms() || []).filter(
        (item) => item.online !== false && (!project || !item.project || item.project === project)
      ),
    readFieldTermMap,
    writeFieldTermMap,
    fieldTermKey,
    isFieldTermDismissed,
    dismissFieldTerm,
    markFieldTermsDismissed,
    clearFieldTermDismiss,
    matchTermsForField,
    termAppliesToModels,
    DEFAULT_PROJECT,
  };
})(window);
