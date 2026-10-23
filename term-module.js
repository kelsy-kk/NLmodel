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
    bumpDetailCache();
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

  /* ===== 性能：详情/列表渲染链会高频读取这两个键，
     原实现每次都 localStorage.getItem + JSON.parse，成为详情页卡顿的主因。
     改为进程内缓存；写操作与外部标签页变更（storage 事件）时失效 ===== */
  let fieldTermMapCache = null;
  let fieldTermDismissCache = null;
  let fieldTermRowsCache = null;

  /* 详情渲染用到的「术语挂载清单」缓存：数据一有变动就整体失效 */
  let detailCacheVersion = 0;
  const detailMountCache = new Map();

  function bumpDetailCache() {
    detailCacheVersion += 1;
    if (detailMountCache.size) detailMountCache.clear();
    fieldTermRowsCache = null;
  }

  /* 其他标签页 / 直写 localStorage 时同步失效，避免读到脏缓存 */
  try {
    global.addEventListener?.("storage", (event) => {
      const key = event?.key;
      if (key === FIELD_TERM_KEY || key === FIELD_TERM_DISMISS_KEY || key === STORAGE_KEY) {
        fieldTermMapCache = null;
        fieldTermDismissCache = null;
        bumpDetailCache();
      }
    });
  } catch (_err) {
    /* ignore */
  }

  function readFieldTermMap() {
    if (fieldTermMapCache) return fieldTermMapCache;
    let next = {};
    try {
      const raw = localStorage.getItem(FIELD_TERM_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      next = parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      next = {};
    }
    fieldTermMapCache = next;
    return fieldTermMapCache;
  }

  function writeFieldTermMap(map) {
    fieldTermMapCache = map && typeof map === "object" ? map : {};
    bumpDetailCache();
    try {
      localStorage.setItem(FIELD_TERM_KEY, JSON.stringify(fieldTermMapCache));
      global.dispatchEvent(new CustomEvent("biz-field-terms-updated", { detail: fieldTermMapCache }));
    } catch (_err) {
      /* ignore */
    }
  }

  function fieldTermKey(modelName, fieldEn) {
    return `${modelName || ""}|${fieldEn || ""}`;
  }

  function readFieldTermDismiss() {
    if (fieldTermDismissCache) return fieldTermDismissCache;
    let next = {};
    try {
      const raw = localStorage.getItem(FIELD_TERM_DISMISS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      next = parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      next = {};
    }
    fieldTermDismissCache = next;
    return fieldTermDismissCache;
  }

  function writeFieldTermDismiss(map) {
    fieldTermDismissCache = map && typeof map === "object" ? map : {};
    bumpDetailCache();
    try {
      localStorage.setItem(FIELD_TERM_DISMISS_KEY, JSON.stringify(fieldTermDismissCache));
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

    /* ===== 术语详情（下沉二级页面，替代原抽屉） ===== */
    const detailViewEl = document.getElementById("termDetailView");
    const detailTitleEl = document.getElementById("termDetailTitle");
    const detailDomainEl = document.getElementById("termDetailDomain");
    const detailProjectEl = document.getElementById("termDetailProject");
    const detailOnlineTagEl = document.getElementById("termDetailOnlineTag");
    const detailBackBtnEl = document.getElementById("termDetailBackBtn");
    const detailEditBtnEl = document.getElementById("termDetailEditBtn");
    const detailMountBtnEl = document.getElementById("termDetailMountBtn");
    const detailOnlineBtnEl = document.getElementById("termDetailOnlineBtn");
    const detailOverviewPanelEl = document.getElementById("termDetailOverviewPanel");
    const detailMountsPanelEl = document.getElementById("termDetailMountsPanel");
    const detailLineagePanelEl = document.getElementById("termDetailLineagePanel");
    const detailMountCountEl = document.getElementById("termDetailMountCount");

    let detailTermId = "";
    let detailTab = "overview";
    let detailMountType = "";
    let detailMountKeyword = "";
    /* 渲染节流：同一术语在未变更数据前重复切 tab 时复用已渲染内容 */
    let detailMountsRenderedKey = "";
    let detailLineageRenderedKey = "";

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
        const conflictKeys = collectSynonymConflictKeys();
        tableBodyEl.innerHTML = pageItems
          .map(
            (item, index) => {
              const modelText = termModelList(item).join("、") || "全部模型";
              const typeMeta = termTypeMeta(item.termType);
              const typeBadge = `<i class="term-type-badge" style="background:${typeMeta.color}" title="${escapeHtml(typeMeta.desc)}">${typeMeta.label}</i>`;
              const conflictFlag = conflictKeys.has(item.id) ? '<span class="term-conflict-flag" title="该术语的名称/同义词与其他术语冲突，问数路由可能歧义">⚠️</span>' : "";
              return `
          <tr data-id="${item.id}" class="${item.online === false ? "is-offline" : ""}">
            <td class="col-check"><input type="checkbox" class="term-row-check" data-id="${item.id}" ${selection.has(item.id) ? "checked" : ""} aria-label="选择行" /></td>
            <td class="col-index">${startIndex + index + 1}</td>
            <td class="col-text"><a class="name-link term-name-link" href="#" data-term-action="detail" data-id="${item.id}" title="${escapeHtml(item.name)}">${highlightHtml(item.name, keywordRaw)}</a>${typeBadge}${conflictFlag}</td>
            <td class="domain-cell" title="${escapeHtml(item.domain || "")}">${highlightHtml(item.domain || "—", keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(termModelList(item).join("、") || "对该数据域下全部模型生效")}">${highlightHtml(modelText, keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(item.synonyms)}">${highlightHtml(item.synonyms || "—", keywordRaw)}</td>
            <td class="col-text-wide" title="${escapeHtml(item.description)}">${highlightHtml(item.description || "—", keywordRaw)}</td>
            <td>${escapeHtml(item.creator)}</td>
            <td>${escapeHtml(item.createdAt)}</td>
            <td class="col-online">${onlineTagHtml(isTermOnline(item))}</td>
            <td class="col-actions">
              <a class="op-link" href="#" data-term-action="mount" data-id="${item.id}" title="挂载 数据域/模型/维度/指标/字段 资产">挂载${(item.mounts || []).length ? `(${item.mounts.length})` : ""}</a>
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
      if (detailViewEl && !detailViewEl.hidden && detailTermId) renderDetailView();
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
      /* 问数增强：注入类型/上级术语/值域绑定区块并反显 */
      ensureFormEnhance();
      formValueBindings = (item?.valueBindings || []).map((row) => ({ ...row }));
      renderValueBindingRows();
      bindValueBindingRows();
      const typeEl = document.getElementById("termFormType");
      if (typeEl) typeEl.value = item?.termType || "entity";
      syncParentTermOptions(item?.parentTermId || "");
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
      hideSaveConfirm();
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

    function showSaveConfirm(text) {
      const box = document.getElementById("termSaveConfirm");
      if (!box) return;
      document.getElementById("termSaveConfirmText").textContent = text;
      box.hidden = false;
      box.scrollIntoView({ block: "nearest" });
    }

    function hideSaveConfirm() {
      const box = document.getElementById("termSaveConfirm");
      if (box) box.hidden = true;
    }

    function saveForm(force = false) {
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
      /* 问数增强字段：类型 / 上级术语 / 值域绑定 */
      const termType = document.getElementById("termFormType")?.value || "entity";
      const parentTermId = document.getElementById("termFormParentTerm")?.value || "";
      const valueBindings = formValueBindings
        .filter((row) => row.field && row.value)
        .map((row) => ({ field: row.field, op: row.op, value: row.value }));
      /* 同义词冲突检测（页面内确认条，非阻断；内嵌 webview 中原生 confirm 会冻结页面） */
      const synonymText = (formSynonymsEl?.value || "").trim();
      const conflicts = findSynonymConflicts(name, synonymText, editingId, domains);
      if (conflicts.length && !force) {
        const detail = conflicts
          .slice(0, 4)
          .map((c) => `「${c.word}」已被术语「${c.term.name}」占用（${c.term.domain || "未分组"}${c.crossDomain ? "，跨数据域冲突" : ""}）`)
          .join("；");
        showSaveConfirm(`同义词冲突提醒：${detail}。\n问数时同词多义会导致路由歧义，建议调整。确认无影响可点「仍要保存」。`);
        return;
      }
      const values = {
        name,
        domains,
        domain: domains.join("、"),
        modelNames,
        modelIds,
        synonyms: synonymText,
        description: (formDescEl?.value || "").trim(),
        project,
        termType,
        parentTermId,
        valueBindings,
      };
      if (editingId) {
        const target = terms.find((item) => item.id === editingId);
        if (!target) {
          setTip("术语不存在或已删除");
          return;
        }
        /* 版本快照：口径相关内容变更时记录旧版本 + 影响分析 */
        const impact = termImpactSummary(target);
        const caliberChanged =
          target.description !== values.description ||
          target.synonyms !== values.synonyms ||
          JSON.stringify(target.valueBindings || []) !== JSON.stringify(valueBindings);
        if (caliberChanged) {
          if (impact.total > 0 && !force) {
            showSaveConfirm(
              `口径变更影响分析：该术语被 ${impact.metricCount} 个指标、${impact.fieldCount} 个字段引用，另有 ${impact.mountCount} 个挂载资产。\n修改定义/同义词/值域可能改变这些资产的问数结果，旧版本将自动存入版本历史。确认变更可点「仍要保存」。`
            );
            return;
          }
          target.versions = [
            ...(target.versions || []),
            {
              time: formatDate(),
              editor: "当前用户",
              description: target.description || "",
              synonyms: target.synonyms || "",
              valueBindings: target.valueBindings || [],
            },
          ];
        }
        Object.assign(target, values);
        setTip(`已更新术语：${name}${caliberChanged ? `（口径变更，已存 ${target.versions.length} 个历史版本）` : ""}`);
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

    /* 性能优化：原实现为「每个字段行 × 每个模型」调用 matchTermsForField，
       而后者内部又全量扫一遍术语、查一次模型目录（重扫 DOM）、读一次 dismiss（重解析 localStorage），
       复杂度达 O(行数 × 模型数 × 术语数) 并夹带成千上万次 DOM/localStorage 访问 —— 这是详情页卡顿的主因。
       这里改为：模型目录、挂载表、忽略表都只取一次；术语侧别名只算一次；按（适用模型 × 行）做一次匹配。 */
    function getLinkedFields(termId) {
      const seen = new Set();
      const result = [];
      const push = (modelName, fieldEn) => {
        const key = fieldTermKey(modelName, fieldEn);
        if (!modelName || !fieldEn || seen.has(key)) return;
        seen.add(key);
        result.push({ key, modelName, fieldEn });
      };

      const models = listBusinessModels();
      const modelByName = new Map(models.map((model) => [model.name, model]));
      const fieldMap = readFieldTermMap();
      const dismiss = readFieldTermDismiss();

      /* 1）显式挂载到字段（或由此前自动挂载落库）的记录 */
      Object.keys(fieldMap).forEach((key) => {
        const ids = fieldMap[key];
        if (!Array.isArray(ids) || !ids.includes(termId)) return;
        if ((dismiss[key] || []).includes(termId)) return;
        const [modelName, fieldEn] = key.split("|");
        const model = modelByName.get(modelName);
        const term = terms.find((item) => item.id === termId);
        if (term && model && !termAppliesToModels(term, { modelNames: [modelName], domains: [model.domain] })) return;
        push(modelName, fieldEn);
      });

      /* 2）字段设置行的自动匹配（同名/同义词精确 + 描述相似），与原 matchTermsForField 判定保持一致 */
      const term = terms.find((item) => item.id === termId);
      if (!term || term.online === false || !models.length) return result;
      const rows = fieldTermRowsCache || collectFieldSettingRows();
      fieldTermRowsCache = rows;
      if (!rows.length) return result;

      const aliases = [term.name, ...String(term.synonyms || "").split(/[,，]/)]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      const termDesc = String(term.description || "").trim();
      const applicableModels = models.filter((model) =>
        termAppliesToModels(term, { modelNames: [model.name], domains: [model.domain] })
      );

      applicableModels.forEach((model) => {
        rows.forEach((row) => {
          const fieldEn = row.fieldEn || row.fieldZh;
          const labels = [row.fieldEn, row.fieldZh]
            .map((value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase())
            .filter(Boolean);
          if (!labels.length) return;
          if ((dismiss[fieldTermKey(model.name, fieldEn)] || []).includes(termId)) return;
          const exact = labels.some((label) => aliases.includes(label));
          const similar = !exact && termDesc && isDescriptionSimilar(row.fieldZh, termDesc);
          if (exact || similar) push(model.name, fieldEn);
        });
      });
      return result;
    }

    /* ===== 术语详情：下沉二级页面 ===== */
    const DETAIL_MOUNT_TYPES = ["domain", "model", "dimension", "metric", "field"];

    function detailTerm() {
      return terms.find((t) => t.id === detailTermId) || null;
    }

    /* 汇总术语的全部挂载项：手动挂载（item.mounts）+ 指标/字段的反向关联
       结果带缓存：一次详情渲染内会被 头部/概览/挂载清单/图谱 四处调用，
       加缓存后只算一次，数据变更（bumpDetailCache）时自动失效 */
    function collectDetailMountItems(term) {
      if (!term) return [];
      const cacheKey = `${term.id}@${detailCacheVersion}`;
      const cached = detailMountCache.get(cacheKey);
      if (cached) return cached;
      const items = [];
      const seen = new Set();
      const push = (entry) => {
        const key = `${entry.type}:${entry.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push(entry);
      };
      /* 术语自身的归属数据域（术语表单里选择的数据域）作为一项只读关联展示，避免概览有域、清单为空 */
      termDomainList(term).forEach((domain) => {
        push({
          type: "domain",
          name: domain,
          path: "",
          meta: "",
          source: "owner",
        });
      });
      (term.mounts || []).forEach((m) => {
        const key = String(m.key || "");
        const openTarget = key.includes(":")
          ? { kind: key.split(":")[0], value: key.slice(key.indexOf(":") + 1) }
          : null;
        push({
          type: m.type || "model",
          name: m.name || "—",
          path: m.path || "",
          meta: m.meta || "",
          source: "manual",
          openTarget,
        });
      });
      getLinkedMetrics(term.id).forEach((m) => {
        push({
          type: "metric",
          name: m.name,
          path: m.domain || (m.domainModels || []).map((d) => d?.name || d).filter(Boolean).join("、") || "指标",
          meta: m.code || "",
          source: "auto",
          openTarget: { kind: "metric", value: m.id || m.name },
        });
      });
      getLinkedFields(term.id).forEach((f) => {
        push({
          type: "field",
          name: f.fieldEn,
          path: f.modelName || "",
          meta: "",
          source: "auto",
          openTarget: { kind: "field", value: f.key },
        });
      });
      detailMountCache.set(cacheKey, items);
      return items;
    }

    /* 兼容旧版页面（index.html）：没有下沉详情视图时退回原抽屉 */
    const legacyDrawerEl = document.getElementById("termDetailDrawer");
    const legacyDrawerBodyEl = document.getElementById("termDetailDrawerBody");
    const legacyDrawerTitleEl = document.getElementById("termDetailDrawerTitle");
    const legacyCloseBtnEl = document.getElementById("closeTermDetailDrawerBtn");

    function openDetailLegacy(item) {
      if (!legacyDrawerEl || !legacyDrawerBodyEl) return;
      if (legacyDrawerTitleEl) legacyDrawerTitleEl.textContent = `术语详情 · ${item.name}`;
      const metrics = getLinkedMetrics(item.id);
      const fields = getLinkedFields(item.id);
      legacyDrawerBodyEl.innerHTML = `
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
                  .map((m) => `<li>${escapeHtml(m.name)} <span class="term-link-meta">${escapeHtml(m.code || "")}</span></li>`)
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无指标挂载该术语</p>'
          }
        </div>
        <div class="bridge-section">
          <h4>关联字段清单</h4>
          ${
            fields.length
              ? `<ul class="term-link-list">${fields
                  .map((f) => `<li>${escapeHtml(f.modelName)} · ${escapeHtml(f.fieldEn)}</li>`)
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无字段挂载该术语</p>'
          }
        </div>
      `;
      legacyDrawerEl.hidden = false;
      global.syncDrawerBackdrop?.();
    }

    function closeDetailLegacy() {
      if (legacyDrawerEl) legacyDrawerEl.hidden = true;
      global.syncDrawerBackdrop?.();
    }

    function openDetail(termId) {
      const item = terms.find((t) => t.id === termId);
      if (!item) return;
      if (!detailViewEl) {
        openDetailLegacy(item);
        return;
      }
      detailTermId = item.id;
      detailTab = "overview";
      detailMountType = "";
      detailMountKeyword = "";
      /* 进入详情时刷新一次数据快照，之后 tab 切换复用同一份计算结果 */
      detailMountsRenderedKey = "";
      detailLineageRenderedKey = "";
      bumpDetailCache();
      ["listView", "modelView", "metricEditView"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      if (detailViewEl) detailViewEl.hidden = false;
      renderDetailView();
      if (typeof global.scrollTo === "function") global.scrollTo({ top: 0, behavior: "auto" });
    }

    function closeDetail() {
      if (!detailViewEl) {
        closeDetailLegacy();
        return;
      }
      if (detailViewEl) detailViewEl.hidden = true;
      detailTermId = "";
      detailTab = "overview";
      detailMountsRenderedKey = "";
      detailLineageRenderedKey = "";
      const listView = document.getElementById("listView");
      if (listView) listView.hidden = false;
      render();
      if (typeof global.scrollTo === "function") global.scrollTo({ top: 0, behavior: "auto" });
    }

    function syncDetailTabs() {
      detailViewEl?.querySelectorAll("[data-term-detail-tab]").forEach((tab) => {
        const active = tab.dataset.termDetailTab === detailTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      const panelMap = {
        overview: detailOverviewPanelEl,
        mounts: detailMountsPanelEl,
        lineage: detailLineagePanelEl,
      };
      Object.entries(panelMap).forEach(([name, el]) => {
        if (el) el.hidden = name !== detailTab;
      });
    }

    function switchDetailTab(tab) {
      detailTab = tab || "overview";
      syncDetailTabs();
      const term = detailTerm();
      if (!term) return;
      if (detailTab === "mounts") renderDetailMounts(term);
      if (detailTab === "lineage") renderDetailLineage(term);
    }

    function renderDetailView() {
      const term = detailTerm();
      if (!term) {
        if (detailViewEl) detailViewEl.hidden = true;
        detailTermId = "";
        return;
      }
      renderDetailHead(term);
      syncDetailTabs();
      renderDetailOverview(term);
      renderDetailMounts(term);
      if (detailTab === "lineage") renderDetailLineage(term);
    }

    function renderDetailHead(term) {
      const total = collectDetailMountItems(term).length;
      if (detailTitleEl) detailTitleEl.textContent = term.name || "未命名术语";
      if (detailDomainEl) detailDomainEl.textContent = term.domain || "未指定数据域";
      if (detailProjectEl) detailProjectEl.textContent = term.project || currentProject();
      if (detailOnlineTagEl) {
        const online = term.online !== false;
        detailOnlineTagEl.textContent = online ? "已上线" : "未上线";
        detailOnlineTagEl.className = `online-tag ${online ? "is-online" : "is-offline"}`;
      }
      if (detailOnlineBtnEl) detailOnlineBtnEl.textContent = term.online !== false ? "下线" : "上线";
      if (detailMountCountEl) detailMountCountEl.textContent = String(total);
    }

    function renderDetailOverview(term) {
      if (!detailOverviewPanelEl) return;
      const items = collectDetailMountItems(term);
      const countOf = (type) => items.filter((item) => item.type === type).length;
      const modelText = termModelList(term).join("、") || "对该数据域下全部模型生效";
      const statCards = DETAIL_MOUNT_TYPES.map((type) => {
        const label = mountTypeLabel(type);
        return `
          <div class="td-stat" data-mount-jump="${type}">
            <div class="td-stat-label">${escapeHtml(label)}</div>
            <div class="td-stat-value">${countOf(type)}</div>
          </div>`;
      }).join("");
      detailOverviewPanelEl.innerHTML = `
        <div class="td-card">
          <div class="td-card-title">
            <span>基本信息</span>
            <span class="td-field-label">${term.online !== false ? "已上线，可供指标 / 字段挂载" : "未上线，暂不可挂载"}</span>
          </div>
          <div class="td-grid">
            <div class="td-field"><div class="td-field-label">术语名称</div><div class="td-field-value">${escapeHtml(term.name || "—")}<i class="term-type-badge" style="background:${termTypeMeta(term.termType).color}" title="${escapeHtml(termTypeMeta(term.termType).desc)}">${termTypeMeta(term.termType).label}</i></div></div>
            <div class="td-field"><div class="td-field-label">术语类型</div><div class="td-field-value">${escapeHtml(termTypeMeta(term.termType).desc)}</div></div>
            <div class="td-field"><div class="td-field-label">数据域</div><div class="td-field-value">${escapeHtml(term.domain || "—")}</div></div>
            <div class="td-field"><div class="td-field-label">生效模型</div><div class="td-field-value">${escapeHtml(modelText)}</div></div>
            <div class="td-field"><div class="td-field-label">所属工程</div><div class="td-field-value">${escapeHtml(term.project || "—")}</div></div>
            <div class="td-field"><div class="td-field-label">同义词</div><div class="td-field-value">${escapeHtml(term.synonyms || "—")}</div></div>
            <div class="td-field"><div class="td-field-label">上线状态</div><div class="td-field-value">${onlineTagHtml(term.online !== false)}</div></div>
            <div class="td-field"><div class="td-field-label">创建人</div><div class="td-field-value">${escapeHtml(term.creator || "—")}</div></div>
            <div class="td-field"><div class="td-field-label">创建时间</div><div class="td-field-value">${escapeHtml(term.createdAt || "—")}</div></div>
          </div>
          <div class="td-desc">${escapeHtml(term.description || "暂无术语描述")}</div>
        </div>
        <div class="td-card">
          <div class="td-card-title"><span>挂载概况</span><span class="td-field-label">共 ${items.length} 项资产</span></div>
          <div class="td-stat-row">${statCards}</div>
        </div>
        ${renderAskReadinessCards(term)}
      `;
    }

    /* 详情：值层级 / 值域绑定 / 版本与影响分析 三张卡（问数增强） */
    function renderAskReadinessCards(term) {
      const parentTerm = term.parentTermId ? terms.find((t) => t.id === term.parentTermId) : null;
      const childTerms = terms.filter((t) => t.parentTermId === term.id);
      const impact = termImpactSummary(term);
      const bindings = term.valueBindings || [];
      const versions = (term.versions || []).slice().reverse();
      return `
        <div class="td-card">
          <div class="td-card-title"><span>值层级（上级 / 下级）</span><span class="td-field-label">问数可沿层级上卷或展开</span></div>
          <div class="td-grid">
            <div class="td-field"><div class="td-field-label">上级术语</div><div class="td-field-value">${parentTerm ? `${escapeHtml(parentTerm.name)}（本术语 ⊂ ${escapeHtml(parentTerm.name)}）` : "无 — 顶层术语"}</div></div>
            <div class="td-field"><div class="td-field-label">下级术语</div><div class="td-field-value">${childTerms.length ? escapeHtml(childTerms.map((t) => t.name).join("、")) : "暂无"}</div></div>
          </div>
        </div>
        <div class="td-card">
          <div class="td-card-title"><span>值域绑定</span><span class="td-field-label">问数时生成 WHERE / GROUP BY 条件</span></div>
          ${
            bindings.length
              ? `<ul class="term-link-list">${bindings
                  .map((b) => `<li><b>${escapeHtml(b.field)}</b> ${escapeHtml(b.op)} <b>${escapeHtml(b.value)}</b></li>`)
                  .join("")}</ul>`
              : '<p class="term-link-empty">未配置。过滤/维度类术语建议配置，如 region_id IN (\'01\',\'02\')</p>'
          }
        </div>
        <div class="td-card">
          <div class="td-card-title"><span>影响分析 · 版本历史</span><span class="td-field-label">口径变更自动留痕</span></div>
          <div class="td-grid">
            <div class="td-field"><div class="td-field-label">关联指标</div><div class="td-field-value">${impact.metricCount} 个</div></div>
            <div class="td-field"><div class="td-field-label">关联字段</div><div class="td-field-value">${impact.fieldCount} 个</div></div>
            <div class="td-field"><div class="td-field-label">挂载资产</div><div class="td-field-value">${impact.mountCount} 个</div></div>
            <div class="td-field"><div class="td-field-label">历史版本</div><div class="td-field-value">${(term.versions || []).length} 个</div></div>
          </div>
          ${
            versions.length
              ? `<ul class="term-link-list">${versions
                  .map(
                    (v) =>
                      `<li>${escapeHtml(v.time)} <span class="term-link-meta">${escapeHtml(v.editor || "")} · 描述「${escapeHtml((v.description || "—").slice(0, 30))}」${(v.valueBindings || []).length ? `· 值域 ${(v.valueBindings || []).length} 条` : ""}</span></li>`
                  )
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无历史版本（修改定义/同义词/值域时自动记录旧版本）</p>'
          }
        </div>
      `;
    }

    function renderDetailMounts(term) {
      if (!detailMountsPanelEl) return;
      /* 同一术语重复打开/切 tab 时不再重建工具栏 DOM，避免多余重排与搜索框重建 */
      if (detailMountsRenderedKey !== term.id) {
        const chips = [{ type: "", label: "全部" }]
          .concat(DETAIL_MOUNT_TYPES.map((type) => ({ type, label: mountTypeLabel(type) })))
          .map(
            (chip) => `<button class="td-chip" type="button" data-detail-mount-type="${chip.type}">${escapeHtml(chip.label)}</button>`
          )
          .join("");
        detailMountsPanelEl.innerHTML = `
          <div class="td-toolbar">
            <label class="td-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="M20 20l-4-4"></path>
              </svg>
              <input id="termDetailMountSearch" type="search" placeholder="搜索资产名称或归属路径" aria-label="搜索挂载资产" value="${escapeHtml(detailMountKeyword)}" />
            </label>
            <div class="td-type-chips">${chips}</div>
          </div>
          <div class="td-mount-list" id="termDetailMountList"></div>
        `;
        detailMountsRenderedKey = term.id;
      }
      detailMountsPanelEl.querySelectorAll("[data-detail-mount-type]").forEach((chip) => {
        chip.classList.toggle("active", (chip.dataset.detailMountType || "") === detailMountType);
      });
      const mountSearchEl = document.getElementById("termDetailMountSearch");
      if (mountSearchEl && mountSearchEl.value !== detailMountKeyword) mountSearchEl.value = detailMountKeyword;
      renderDetailMountList(term);
    }

    function renderDetailMountList(term) {
      const listEl = document.getElementById("termDetailMountList");
      if (!listEl) return;
      const keyword = detailMountKeyword.trim().toLowerCase();
      const items = collectDetailMountItems(term).filter((item) => {
        if (detailMountType && item.type !== detailMountType) return false;
        if (!keyword) return true;
        return `${item.name} ${item.path} ${item.meta}`.toLowerCase().includes(keyword);
      });
      if (!items.length) {
        listEl.innerHTML = `<div class="td-empty">${keyword || detailMountType ? "没有匹配的资产，试试调整关键字或类型筛选" : "该术语暂未挂载任何资产"}</div>`;
        return;
      }
      listEl.innerHTML = items
        .map((item, index) => {
          const pathHtml = item.path
            ? item.path
                .split(/\s*[>›]\s*|\s*[、,，]\s*/)
                .filter(Boolean)
                .map((part) => escapeHtml(part))
                .join('<span class="td-sep">›</span>')
            : "";
          let nameHtml = escapeHtml(item.name);
          if (item.openTarget?.kind === "metric") {
            nameHtml = `<a href="#" data-open-metric="${escapeHtml(item.openTarget.value)}">${nameHtml}</a>`;
          } else if (item.openTarget?.kind === "field") {
            nameHtml = `<a href="#" data-open-field="${escapeHtml(item.openTarget.value)}">${nameHtml}</a>`;
          }
          const sourceTag =
            item.source === "owner"
              ? '<span class="td-type-tag is-owner">归属数据域</span>'
              : item.source === "auto"
                ? '<span class="td-type-tag is-auto">自动关联</span>'
                : '<span class="td-type-tag">手动挂载</span>';
          return `
            <div class="td-mount-item" data-mount-index="${index}">
              <input class="td-mount-check" type="checkbox" aria-label="选择资产" />
              <div class="td-mount-main">
                <div class="td-mount-path">
                  <span class="td-type-tag">${escapeHtml(mountTypeIcon(item.type))} ${escapeHtml(mountTypeLabel(item.type))}</span>
                  ${pathHtml}
                </div>
                <div class="td-mount-name">${nameHtml}</div>
                <div class="td-mount-meta">
                  ${sourceTag}
                  ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
                </div>
              </div>
            </div>`;
        })
        .join("");
    }

    function renderDetailLineage(term) {
      if (!detailLineagePanelEl) return;
      /* 同一术语且数据未变更时复用已渲染的图谱，避免每次切 tab 都重建 SVG */
      const renderKey = `${term.id}@${detailCacheVersion}`;
      if (detailLineageRenderedKey === renderKey) return;
      const items = collectDetailMountItems(term);
      const countOf = (type) => items.filter((item) => item.type === type).length;
      detailLineagePanelEl.innerHTML = `
        <div class="td-graph-bar">
          <div>术语 1 · 字段 ${countOf("field")} · 指标 ${countOf("metric")} · 模型 ${countOf("model")} · 数据域 ${countOf("domain")}</div>
          <div class="td-graph-legend">
            <span><i style="background:#2563eb"></i>术语</span>
            <span><i style="background:#60a5fa"></i>字段</span>
            <span><i style="background:#3b82f6"></i>指标</span>
            <span><i style="background:#1d4ed8"></i>模型</span>
            <span><i style="background:#93c5fd"></i>数据域</span>
          </div>
        </div>
        <div class="td-graph-wrap" id="termDetailGraphWrap">
          <svg id="termDetailGraphSvg" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="td-graph-tip">以该术语为中心，展示其挂载的字段、指标、模型与所属数据域；点击节点可查看关联资产。</div>
        </div>
      `;
      detailLineageRenderedKey = renderKey;
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(() => {
          /* 期间若已切走或数据已变更，则放弃这次绘制，交给下一次渲染 */
          if (detailLineageRenderedKey === renderKey && detailTab === "lineage") renderDetailGraph(term);
        });
      } else {
        renderDetailGraph(term);
      }
    }

    function renderDetailGraph(term) {
      const svgEl = document.getElementById("termDetailGraphSvg");
      const wrapEl = document.getElementById("termDetailGraphWrap");
      if (!svgEl || !wrapEl || !term) return;
      const LM = global.LineageModule;
      if (!LM?.createGraphBuilder || !LM?.computeLayout || !LM?.renderGraphSvg) {
        svgEl.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#98a2b3" font-size="13">图谱组件未加载</text>';
        return;
      }
      const graph = LM.createGraphBuilder().buildFromTerm(term.id, 2, false);
      graph.maxDepth = 2;
      const width = Math.max(320, wrapEl.clientWidth || 900);
      const height = Math.max(300, wrapEl.clientHeight || 420);
      const positions = LM.computeLayout(graph, width, height);
      LM.renderGraphSvg(svgEl, graph, positions, graph.rootId, null);
    }

    /* ===== 添加资产（术语挂载）弹窗 =====
       支持把 数据域/模型/维度/指标/字段 五类资产挂到术语上，
       挂载结果存于 term.mounts: [{ key, type, name, path, meta }] */
    const MOUNT_ASSET_TYPES = [
      { type: "domain", label: "数据域", icon: "🗂" },
      { type: "model", label: "模型", icon: "🧩" },
      { type: "dimension", label: "维度", icon: "📐" },
      { type: "metric", label: "指标", icon: "📊" },
      { type: "field", label: "字段", icon: "🔤" },
    ];
    const MOUNT_MEASURE_NAME_RE = /(金额|额|率|数量|数|比|差)$/;
    let mountOverlayEl = null;
    let mountListEl = null;
    let mountSearchEl = null;
    let mountTotalEl = null;
    let mountTypeTriggerEl = null;
    let mountTypeDropdownEl = null;
    let mountTypeCountEl = null;
    let mountTermId = "";
    let mountSelected = new Set();
    let mountTypeFilter = new Set();
    let mountDraftTerms = [];

    function mountTypeLabel(type) {
      return MOUNT_ASSET_TYPES.find((t) => t.type === type)?.label || type;
    }

    function mountTypeIcon(type) {
      return MOUNT_ASSET_TYPES.find((t) => t.type === type)?.icon || "•";
    }

    function collectMountAssets() {
      const models = global.MetricModule?.listBusinessModels?.() || [];
      const metrics = global.MetricModule?.readMetrics?.() || [];
      const domainLabels = global.collectUniqueDomainLabels?.() || ["收入管理", "成本管理", "经营管理", "合同管理", "工程技术"];
      const assets = domainLabels.map((name) => ({
        key: `domain:${name}`,
        type: "domain",
        name,
        path: "数据域",
      }));
      const dimensionOwners = new Map();
      models.forEach((model) => {
        assets.push({
          key: `model:${model.name}`,
          type: "model",
          name: model.name,
          path: model.domain || "未分组",
          meta: model.type || "",
        });
        (model.fieldNames || []).forEach((fieldName) => {
          assets.push({
            key: `field:${model.name}|${fieldName}`,
            type: "field",
            name: fieldName,
            path: model.name,
          });
          if (!MOUNT_MEASURE_NAME_RE.test(fieldName)) {
            if (!dimensionOwners.has(fieldName)) dimensionOwners.set(fieldName, new Set());
            dimensionOwners.get(fieldName).add(model.name);
          }
        });
      });
      dimensionOwners.forEach((owners, name) => {
        assets.push({
          key: `dimension:${name}`,
          type: "dimension",
          name,
          path: [...owners].join("、"),
        });
      });
      metrics.forEach((metric) => {
        assets.push({
          key: `metric:${metric.id || metric.name}`,
          type: "metric",
          name: metric.name,
          path: metric.domain || metric.domainModels?.[0]?.name || "指标",
          meta: metric.code || "",
        });
      });
      return assets;
    }

    function ensureMountDialog() {
      if (mountOverlayEl) return;
      const styleEl = document.createElement("style");
      styleEl.id = "assetMountDialogStyle";
      styleEl.textContent = `
        .term-mount-modal { width: min(680px, 94vw); }
        .term-mount-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; }
        .term-mount-search { width: 100%; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 4px; padding: 8px 12px; font: inherit; color: #344054; outline: none; }
        .term-mount-search:focus { border-color: #1e80ff; }
        .term-mount-filterbar { display: flex; align-items: center; gap: 10px; }
        .term-mount-type { position: relative; }
        .term-mount-type-trigger { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d0d5dd; background: #fff; border-radius: 4px; padding: 6px 12px; font: inherit; font-size: 12px; color: #344054; cursor: pointer; }
        .term-mount-type-trigger:hover { border-color: #1e80ff; }
        .term-mount-type-dropdown { position: absolute; top: calc(100% + 4px); left: 0; z-index: 40; width: 240px; background: #fff; border: 1px solid #e4e7ec; border-radius: 6px; box-shadow: 0 8px 24px rgba(16, 24, 40, 0.14); padding: 10px; }
        .term-mount-type-dropdown label { display: flex; align-items: center; gap: 8px; padding: 6px 4px; font-size: 12px; color: #344054; cursor: pointer; border-radius: 4px; }
        .term-mount-type-dropdown label:hover { background: #f8fafc; }
        .term-mount-type-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f2f5; }
        .term-mount-type-foot button { border: 1px solid #d0d5dd; background: #fff; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; color: #344054; }
        .term-mount-type-foot button.is-primary { background: #1e80ff; border-color: #1e80ff; color: #fff; }
        .term-mount-total { margin-left: auto; font-size: 12px; color: #98a2b3; }
        .term-mount-list { flex: 1; min-height: 200px; max-height: 46vh; overflow: auto; border: 1px solid #eef1f5; border-radius: 6px; }
        .term-mount-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #f5f6f8; cursor: pointer; }
        .term-mount-item:last-child { border-bottom: 0; }
        .term-mount-item:hover { background: #f8fafc; }
        .term-mount-item.is-checked { background: #f0f7ff; }
        .term-mount-item input[type="checkbox"] { flex-shrink: 0; }
        .term-mount-ic { width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; background: #f2f4f7; }
        .term-mount-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .term-mount-name { font-weight: 600; color: #1f2d3d; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .term-mount-name .term-mount-badge { font-style: normal; margin-left: 6px; font-size: 11px; color: #98a2b3; font-weight: 400; }
        .term-mount-path { font-size: 11px; color: #98a2b3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .term-mount-tag { margin-left: auto; flex-shrink: 0; font-size: 11px; color: #667085; background: #f2f4f7; border-radius: 10px; padding: 2px 8px; }
        .term-mount-empty { padding: 36px 0; text-align: center; color: #98a2b3; font-size: 12px; }
        .term-mount-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid #eef1f5; flex-shrink: 0; }
        .term-mount-foot button { border: 1px solid #d0d5dd; background: #fff; border-radius: 4px; padding: 7px 18px; font: inherit; font-size: 13px; color: #344054; cursor: pointer; }
        .term-mount-foot button.is-primary { background: #1e80ff; border-color: #1e80ff; color: #fff; }
        .term-mount-foot button.is-primary:hover { background: #1570e6; }
      `;
      document.head.appendChild(styleEl);
      mountOverlayEl = document.createElement("div");
      mountOverlayEl.className = "term-form-overlay";
      mountOverlayEl.id = "assetMountOverlay";
      mountOverlayEl.hidden = true;
      mountOverlayEl.innerHTML = `
        <div class="term-form-modal term-mount-modal" role="dialog" aria-modal="true" aria-label="添加资产">
          <div class="term-form-head">
            <h3>添加资产</h3>
            <button class="term-form-close" type="button" data-mount-close aria-label="关闭">×</button>
          </div>
          <div class="term-form-body term-mount-body">
            <input class="term-mount-search" id="assetMountSearch" type="search" placeholder="搜索资产" autocomplete="off" />
            <div class="term-mount-filterbar">
              <div class="term-mount-type" id="assetMountTypePicker">
                <button class="term-mount-type-trigger" id="assetMountTypeTrigger" type="button">实体类型 <b id="assetMountTypeCount"></b><span>▾</span></button>
                <div class="term-mount-type-dropdown" id="assetMountTypeDropdown" hidden>
                  ${MOUNT_ASSET_TYPES.map(
                    (t) => `
                    <label><input type="checkbox" data-mount-type="${t.type}" /> ${t.label}</label>
                  `
                  ).join("")}
                  <div class="term-mount-type-foot">
                    <button type="button" data-mount-type-reset>重置</button>
                    <button type="button" class="is-primary" data-mount-type-close>关闭</button>
                  </div>
                </div>
              </div>
              <span class="term-mount-total" id="assetMountTotal"></span>
            </div>
            <div class="term-mount-list" id="assetMountList"></div>
          </div>
          <div class="term-mount-foot">
            <button type="button" data-mount-close>取消</button>
            <button type="button" class="is-primary" id="assetMountSave">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(mountOverlayEl);
      mountListEl = mountOverlayEl.querySelector("#assetMountList");
      mountSearchEl = mountOverlayEl.querySelector("#assetMountSearch");
      mountTotalEl = mountOverlayEl.querySelector("#assetMountTotal");
      mountTypeTriggerEl = mountOverlayEl.querySelector("#assetMountTypeTrigger");
      mountTypeDropdownEl = mountOverlayEl.querySelector("#assetMountTypeDropdown");
      mountTypeCountEl = mountOverlayEl.querySelector("#assetMountTypeCount");

      mountOverlayEl.addEventListener("click", (event) => {
        if (event.target === mountOverlayEl || event.target.closest("[data-mount-close]")) closeMountDialog();
      });
      mountSearchEl.addEventListener("input", renderMountList);
      mountTypeTriggerEl.addEventListener("click", () => {
        mountTypeDropdownEl.hidden = !mountTypeDropdownEl.hidden;
      });
      mountTypeDropdownEl.addEventListener("change", (event) => {
        const input = event.target.closest("input[data-mount-type]");
        if (!input) return;
        if (input.checked) mountTypeFilter.add(input.dataset.mountType);
        else mountTypeFilter.delete(input.dataset.mountType);
        syncMountTypeTrigger();
        renderMountList();
      });
      mountTypeDropdownEl.addEventListener("click", (event) => {
        if (event.target.closest("[data-mount-type-close]")) mountTypeDropdownEl.hidden = true;
        if (event.target.closest("[data-mount-type-reset]")) {
          mountTypeFilter.clear();
          mountTypeDropdownEl.querySelectorAll("input[data-mount-type]").forEach((input) => (input.checked = false));
          syncMountTypeTrigger();
          renderMountList();
        }
      });
      mountListEl.addEventListener("change", (event) => {
        const input = event.target.closest('input[data-mount-asset]');
        if (!input) return;
        if (input.checked) mountSelected.add(input.value);
        else mountSelected.delete(input.value);
        input.closest(".term-mount-item")?.classList.toggle("is-checked", input.checked);
        syncMountTotal();
      });
      mountOverlayEl.querySelector("#assetMountSave").addEventListener("click", saveMountDialog);
      document.addEventListener("click", (event) => {
        if (!mountTypeDropdownEl || mountTypeDropdownEl.hidden) return;
        if (!event.target.closest("#assetMountTypePicker")) mountTypeDropdownEl.hidden = true;
      });
    }

    function syncMountTypeTrigger() {
      const n = mountTypeFilter.size;
      mountTypeCountEl.textContent = n ? `(${n})` : "";
    }

    function syncMountTotal() {
      const list = collectMountAssets();
      mountTotalEl.textContent = `已选 ${mountSelected.size} / 共 ${list.length} 项`;
    }

    function renderMountList() {
      if (!mountListEl) return;
      const keyword = (mountSearchEl?.value || "").trim().toLowerCase();
      const assets = collectMountAssets()
        .filter((asset) => !mountTypeFilter.size || mountTypeFilter.has(asset.type))
        .filter((asset) => !keyword || asset.name.toLowerCase().includes(keyword) || String(asset.path || "").toLowerCase().includes(keyword));
      if (!assets.length) {
        mountListEl.innerHTML = `<div class="term-mount-empty">没有匹配的资产</div>`;
        syncMountTotal();
        return;
      }
      mountListEl.innerHTML = MOUNT_ASSET_TYPES.map((typeDef) => {
        const group = assets.filter((asset) => asset.type === typeDef.type);
        if (!group.length) return "";
        return group
          .map(
            (asset) => `
            <label class="term-mount-item ${mountSelected.has(asset.key) ? "is-checked" : ""}">
              <input type="checkbox" data-mount-asset value="${escapeHtml(asset.key)}" ${mountSelected.has(asset.key) ? "checked" : ""} />
              <span class="term-mount-ic">${typeDef.icon}</span>
              <span class="term-mount-info">
                <span class="term-mount-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}${asset.meta ? `<i class="term-mount-badge">${escapeHtml(asset.meta)}</i>` : ""}</span>
                <span class="term-mount-path" title="${escapeHtml(asset.path || "")}">${escapeHtml(asset.path || "")}</span>
              </span>
              <span class="term-mount-tag">${typeDef.label}</span>
            </label>
          `
          )
          .join("");
      }).join("");
      syncMountTotal();
    }

    function openMountDialog(termId) {
      const term = terms.find((row) => row.id === termId);
      if (!term) return;
      ensureMountDialog();
      mountTermId = termId;
      mountSelected = new Set((term.mounts || []).map((m) => m.key));
      mountTypeFilter.clear();
      mountTypeDropdownEl.querySelectorAll("input[data-mount-type]").forEach((input) => (input.checked = false));
      syncMountTypeTrigger();
      if (mountSearchEl) mountSearchEl.value = "";
      mountTypeDropdownEl.hidden = true;
      renderMountList();
      mountOverlayEl.hidden = false;
      mountSearchEl?.focus();
    }

    function closeMountDialog() {
      if (mountOverlayEl) mountOverlayEl.hidden = true;
      if (mountTypeDropdownEl) mountTypeDropdownEl.hidden = true;
      mountTermId = "";
      mountSelected = new Set();
    }

    function saveMountDialog() {
      const term = terms.find((row) => row.id === mountTermId);
      if (!term) {
        closeMountDialog();
        return;
      }
      const assets = collectMountAssets();
      const assetMap = new Map(assets.map((asset) => [asset.key, asset]));
      const previous = new Map((term.mounts || []).map((m) => [m.key, m]));
      term.mounts = [...mountSelected].map((key) => {
        const kept = previous.get(key);
        if (kept) return kept;
        const asset = assetMap.get(key);
        return {
          key,
          type: asset?.type || key.split(":")[0],
          name: asset?.name || key.split(":").slice(1).join(":"),
          path: asset?.path || "",
          meta: asset?.meta || "",
        };
      });
      writeTerms(terms);
      render();
      closeMountDialog();
      setTip(`已为术语「${term.name}」挂载 ${term.mounts.length} 个资产`);
    }

    /* ===== 问数就绪增强：术语类型 / 值域绑定 / 值层级 / 同义词冲突 / 版本快照 =====
       对齐 DeepSeek 评审建议的 6 个缺口，全部在本模块内实现，index 零改动 */
    const TERM_TYPE_OPTIONS = [
      { value: "entity", label: "实体", desc: "业务对象，问数时作为 JOIN 依据", color: "#2f6bff" },
      { value: "dimension", label: "维度", desc: "分组轴，问数时进入 GROUP BY", color: "#00a68a" },
      { value: "metric", label: "指标", desc: "度量口径，问数时进入 SELECT 聚合", color: "#f59a23" },
      { value: "filter", label: "过滤", desc: "值域条件，问数时进入 WHERE", color: "#7b61ff" },
    ];
    const TERM_VOCAB_GAPS_KEY = "biz-term-vocab-gaps-v1";
    let formEnhInjected = false;
    let formValueBindings = [];

    function termTypeMeta(value) {
      return TERM_TYPE_OPTIONS.find((t) => t.value === value) || TERM_TYPE_OPTIONS[0];
    }

    function readVocabGaps() {
      try {
        return JSON.parse(localStorage.getItem(TERM_VOCAB_GAPS_KEY) || "[]");
      } catch (_e) {
        return [];
      }
    }

    function writeVocabGaps(list) {
      try {
        localStorage.setItem(TERM_VOCAB_GAPS_KEY, JSON.stringify(list.slice(-50)));
      } catch (_e) {
        /* ignore */
      }
    }

    function allModelFieldNames() {
      const map = new Map();
      (global.MetricModule?.listBusinessModels?.() || []).forEach((model) => {
        (model.fieldNames || []).forEach((fieldName) => {
          if (!map.has(fieldName)) map.set(fieldName, new Set());
          map.get(fieldName).add(model.name);
        });
      });
      return map;
    }

    function ensureFormEnhance() {
      if (formEnhInjected) return;
      const descField = document.getElementById("termFormDescription")?.closest(".term-form-field");
      if (!descField) return;
      formEnhInjected = true;
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        .term-type-badge { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 9px; font-size: 11px; font-style: normal; font-weight: 400; color: #fff; vertical-align: middle; }
        .term-conflict-flag { margin-left: 5px; font-size: 12px; cursor: help; }
        .term-vb-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .term-vb-row select, .term-vb-row input { flex: 1; min-width: 0; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 4px; padding: 6px 8px; font: inherit; font-size: 12px; color: #344054; }
        .term-vb-row .term-vb-op { flex: 0 0 72px; }
        .term-vb-remove { flex: 0 0 auto; border: 0; background: transparent; color: #98a2b3; font-size: 15px; cursor: pointer; }
        .term-vb-add { border: 1px dashed #c9cdd4; background: #fff; border-radius: 4px; padding: 5px 12px; font-size: 12px; color: #475467; cursor: pointer; }
        .term-vb-add:hover { border-color: #1e80ff; color: #1e80ff; }
        .term-enh-hint { margin-top: 4px; font-size: 11px; color: #98a2b3; }
        .term-sim-overlay { z-index: calc(var(--overlay-z-index) + 2); }
        .term-sim-modal { width: min(720px, 94vw); }
        .term-sim-body { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .term-sim-question { width: 100%; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 4px; padding: 9px 12px; font: inherit; color: #344054; resize: vertical; min-height: 58px; }
        .term-sim-run { align-self: flex-start; border: 0; border-radius: 4px; background: #1e80ff; color: #fff; padding: 8px 20px; font: inherit; font-size: 13px; cursor: pointer; }
        .term-sim-steps { display: flex; flex-direction: column; gap: 8px; }
        .term-sim-step { display: flex; gap: 10px; padding: 10px 12px; border: 1px solid #eef1f5; border-radius: 6px; font-size: 12.5px; color: #344054; line-height: 1.6; }
        .term-sim-step .no { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 50%; background: #1e80ff; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
        .term-sim-step.is-gap { border-style: dashed; border-color: #f59a23; background: #fffaf3; }
        .term-sim-step.is-gap .no { background: #f59a23; }
        .term-sim-step b { color: #1f2d3d; }
        .term-sim-sql { background: #0f1728; color: #d6e2ff; font-family: Consolas, monospace; font-size: 12px; padding: 12px 14px; border-radius: 6px; white-space: pre-wrap; word-break: break-all; }
        .term-sim-sql .kw { color: #7cc4ff; }
        .term-sim-gapbar { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #b25e00; background: #fff7e8; border: 1px solid #ffd591; border-radius: 4px; padding: 7px 10px; }
        .term-sim-hist li { margin: 4px 0; }
        .term-sim-hist .meta { color: #98a2b3; font-size: 11px; margin-left: 6px; }
        .term-save-confirm { display: flex; align-items: flex-start; gap: 10px; border: 1px solid #ffd591; background: #fff7e8; border-radius: 4px; padding: 10px 12px; font-size: 12px; color: #874d00; line-height: 1.6; }
        .term-save-confirm[hidden] { display: none; }
        .term-save-confirm-text { flex: 1; min-width: 0; white-space: pre-wrap; }
        .term-save-confirm-actions { flex-shrink: 0; display: flex; gap: 8px; }
        .term-save-confirm-actions button { border: 1px solid #d0d5dd; background: #fff; border-radius: 4px; padding: 4px 14px; font: inherit; font-size: 12px; color: #344054; cursor: pointer; }
        .term-save-confirm-actions button.is-primary { background: #f59a23; border-color: #f59a23; color: #fff; }
      `;
      document.head.appendChild(styleEl);
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="term-form-field">
          <label for="termFormType">术语类型<span class="required">*</span></label>
          <select id="termFormType">
            ${TERM_TYPE_OPTIONS.map((t) => `<option value="${t.value}" title="${t.desc}">${t.label} — ${t.desc}</option>`).join("")}
          </select>
        </div>
        <div class="term-form-field">
          <label for="termFormParentTerm">上级术语（值层级）</label>
          <select id="termFormParentTerm"><option value="">无 — 顶层术语</option></select>
          <div class="term-enh-hint">建立「上海 ⊂ 华东」这类层级后，问数可沿层级上卷或展开</div>
        </div>
        <div class="term-form-field">
          <label>值域绑定（过滤/维度术语建议填写，问数时生成 WHERE / GROUP BY 条件）</label>
          <div id="termValueBindingRows"></div>
          <button type="button" id="termValueBindingAdd" class="term-vb-add">＋ 添加值域规则</button>
        </div>
        <div class="term-save-confirm" id="termSaveConfirm" hidden>
          <span class="term-save-confirm-text" id="termSaveConfirmText"></span>
          <span class="term-save-confirm-actions">
            <button type="button" id="termSaveConfirmCancel">取消</button>
            <button type="button" class="is-primary" id="termSaveConfirmBtn">仍要保存</button>
          </span>
        </div>
      `;
      descField.after(...Array.from(wrap.children));
      document.getElementById("termValueBindingAdd").addEventListener("click", () => {
        formValueBindings.push({ field: "", op: "=", value: "" });
        renderValueBindingRows();
      });
      /* 页面内确认条：替代原生 confirm（内嵌 webview 中原生对话框会冻结/不可见） */
      document.getElementById("termSaveConfirmBtn").addEventListener("click", () => {
        hideSaveConfirm();
        saveForm(true);
      });
      document.getElementById("termSaveConfirmCancel").addEventListener("click", hideSaveConfirm);
    }

    function renderValueBindingRows() {
      const rowsEl = document.getElementById("termValueBindingRows");
      if (!rowsEl) return;
      const fieldMap = allModelFieldNames();
      rowsEl.innerHTML = formValueBindings.length
        ? formValueBindings
            .map(
              (row, index) => `
              <div class="term-vb-row" data-vb-index="${index}">
                <select data-vb-role="field">
                  <option value="">选择字段</option>
                  ${[...fieldMap.entries()]
                    .map(
                      ([fieldName, owners]) =>
                        `<option value="${escapeHtml(fieldName)}" ${row.field === fieldName ? "selected" : ""} title="来源：${escapeHtml([...owners].join("、"))}">${escapeHtml(fieldName)}</option>`
                    )
                    .join("")}
                </select>
                <select data-vb-role="op" class="term-vb-op">
                  ${["=", "IN", "LIKE", ">", "<", ">=", "<="]
                    .map((op) => `<option value="${op}" ${row.op === op ? "selected" : ""}>${op}</option>`)
                    .join("")}
                </select>
                <input data-vb-role="value" type="text" placeholder="值，如 '01','02'" value="${escapeHtml(row.value)}" />
                <button type="button" class="term-vb-remove" data-vb-remove="${index}" aria-label="删除">×</button>
              </div>
            `
            )
            .join("")
        : '<div class="term-enh-hint">尚未配置。示例：字段 region_id，条件 IN，值 \'01\',\'02\'（华东区）</div>';
    }

    function bindValueBindingRows() {
      const rowsEl = document.getElementById("termValueBindingRows");
      if (!rowsEl || rowsEl.dataset.bound) return;
      rowsEl.dataset.bound = "1";
      rowsEl.addEventListener("input", (event) => {
        const rowEl = event.target.closest(".term-vb-row");
        if (!rowEl) return;
        const index = Number(rowEl.dataset.vbIndex);
        if (!formValueBindings[index]) return;
        if (event.target.dataset.vbRole === "value") formValueBindings[index].value = event.target.value;
      });
      rowsEl.addEventListener("change", (event) => {
        const rowEl = event.target.closest(".term-vb-row");
        if (!rowEl) return;
        const index = Number(rowEl.dataset.vbIndex);
        if (!formValueBindings[index]) return;
        if (event.target.dataset.vbRole === "field") formValueBindings[index].field = event.target.value;
        if (event.target.dataset.vbRole === "op") formValueBindings[index].op = event.target.value;
      });
      rowsEl.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-vb-remove]");
        if (!btn) return;
        formValueBindings.splice(Number(btn.dataset.vbRemove), 1);
        renderValueBindingRows();
      });
    }

    function syncParentTermOptions(selectedId) {
      const parentEl = document.getElementById("termFormParentTerm");
      if (!parentEl) return;
      parentEl.innerHTML =
        '<option value="">无 — 顶层术语</option>' +
        terms
          .filter((item) => item.id !== editingId)
          .map(
            (item) =>
              `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}（${termTypeMeta(item.termType).label}）</option>`
          )
          .join("");
    }

    /* 同义词冲突检测：本术语的同义词/名称与其他术语的名称/同义词相撞（跨域冲突最危险） */
    function findSynonymConflicts(nameText, synonymsText, editingIdLocal, domainList) {
      const ownWords = new Set(
        [nameText, ...(synonymsText || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter((s) => s.length >= 2)
      );
      const conflicts = [];
      terms.forEach((other) => {
        if (other.id === editingIdLocal) return;
        const otherWords = [other.name, ...(other.synonyms || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter(Boolean);
        otherWords.forEach((word) => {
          if (word.length >= 2 && ownWords.has(word)) {
            const crossDomain = !(other.domain || "").split(/[、,，]/).some((d) => domainsOverlap(d, domainList));
            conflicts.push({ word, term: other, crossDomain });
          }
        });
      });
      return conflicts;
    }

    function domainsOverlap(domainA, domainList) {
      return (domainList || []).some((d) => d && (domainA || "").includes(d));
    }

    function collectSynonymConflictKeys() {
      const keys = new Set();
      terms.forEach((term) => {
        const own = [term.name, ...(term.synonyms || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter((s) => s.length >= 2);
        terms.forEach((other) => {
          if (other.id === term.id) return;
          const otherWords = [other.name, ...(other.synonyms || "").split(/[,，、;；\s]+/)].map((s) => s.trim());
          if (own.some((word) => otherWords.includes(word))) keys.add(term.id);
        });
      });
      return keys;
    }

    function termImpactSummary(term) {
      const refs = countTermReferences(term.id);
      const mountCount = (term.mounts || []).length;
      const total = refs.metricCount + refs.fieldCount + mountCount;
      return { ...refs, mountCount, total };
    }

    /* ===== 问数模拟器：命中解释 + SQL 片段 + 词汇缺口 ===== */
    let simOverlayEl = null;

    function ensureSimDialog() {
      if (simOverlayEl) return;
      simOverlayEl = document.createElement("div");
      simOverlayEl.className = "term-form-overlay term-sim-overlay";
      simOverlayEl.id = "termAskSimOverlay";
      simOverlayEl.hidden = true;
      simOverlayEl.innerHTML = `
        <div class="term-form-modal term-sim-modal" role="dialog" aria-modal="true" aria-label="问数模拟">
          <div class="term-form-head">
            <h3>问数模拟 · 术语命中解释</h3>
            <button class="term-form-close" type="button" data-sim-close aria-label="关闭">×</button>
          </div>
          <div class="term-sim-body">
            <textarea class="term-sim-question" id="termSimQuestion" placeholder="输入一句自然语言问句，如：华东区今年的合同总销售额">华东区今年的合同总销售额</textarea>
            <button type="button" class="term-sim-run" id="termSimRun">模拟解析</button>
            <div class="term-sim-steps" id="termSimSteps"></div>
            <div class="term-sim-sql" id="termSimSql" hidden></div>
            <div id="termSimGaps"></div>
          </div>
          <div class="term-mount-foot">
            <button type="button" data-sim-close>关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(simOverlayEl);
      simOverlayEl.addEventListener("click", (event) => {
        if (event.target === simOverlayEl || event.target.closest("[data-sim-close]")) simOverlayEl.hidden = true;
      });
      simOverlayEl.querySelector("#termSimRun").addEventListener("click", runAskSimulation);
      /* 工具栏注入入口按钮 */
      const syncBtn = document.getElementById("syncToQueryBtn");
      if (syncBtn && !document.getElementById("termSimEntryBtn")) {
        const entry = document.createElement("button");
        entry.className = "btn-sync-query";
        entry.id = "termSimEntryBtn";
        entry.type = "button";
        entry.title = "用一句自然语言模拟问数解析，查看术语命中与 SQL 片段";
        syncBtn.before(entry);
        entry.addEventListener("click", openAskSimulation);
      }
    }

    function syncSimEntryLabel() {
      const entry = document.getElementById("termSimEntryBtn");
      if (!entry) return;
      const gaps = readVocabGaps();
      entry.textContent = gaps.length ? `问数模拟（缺口 ${gaps.length}）` : "问数模拟";
    }

    function openAskSimulation() {
      if (!simOverlayEl) ensureSimDialog();
      simOverlayEl.hidden = false;
      syncSimEntryLabel();
    }

    function matchTermsInQuestion(question) {
      const hits = [];
      const consumed = [];
      const sorted = [...terms].sort((a, b) => b.name.length - a.name.length);
      let rest = question;
      sorted.forEach((term) => {
        const words = [term.name, ...(term.synonyms || "").split(/[,，、;；\s]+/)]
          .map((s) => s.trim())
          .filter((s) => s.length >= 2)
          .sort((a, b) => b.length - a.length);
        for (const word of words) {
          if (rest.includes(word)) {
            hits.push({ term, word });
            rest = rest.split(word).join("　");
            consumed.push(word);
            break;
          }
        }
      });
      const leftovers = rest
        .split(/[，。！？、\s　]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);
      return { hits, leftovers };
    }

    function extractTimeCondition(question) {
      const year = question.match(/(20\d{2})年/);
      if (year) return `YEAR(<时间字段>) = ${year[1]}`;
      if (question.includes("今年")) return `YEAR(<时间字段>) = ${new Date().getFullYear()}`;
      if (question.includes("去年")) return `YEAR(<时间字段>) = ${new Date().getFullYear() - 1}`;
      if (question.includes("上个月")) return "MONTH(<时间字段>) = 上月";
      if (question.includes("本月")) return "MONTH(<时间字段>) = 本月";
      return "";
    }

    function runAskSimulation() {
      const stepsEl = simOverlayEl.querySelector("#termSimSteps");
      const sqlEl = simOverlayEl.querySelector("#termSimSql");
      const gapsEl = simOverlayEl.querySelector("#termSimGaps");
      const question = (simOverlayEl.querySelector("#termSimQuestion").value || "").trim();
      if (!question) {
        stepsEl.innerHTML = '<div class="term-sim-step"><span class="no">!</span><span>请输入问句</span></div>';
        sqlEl.hidden = true;
        gapsEl.innerHTML = "";
        return;
      }
      const { hits, leftovers } = matchTermsInQuestion(question);
      const steps = [];
      steps.push(
        `<div class="term-sim-step"><span class="no">1</span><span><b>NLU 切词</b>：问句分词完成，共命中 <b>${hits.length}</b> 个术语${hits.length ? "：" + hits.map((h) => `「${escapeHtml(h.word)}」→${escapeHtml(h.term.name)}`).join("、") : ""}</span></div>`
      );
      if (hits.length) {
        steps.push(
          `<div class="term-sim-step"><span class="no">2</span><span><b>多态路由</b>：${hits
            .map((h) => {
              const meta = termTypeMeta(h.term.termType);
              const roleMap = { metric: "SELECT 聚合", dimension: "GROUP BY 分组", filter: "WHERE 过滤", entity: "JOIN 关联" };
              return `「${escapeHtml(h.term.name)}」是 <b style="color:${meta.color}">${meta.label}</b> → 进入 ${roleMap[meta.value]}`;
            })
            .join("；")}</span></div>`
        );
        const bindings = hits.flatMap((h) => (h.term.valueBindings || []).map((b) => ({ ...b, termName: h.term.name })));
        steps.push(
          `<div class="term-sim-step"><span class="no">3</span><span><b>值域绑定</b>：${
            bindings.length
              ? bindings.map((b) => `「${escapeHtml(b.termName)}」→ <b>${escapeHtml(b.field)} ${escapeHtml(b.op)} ${escapeHtml(b.value)}</b>`).join("；")
              : "命中的术语均未配置值域绑定，条件列将以占位符输出（可在术语表单补配置）"
          }</span></div>`
        );
        const modelNames = [...new Set(hits.flatMap((h) => h.term.modelNames || []).filter(Boolean))];
        steps.push(
          `<div class="term-sim-step"><span class="no">4</span><span><b>语义模型路由</b>：${modelNames.length ? `命中术语声明生效于「${escapeHtml(modelNames.join("、"))}」，Schema 裁剪至该模型` : "术语未限定生效模型，将在当前数据域下模糊路由（建议在表单中选择生效模型）"}</span></div>`
        );
      } else {
        steps.push(
          `<div class="term-sim-step is-gap"><span class="no">2</span><span><b>术语池未命中</b>：当前术语库没有任何词能解释这句话。以下片段已收进「词汇缺口」，可据此补建术语。</span></div>`
        );
      }
      const timeCond = extractTimeCondition(question);
      if (timeCond) {
        steps.push(`<div class="term-sim-step"><span class="no">5</span><span><b>时间条件</b>：「${escapeHtml(question.match(/今年|去年|上个月|本月|20\d{2}年/)?.[0] || "")}」→ ${escapeHtml(timeCond)}</span></div>`);
      }
      stepsEl.innerHTML = steps.join("");
      /* SQL 拼装（演示级） */
      const metricHit = hits.find((h) => h.term.termType === "metric");
      const filterHits = hits.filter((h) => ["filter", "dimension"].includes(h.term.termType) && (h.term.valueBindings || []).length);
      const dimensionHit = hits.find((h) => h.term.termType === "dimension");
      const wheres = [];
      filterHits.forEach((h) => (h.term.valueBindings || []).forEach((b) => wheres.push(`t.${b.field} ${b.op} ${b.value}`)));
      if (timeCond) wheres.push(timeCond.replace("<时间字段>", "stat_month"));
      const metricField = metricHit?.term.valueBindings?.[0]?.field || "<度量字段>";
      const modelName = metricHit?.term.modelNames?.[0] || "<生效模型>";
      sqlEl.hidden = false;
      sqlEl.innerHTML =
        `<span class="kw">SELECT</span> SUM(t.${escapeHtml(metricField)}) AS total\n` +
        `<span class="kw">FROM</span> ${escapeHtml(modelName)} t\n` +
        (dimensionHit ? `<span class="kw">GROUP BY</span> t.${escapeHtml(dimensionHit.term.valueBindings?.[0]?.field || dimensionHit.term.name)}\n` : "") +
        (wheres.length ? `<span class="kw">WHERE</span> ${escapeHtml(wheres.join("\n  AND "))}` : `<span class="kw">WHERE</span> <span style="color:#8899bb;">-- 无过滤条件</span>`);
      /* 词汇缺口 */
      const gaps = leftovers.filter((frag) => !hits.some((h) => frag.includes(h.word)));
      if (gaps.length) {
        const stored = readVocabGaps();
        const known = new Set(stored.map((g) => g.text));
        gaps.forEach((frag) => {
          if (!known.has(frag)) stored.push({ text: frag, time: formatDate(), question });
        });
        writeVocabGaps(stored);
        syncSimEntryLabel();
        gapsEl.innerHTML = `<div class="term-sim-gapbar">⚠ 词汇缺口 ${gaps.length} 条：${gaps.map((g) => `「${escapeHtml(g)}」`).join(" ")}（已收进缺口清单，点击顶部「问数模拟（缺口 n）」可追溯）</div>`;
      } else {
        gapsEl.innerHTML = "";
      }
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
      if (action === "mount") openMountDialog(id);
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
    formSaveBtnEl?.addEventListener("click", () => saveForm(false));
    formCancelBtnEl?.addEventListener("click", closeForm);
    formCloseBtnEl?.addEventListener("click", closeForm);
    formOverlayEl?.addEventListener("click", (event) => {
      if (event.target === formOverlayEl) closeForm();
    });
    /* ===== 术语详情二级页面：交互 ===== */
    legacyCloseBtnEl?.addEventListener("click", closeDetailLegacy);
    detailBackBtnEl?.addEventListener("click", closeDetail);
    detailEditBtnEl?.addEventListener("click", () => {
      const term = detailTerm();
      if (term) openForm(term);
    });
    detailMountBtnEl?.addEventListener("click", () => {
      if (detailTermId) openMountDialog(detailTermId);
    });
    detailOnlineBtnEl?.addEventListener("click", () => {
      const term = detailTerm();
      if (!term) return;
      term.online = term.online === false;
      writeTerms(terms);
      renderDetailView();
      setTip(
        term.online !== false
          ? `术语「${term.name}」已上线，可供指标/字段挂载`
          : `术语「${term.name}」已下线，暂不可挂载`
      );
    });
    detailViewEl?.addEventListener("click", (event) => {
      const tabBtn = event.target.closest("[data-term-detail-tab]");
      if (tabBtn) {
        switchDetailTab(tabBtn.dataset.termDetailTab);
        return;
      }
      const typeChip = event.target.closest("[data-detail-mount-type]");
      if (typeChip) {
        detailMountType = typeChip.dataset.detailMountType || "";
        const term = detailTerm();
        if (term) {
          renderDetailMounts(term);
        }
        return;
      }
      const jump = event.target.closest("[data-mount-jump]");
      if (jump) {
        detailMountType = jump.dataset.mountJump || "";
        switchDetailTab("mounts");
        return;
      }
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
    detailViewEl?.addEventListener("input", (event) => {
      if (event.target.id !== "termDetailMountSearch") return;
      detailMountKeyword = event.target.value || "";
      const term = detailTerm();
      if (term) renderDetailMountList(term);
    });
    /* 切换一级/二级页签时收起详情页，避免与列表视图叠加 */
    document.addEventListener(
      "click",
      (event) => {
        if (!detailViewEl || detailViewEl.hidden) return;
        if (!event.target.closest(".list-primary-tab, .list-catalog-tab, .glossary-item")) return;
        detailViewEl.hidden = true;
        detailTermId = "";
        detailTab = "overview";
        const listView = document.getElementById("listView");
        if (listView) listView.hidden = false;
      },
      true
    );
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (importOverlayEl && !importOverlayEl.hidden) closeImportWizard();
      else if (simOverlayEl && !simOverlayEl.hidden) simOverlayEl.hidden = true;
      else if (mountOverlayEl && !mountOverlayEl.hidden) closeMountDialog();
      else if (formOverlayEl && !formOverlayEl.hidden) closeForm();
      else if (detailViewEl && !detailViewEl.hidden) closeDetail();
      else if (legacyDrawerEl && !legacyDrawerEl.hidden) closeDetailLegacy();
    });

    /* 问数演示种子：让「问数模拟」开箱即可演示完整的多态路由链路 */
    const ASK_DEMO_TERMS = [
      {
        name: "华东区",
        termType: "filter",
        synonyms: "华东地区",
        description: "华东大区口径：上海(31)、江苏(32)、浙江(33)、安徽(34)",
        domain: "收入管理",
        domains: ["收入管理"],
        valueBindings: [{ field: "org_code", op: "IN", value: "('31','32','33','34')" }],
        online: true,
      },
      {
        name: "合同总销售额",
        termType: "metric",
        synonyms: "合同销售额",
        description: "合同金额合计，不含税口径",
        domain: "收入管理",
        domains: ["收入管理"],
        valueBindings: [{ field: "contract_amt", op: "SUM", value: "" }],
        online: true,
      },
      {
        name: "统计月份",
        termType: "dimension",
        synonyms: "月份,账期",
        description: "按月分组的时间维度",
        domain: "收入管理",
        domains: ["收入管理"],
        valueBindings: [{ field: "stat_month", op: "=", value: "" }],
        online: true,
      },
    ];

    function ensureAskDemoTerms() {
      let changed = false;
      ASK_DEMO_TERMS.forEach((item) => {
        if (terms.some((term) => term.name === item.name)) return;
        terms.unshift({
          id: createId(),
          project: DEFAULT_PROJECT,
          creator: "当前用户",
          createdAt: formatDate(),
          online: false,
          ...item,
        });
        changed = true;
      });
      if (changed) writeTerms(terms);
      return changed;
    }

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
    ensureAskDemoTerms();
    ensureFormEnhance();
    ensureSimDialog();
    syncSimEntryLabel();
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
