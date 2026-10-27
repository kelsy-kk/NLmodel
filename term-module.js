/**
 * 业务建模 · 术语设置（导入 / 上线 / 详情）
 */
(function (global) {
  const STORAGE_KEY = "biz-modeling-terms-v3";
  const FIELD_TERM_KEY = "biz-modeling-field-terms-v1";
  const FIELD_TERM_DISMISS_KEY = "biz-modeling-field-term-dismiss-v1";
  const DEFAULT_PROJECT = "pmlead-市场指标";

  const CSV_HEADERS = ["术语名称", "同义词", "术语描述"];

  /* 需求：挂载资产入口暂时不启用（相关逻辑全部保留，含导出 / 校验 / 保存）
     恢复时把 MOUNT_ENTRY_ENABLED 改为 true 即可，列表行的「挂载」操作与详情页「挂载资产」按钮会一并回来 */
  const MOUNT_ENTRY_ENABLED = false;

  /* 需求：术语类型「过滤」改为「字段」，老数据里的 filter 统一迁移为 field
     （放在最外层作用域：normalizeTerm 与类型选项表分处两个闭包，共用这一张映射表） */
  const TERM_TYPE_LEGACY_MAP = { filter: "field" };

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
      /* 需求：术语类型「过滤」已改为「字段」，老数据跟着迁移 */
      termType: TERM_TYPE_LEGACY_MAP[item?.termType] || item?.termType,
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
    /* 术语数量 / 数据域变化会影响「未归属术语」计数，写入后刷新左侧目录 */
    try {
      global.GlossaryUI?.renderSide?.();
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

  /* 字段设置表里维护的枚举值：英文名称与中文别名都能反查，
     用于「把术语挂到字段上」时提示是否定义为该字段的特定值域 */
  function collectFieldEnumMap() {
    const map = new Map();
    if (typeof document === "undefined") return map;
    document.querySelectorAll('.model-pane[data-model-pane="fields"] .field-table tbody tr').forEach((row) => {
      const fieldEn = String(row.cells?.[2]?.textContent || "").replace(/\s+/g, " ").replace(/关联字段/g, "").trim();
      const fieldZh = String(row.cells?.[3]?.textContent || "").replace(/\s+/g, " ").trim();
      const raw = String(row.querySelector(".semantic-cell input.field-input")?.value || "").trim();
      if (!raw) return;
      const values = raw
        .split(/[,，、;；|]/)
        .map((v) => v.trim())
        .filter(Boolean);
      if (!values.length) return;
      if (fieldEn) map.set(fieldEn, values);
      if (fieldZh) map.set(fieldZh, values);
    });
    return map;
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
    const formOverlayEl = document.getElementById("termEditView");
    const formTitleEl = document.getElementById("termFormTitle");
    const formSubTitleEl = document.getElementById("termFormSubTitle");
    const formNameEl = document.getElementById("termFormName");
    const formSynonymsEl = document.getElementById("termFormSynonyms");
    const formDescEl = document.getElementById("termFormDescription");
    const formSaveBtnEl = document.getElementById("termFormSaveBtn");
    const formCancelBtnEl = document.getElementById("termFormCancelBtn");
    const formCloseBtnEl = document.getElementById("termEditBackBtn");

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
      /* 数据域变化会联动模型范围 → 关联资产候选需同步刷新 */
      refreshFormMountCandidates();
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
          refreshFormMountCandidates();
          return;
        }
        const input = event.target.closest('input[name="termFormModel"]');
        if (!input) return;
        if (input.checked) selectedFormModels.add(input.value);
        else selectedFormModels.delete(input.value);
        renderTermModelTags();
        renderTermModelDropdown(searchEl?.value || "");
        refreshFormMountCandidates();
      });
      tagsEl?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-remove-term-model]");
        if (!btn) return;
        event.preventDefault();
        selectedFormModels.delete(btn.dataset.removeTermModel);
        renderTermModelTags();
        renderTermModelDropdown(searchEl?.value || "");
        refreshFormMountCandidates();
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

    /* 数据域筛选支持多选（来自列表表头下拉）：命中任意一个即展示 */
    function domainFilterList() {
      if (Array.isArray(domainFilter)) return domainFilter.filter(Boolean);
      return domainFilter ? [domainFilter] : [];
    }

    function getFiltered() {
      const keyword = (searchEl?.value || "").trim().toLowerCase();
      const canAccessDomain = global.PermissionModule?.canAccessDomain || global.DataScope?.canAccessDomain;
      const project = (document.getElementById("projectFilterSelect")?.value || "pmlead-市场指标").trim();
      const filterDomains = domainFilterList();
      return terms.filter((item) => {
        if (canAccessDomain) {
          const domains = termDomainList(item);
          if (domains.length && !domains.some((d) => canAccessDomain(d, { project }))) return false;
        }
        if (filterDomains.length && !filterDomains.some((d) => termHasDomain(item, d))) return false;
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
      const domainKey = Array.isArray(domainFilter) ? domainFilter.slice().sort().join(",") : domainFilter;
      /* 切换术语库 / 筛选条件变化都回到第 1 页（同域的两个库互切也要重置） */
      const glossaryId = (() => {
        try {
          return global.GlossaryUI?.getCurG?.()?.id || "";
        } catch (_err) {
          return "";
        }
      })();
      const filterKey = `${keywordRaw}\u0001${domainKey}\u0001${onlineFilter}\u0001${glossaryId}`;
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
              const online = isTermOnline(item);
              /* 需求：列表不再在术语名称右侧打术语类型标签，类型只在详情页展示 */
              const conflictFlag = conflictKeys.has(item.id) ? '<span class="term-conflict-flag" title="该术语的名称/同义词与同一数据域内的其他术语重复，智能消费端应用时可能出现路由歧义，详见术语详情">⚠️</span>' : "";
              return `
          <tr data-id="${item.id}" class="${item.online === false ? "is-offline" : ""}">
            <td class="col-check"><input type="checkbox" class="term-row-check" data-id="${item.id}" ${selection.has(item.id) ? "checked" : ""} aria-label="选择行" /></td>
            <td class="col-index">${startIndex + index + 1}</td>
            <td class="col-text col-term-name"><div class="term-name-cell"><a class="name-link term-name-link" href="#" data-term-action="detail" data-id="${item.id}" title="${escapeHtml(item.name)}">${highlightHtml(item.name, keywordRaw)}</a>${conflictFlag}</div></td>
            <td class="domain-cell" title="${escapeHtml(item.domain || "")}">${highlightHtml(item.domain || "—", keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(termModelList(item).join("、") || "对该数据域下全部模型生效")}">${highlightHtml(modelText, keywordRaw)}</td>
            <td class="col-text" title="${escapeHtml(item.synonyms)}">${highlightHtml(item.synonyms || "—", keywordRaw)}</td>
            <td class="col-text-wide" title="${escapeHtml(item.description)}">${highlightHtml(item.description || "—", keywordRaw)}</td>
            <td>${escapeHtml(item.creator)}</td>
            <td>${escapeHtml(item.createdAt)}</td>
            <td class="col-online">${onlineTagHtml(isTermOnline(item))}</td>
            <td class="col-actions">
              ${MOUNT_ENTRY_ENABLED ? `<a class="op-link" href="#" data-term-action="mount" data-id="${item.id}" title="挂载 数据域/模型/维度/指标/字段 资产">挂载${(item.mounts || []).length ? `(${item.mounts.length})` : ""}</a>` : ""}
              <a class="op-link" href="#" data-term-action="online" data-id="${item.id}">${online ? "下线" : "上线"}</a>
              <a class="op-link" href="#" data-term-action="edit" data-id="${item.id}">编辑</a>
              ${online
                ? `<a class="op-link is-disabled" href="#" data-term-action="delete" data-id="${item.id}" title="下线状态下才可删除" aria-disabled="true" tabindex="-1">删除</a>`
                : `<a class="op-link" href="#" data-term-action="delete" data-id="${item.id}" title="删除术语，删除后不可恢复">删除</a>`}
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
      /* 「未归属术语」虚拟库的数据域为空，空态 / 计数由 index.html 的 renderHeader 统一处理 */
      if (g.id === "__orphan__") return;
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
      /* 智能消费端应用增强：注入类型/上级术语/值域绑定区块并反显 */
      ensureFormEnhance();
      /* 需求：术语用途已移除，一律按业务资产维护 */
      formTermKind = "asset";
      bindTermFormKind();
      applyFormKind();
      formValueBindings = (item?.valueBindings || []).map((row) => normalizeValueBinding(row));
      renderValueBindingRows();
      bindValueBindingRows();
      /* 关联资产反显：term.mounts + 指标侧 termIds 反查合并（统一数据层，过渡期双写） */
      formMounts = (item?.mounts || []).map((m) => ({ ...m }));
      if (item) {
        (global.MetricModule?.readMetrics?.() || []).forEach((metric) => {
          if (!(metric.termIds || []).includes(item.id)) return;
          const key = `metric:${metric.id || metric.name}`;
          if (!formMounts.some((m) => m.key === key)) {
            formMounts.push({
              key,
              type: "metric",
              name: metric.name,
              path: metric.domain || "指标",
              meta: metric.code || "",
            });
          }
        });
      }
      /* 关联资产：切回第一个 tab（模型）并清空搜索词 */
      activeFormMountTab = FORM_MOUNT_TYPES[0].type;
      const mountSearchEl = document.getElementById("termFormMountSearch");
      if (mountSearchEl) mountSearchEl.value = "";
      renderFormMountChips();
      syncValueBindingVisibility();
      syncMountPickerScope();
      syncParentTermOptions(item?.parentTermId || "");
      /* 需求：生效模型表单项已移除，模型改为在「关联资产 → 模型」页签勾选 */
      selectedFormModels = new Set();
      if (formSynonymsEl) formSynonymsEl.value = item?.synonyms || "";
      if (formDescEl) formDescEl.value = item?.description || "";
      hideTermNameDupHint();
      /* 副标题保持中性描述，具体差异交给用途卡片说明，避免重复 */
      /* 下沉二级页面：进入表单时收起列表/详情，退出时回到来源页面 */
      formReturnToDetail = Boolean(detailViewEl && !detailViewEl.hidden && detailTermId);
      ["listView", "modelView", "metricEditView"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      if (detailViewEl) detailViewEl.hidden = true;
      if (formOverlayEl) formOverlayEl.hidden = false;
      if (typeof global.scrollTo === "function") global.scrollTo({ top: 0, behavior: "auto" });
      formNameEl?.focus();
    }

    function closeForm() {
      if (formOverlayEl) formOverlayEl.hidden = true;
      editingId = null;
      setTermDomainPickerOpen(false);
      setTermModelPickerOpen(false);
      hideTermNameDupHint();
      hideSaveConfirm();
      if (formReturnToDetail && detailTermId && terms.some((item) => item.id === detailTermId)) {
        openDetail(detailTermId);
      } else {
        const listView = document.getElementById("listView");
        if (listView) listView.hidden = false;
      }
      formReturnToDetail = false;
      render();
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

    /* 需求：重名提醒统一文案 —— 「数据域」已存在同名术语：名称（路径），保存后直接覆盖 */
    function formatDupGroups(duplicates, scopeDomains) {
      const groups = new Map();
      (duplicates || []).forEach((item) => {
        const domainsOfItem = termDomainList(item);
        const hitDomains = (scopeDomains || []).filter((d) => domainsOfItem.includes(d));
        (hitDomains.length ? hitDomains : domainsOfItem.length ? domainsOfItem : ["未分域"]).forEach((d) => {
          if (!groups.has(d)) groups.set(d, new Map());
          const bucket = groups.get(d);
          if (!bucket.has(item.name)) bucket.set(item.name, termPathLabel(item));
        });
      });
      return [...groups.entries()]
        .map(
          ([domain, bucket]) =>
            `「${domain}」数据域已存在同名术语：${[...bucket.entries()]
              .map(([termName, path]) => `「${termName}」（${path}）`)
              .join("、")}`
        )
        .join("；");
    }

    /* 术语所在路径：术语中心 / 术语库 / 术语名（由 index.html 的 GlossaryUI 提供） */
    function termPathLabel(term) {
      try {
        const loc = global.GlossaryUI?.termLocation?.(term);
        if (loc?.path) return loc.path;
      } catch (_err) {
        /* ignore */
      }
      const ds = termDomainList(term);
      return `术语中心 / ${ds.length ? ds.join("、") : "未分域"} / ${term?.name || "—"}`;
    }

    /* 需求：名称 / 同义词校验（详情页用）—— 名称重名与同义词冲突都在「术语生效的数据域」内判定 */
    function collectTermConflicts(term) {
      const ownDomains = termDomainList(term);
      const nameDuplicates = terms.filter(
        (item) =>
          item.id !== term.id &&
          item.name === term.name &&
          ownDomains.some((d) => termHasDomain(item, d))
      );
      const synonymConflicts = findSynonymConflicts(term.name, term.synonyms, term.id, ownDomains)
        .filter((c) => c.word !== term.name);
      return { ownDomains, nameDuplicates, synonymConflicts };
    }

    /* 需求：详情页也要展示名称重名 / 同义词冲突，并给出冲突术语名称与所在路径 */
    function renderTermConflictBlock(term) {
      const { ownDomains, nameDuplicates, synonymConflicts } = collectTermConflicts(term);
      if (!nameDuplicates.length && !synonymConflicts.length) return "";
      const items = [];
      nameDuplicates.forEach((item) => {
        items.push(
          `<li class="is-risk">名称重名：与术语「${escapeHtml(item.name)}」重名（同在${ownDomains.map((d) => `「${escapeHtml(d)}」`).join("、") || "同一数据域"}），所在路径 <span class="term-conflict-path">${escapeHtml(termPathLabel(item))}</span>；该术语保存时将直接覆盖此同名术语</li>`
        );
      });
      synonymConflicts.slice(0, 6).forEach((c) => {
        items.push(
          `<li class="is-risk">同义词冲突：本术语的名称 / 同义词「${escapeHtml(c.word)}」与术语「${escapeHtml(c.term.name)}」的名称或同义词重复，所在路径 <span class="term-conflict-path">${escapeHtml(termPathLabel(c.term))}</span>，智能消费端应用时会出现同词多义的路由歧义</li>`
        );
      });
      if (synonymConflicts.length > 6) {
        items.push(`<li>…等共 ${synonymConflicts.length} 处同义词冲突</li>`);
      }
      return `
        <div class="term-conflict-banner">
          <span class="banner-ic">⚠</span>
          <div>
            <span class="banner-main">名称 / 同义词校验：发现 ${nameDuplicates.length + synonymConflicts.length} 处冲突（仅在${ownDomains.map((d) => `「${escapeHtml(d)}」`).join("、")}数据域内校验）</span>
            <ul class="term-conflict-list">${items.join("")}</ul>
          </div>
        </div>`;
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
      hintEl.textContent = `⚠ 名称重名：${formatDupGroups(duplicates, [...selectedFormDomains]) || scope}，保存后将直接覆盖该同名术语。`;
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
      hintEl.textContent = `⚠ 名称重名：${detail}，移动后将直接覆盖同名术语。`;
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
      /* 需求：术语用途 / 术语类型已移除，表单不再有「字段类型必须选模型」「通用知识必须填描述」两类校验 */
      const project = currentProject();
      /* 需求：名称重名只在「用户生效的数据域」内校验，命中则在创建过程中直接覆盖，不再弹窗拦截 */
      const duplicates = findTermNameDuplicates(name, editingId, domains);
      /* 生效模型来自「关联资产 → 模型」页签勾选：写回 modelNames / modelIds，
         列表「生效模型」列与详情保持一致口径；未勾选则表示对该数据域下全部模型生效 */
      const modelNames = formMountedModelNames();
      const modelIds = modelNames.map((name) => modelsForDomains(domains).find((model) => model.name === name)?.id || name);
      /* 智能消费端应用增强字段：上级术语 / 值域绑定 / 关联资产，全部按业务资产维护 */
      /* 术语类型已从表单移除：保留既有值（批量设置术语类型仍可写入），不再由表单覆盖 */
      const termType = (editingId ? terms.find((t) => t.id === editingId)?.termType : "") || "";
      const parentTermId = document.getElementById("termFormParentTerm")?.value || "";
      const valueBindings = formValueBindings
        .map((row) => normalizeValueBinding(row))
        .filter((row) => row.field && (vbMode(row.mode).value === "enum" ? row.values.length : row.value))
        .map((row) =>
          vbMode(row.mode).value === "enum"
            ? { mode: "enum", field: row.field, values: row.values, aliases: row.aliases }
            : { mode: "expr", field: row.field, op: row.op || "=", value: row.value }
        );
      /* 关联资产：草稿态写入（保存后指标侧双写 metric.termIds） */
      const nextMounts = formMounts.map((m) => ({ ...m }));
      const synonymText = (formSynonymsEl?.value || "").trim();
      const conflicts = findSynonymConflicts(name, synonymText, editingId, domains);
      if (conflicts.length && !force) {
        const detail = conflicts
          .slice(0, 4)
          .map((c) => `「${c.word}」与术语「${c.term.name}」的名称 / 同义词重复（${termPathLabel(c.term)}）`)
          .join("；");
        showSaveConfirm(
          `同义词冲突提醒：${detail}。\n冲突仅在当前生效数据域（${domains.join("、")}）内校验。\n智能消费端应用时同词多义会导致路由歧义，建议调整名称或同义词；确认无影响可点「仍要保存」。`
        );
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
        mounts: nextMounts,
        kind: "asset",
      };
      /* 新建时若生效数据域内已存在同名术语 → 直接覆盖它（保留其 id / 版本历史 / 挂载） */
      const overwriteTarget = editingId ? null : duplicates[0] || null;
      const target = editingId ? terms.find((item) => item.id === editingId) : overwriteTarget;
      if (target) {
        if (editingId && !target) {
          setTip("术语不存在或已删除");
          return;
        }
        /* 版本快照 + 影响分析：按「解释 / 口径 / 结构」三类变更分开留痕（治理要求：变更分离） */
        const impact = termImpactSummary(target);
        const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
        const changeKinds = [
          target.description !== values.description || target.synonyms !== values.synonyms ? "interpretation" : "",
          !sameList(target.valueBindings, valueBindings)
            ? "caliber"
            : "",
          target.termType !== values.termType ||
          (target.parentTermId || "") !== values.parentTermId ||
          !sameList(target.domains, values.domains) ||
          !sameList(target.modelNames, values.modelNames)
            ? "structure"
            : "",
        ].filter(Boolean);
        const changed = changeKinds.length > 0;
        const kindLabel = changeKinds.map((k) => TERM_CHANGE_KINDS[k].label).join("、");
        if (changed) {
          if (impact.total > 0 && !force) {
            showSaveConfirm(
              `${kindLabel}影响分析：该术语被 ${impact.metricCount} 个指标、${impact.fieldCount} 个字段引用，另有 ${impact.mountCount} 个挂载资产。\n修改会改变这些资产的智能消费端应用结果，旧版本将自动按「${kindLabel}」存入版本历史。确认变更可点「仍要保存」。`
            );
            return;
          }
          target.versions = [
            ...(target.versions || []),
            {
              time: formatDate(),
              editor: "当前用户",
              changeKind: changeKinds.join(","),
              changeLabel: kindLabel,
              description: target.description || "",
              synonyms: target.synonyms || "",
              valueBindings: target.valueBindings || [],
            },
          ];
        }
        const prevMetricKeys = (target.mounts || []).filter((m) => m.type === "metric").map((m) => m.key);
        const prevOnline = target.online !== false;
        Object.assign(target, values);
        /* 覆盖同名术语时不能把「已上线 / 创建信息」清掉 */
        target.online = prevOnline;
        if (overwriteTarget) {
          target.creator = overwriteTarget.creator || target.creator;
          target.createdAt = overwriteTarget.createdAt || target.createdAt;
        }
        setTip(
          editingId
            ? `已更新术语：${name}${changed ? `（${kindLabel}，已存 ${target.versions.length} 个历史版本）` : ""}`
            : `已创建术语：${name}（${ domains.join("、") }数据域内已存在同名术语，已采用直接覆盖的方式写入：${termPathLabel(overwriteTarget)}）`
        );
        syncMetricTermLinks(
          prevMetricKeys,
          nextMounts.filter((m) => m.type === "metric").map((m) => m.key),
          target.id
        );
      } else {
        const created = {
          id: createId(),
          ...values,
          online: false,
          creator: "当前用户",
          createdAt: formatDate(),
        };
        terms.unshift(created);
        setTip(`已创建术语：${name}（默认未上线，上线后可供挂载）`);
        syncMetricTermLinks(
          [],
          nextMounts.filter((m) => m.type === "metric").map((m) => m.key),
          created.id
        );
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

    /* ===== 术语详情：下沉二级页面 =====
       需求：术语表单的关联资产已扩为「模型 / 数据集 / 字段 / 指标 / 维度」五类，
       详情挂载清单同步覆盖这五类，避免表单里关联了却看不到 */
    const DETAIL_MOUNT_TYPES = ["model", "dataset", "metric", "dimension", "field"];

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
          <p><strong>状态：</strong>${item.online !== false ? "已上线" : "未上线"}</p>
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
      const total = collectDetailMountItems(term).filter((item) => DETAIL_MOUNT_TYPES.includes(item.type)).length;
      if (detailTitleEl) detailTitleEl.textContent = term.name || "未命名术语";
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
      const items = collectDetailMountItems(term).filter((item) => DETAIL_MOUNT_TYPES.includes(item.type));
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
      /* 需求：详情页展示「名称 / 同义词冲突」提醒（含冲突术语名称 + 所在路径） */
      detailOverviewPanelEl.innerHTML = `
        ${renderTermConflictBlock(term)}
        <div class="td-card">
          <div class="td-card-title">
            <span>基本信息</span>
          </div>
          <div class="td-grid">
            <div class="td-field"><div class="td-field-label">术语名称</div><div class="td-field-value">${escapeHtml(term.name || "—")}</div></div>
            <div class="td-field"><div class="td-field-label">术语类型</div><div class="td-field-value">${showTermTypeBadge(term) ? escapeHtml(termTypeMeta(term.termType).desc) : "未设置"}</div></div>
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

    /* 详情：值层级 / 值域绑定 / 版本与影响分析 三张卡（智能消费端应用增强） */
    function renderAskReadinessCards(term) {
      const parentTerm = term.parentTermId ? terms.find((t) => t.id === term.parentTermId) : null;
      const childTerms = terms.filter((t) => t.parentTermId === term.id);
      const impact = termImpactSummary(term);
      const bindings = term.valueBindings || [];
      const versions = (term.versions || []).slice().reverse();
      return `
        <div class="td-card">
          <div class="td-card-title"><span>值层级（上级 / 下级）</span><span class="td-field-label">智能消费端应用可沿层级上卷或展开</span></div>
          <div class="td-grid">
            <div class="td-field"><div class="td-field-label">上级术语</div><div class="td-field-value">${parentTerm ? `${escapeHtml(parentTerm.name)}（本术语 ⊂ ${escapeHtml(parentTerm.name)}）` : "无 — 顶层术语"}</div></div>
            <div class="td-field"><div class="td-field-label">下级术语</div><div class="td-field-value">${childTerms.length ? escapeHtml(childTerms.map((t) => t.name).join("、")) : "暂无"}</div></div>
          </div>
        </div>
        <div class="td-card">
          <div class="td-card-title"><span>值域绑定</span><span class="td-field-label">智能消费端应用时生成 WHERE / GROUP BY 条件</span></div>
          ${
            bindings.length
              ? `<ul class="term-link-list">${bindings
                  .map((b) => {
                    const isEnum = vbMode(b.mode).value === "enum";
                    const tag = `<span class="term-vb-tag" style="background:${isEnum ? "#ecfdf3" : "#eef6ff"};color:${isEnum ? "#067647" : "#1677ff"}">${isEnum ? "枚举值集" : "表达式"}</span>`;
                    const aliasText = isEnum && (b.aliases || []).length ? ` <span class="term-link-meta">别名：${escapeHtml((b.aliases || []).join("、"))}</span>` : "";
                    return `<li>${tag} <code>${escapeHtml(valueBindingText(b))}</code>${aliasText}</li>`;
                  })
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
                  .map((v) => {
                    const kinds = String(v.changeKind || (v.valueBindings && v.valueBindings.length ? "caliber" : "interpretation"))
                      .split(",")
                      .filter(Boolean);
                    const tags = kinds
                      .map((k) => {
                        const meta = TERM_CHANGE_KINDS[k];
                        return meta ? `<span class="term-vb-tag" style="background:${meta.color}1a;color:${meta.color}">${meta.label}</span>` : "";
                      })
                      .join("");
                    return `<li>${tags} ${escapeHtml(v.time)} <span class="term-link-meta">${escapeHtml(v.editor || "")} · 描述「${escapeHtml((v.description || "—").slice(0, 30))}」${(v.valueBindings || []).length ? `· 值域 ${(v.valueBindings || []).length} 条` : ""}</span></li>`;
                  })
                  .join("")}</ul>`
              : '<p class="term-link-empty">暂无历史版本（修改定义/同义词/值域/类型时自动按变更类型留痕）</p>'
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
        /* 挂载清单只保留指标与字段 */
        if (!DETAIL_MOUNT_TYPES.includes(item.type)) return false;
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

    /* 单个术语的图谱数据：与术语库图谱同一结构（模型 | 字段 | 术语 | 指标），
       保证两个图谱的样式与交互完全一致 */
    function buildTermGraphData(term) {
      const items = collectDetailMountItems(term);
      const fields = items
        .filter((item) => item.type === "field")
        .map((item) => ({ key: `${item.path}|${item.name}`, modelName: item.path || "", field: item.name, termIds: [term.id] }));
      const metrics = items
        .filter((item) => item.type === "metric")
        .map((item) => ({ id: item.name, name: item.name, code: item.meta || "指标", termIds: [term.id] }));
      const modelNames = new Set();
      items.filter((item) => item.type === "model").forEach((item) => modelNames.add(item.name));
      termModelList(term).forEach((name) => modelNames.add(name));
      fields.forEach((field) => field.modelName && modelNames.add(field.modelName));
      return {
        terms: [term],
        fields,
        metrics,
        models: [...modelNames].map((name) => ({ name, via: "term" })),
      };
    }

    function renderDetailLineage(term) {
      if (!detailLineagePanelEl) return;
      /* 同一术语且数据未变更时复用已渲染的图谱，避免每次切 tab 都重建 SVG */
      const renderKey = `${term.id}@${detailCacheVersion}`;
      if (detailLineageRenderedKey === renderKey) return;
      detailLineagePanelEl.innerHTML = `
        <div class="glossary-graph-bar">
          <div class="glossary-graph-stats" id="termDetailGraphStats">术语 1 · 字段 0 · 指标 0 · 模型 0</div>
          <div class="glossary-graph-legend">
            <span><i class="lg-dot lg-term"></i>术语</span>
            <span><i class="lg-dot lg-field"></i>字段</span>
            <span><i class="lg-dot lg-metric"></i>指标</span>
            <span><i class="lg-dot lg-model"></i>模型</span>
          </div>
          <div class="glossary-graph-tools" aria-label="图谱缩放控制">
            <button type="button" data-td-zoom="in" title="放大">＋</button>
            <button type="button" data-td-zoom="out" title="缩小">－</button>
            <button type="button" data-td-zoom="reset" title="复位">⟲</button>
          </div>
        </div>
        <div class="glossary-graph-wrap is-detail" id="termDetailGraphWrap">
          <svg id="termDetailGraphSvg" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="glossary-graph-empty" id="termDetailGraphEmpty" hidden>
            <svg width="34" height="34" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="5" r="2.4" stroke="currentColor" stroke-width="1.2"/><circle cx="11" cy="11" r="2.4" stroke="currentColor" stroke-width="1.2"/><path d="M6.8 6.8L9.2 9.2" stroke="currentColor" stroke-width="1.2"/></svg>
            <div data-graph-empty-text>该术语尚未挂载指标 / 字段等资产</div>
          </div>
          <div class="glossary-graph-tip">以该术语为中心展示其挂载链路；悬停高亮链路，点击节点锁定，点击空白处取消；支持 Ctrl + 滚轮或按钮缩放与拖拽平移。</div>
        </div>
      `;
      detailLineageRenderedKey = renderKey;
      /* 画布自带固定画布尺寸，无需等布局，直接同步绘制（rAF 在无头/后台标签页可能不触发） */
      renderDetailGraph(term);
    }

    function renderDetailGraph(term) {
      const svgEl = document.getElementById("termDetailGraphSvg");
      const wrapEl = document.getElementById("termDetailGraphWrap");
      if (!svgEl || !wrapEl || !term) return;
      const Canvas = global.SemanticGraphCanvas;
      if (!Canvas?.render) {
        svgEl.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#98a2b3" font-size="13">图谱组件未加载</text>';
        return;
      }
      Canvas.render(svgEl, wrapEl, buildTermGraphData(term), {
        statsId: "termDetailGraphStats",
        emptyId: "termDetailGraphEmpty",
        zoomAttr: "td-zoom",
        emptyText: "该术语尚未挂载指标 / 字段等资产",
        autoSelect: true,
      });
    }

    /* ===== 添加资产（术语挂载）弹窗 =====
       支持把 数据域/模型/维度/指标/字段 五类资产挂到术语上，
       挂载结果存于 term.mounts: [{ key, type, name, path, meta }] */
    const MOUNT_ASSET_TYPES = [
      { type: "domain", label: "数据域", icon: "🗂" },
      { type: "model", label: "模型", icon: "🧩" },
      { type: "dataset", label: "数据集", icon: "🗃" },
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
    /* 有枚举值的新增字段：等待用户二次确认是否定义为特定值域 */
    let mountValueCandidates = [];

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
        .term-mount-confirm { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; border: 1px solid #ffd591; background: #fff7e8; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #874d00; line-height: 1.6; }
        .term-mount-confirm[hidden] { display: none !important; }
        .term-mount-confirm-text { flex: 1; min-width: 0; white-space: pre-wrap; }
        .term-mount-confirm-actions { flex-shrink: 0; display: flex; gap: 8px; }
        .term-mount-confirm-actions button { border: 1px solid #d0d5dd; background: #fff; border-radius: 4px; padding: 5px 12px; font: inherit; font-size: 12px; color: #344054; cursor: pointer; }
        .term-mount-confirm-actions button.is-primary { background: #f59a23; border-color: #f59a23; color: #fff; }
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
                <button class="term-mount-type-trigger" id="assetMountTypeTrigger" type="button">资产类型 <b id="assetMountTypeCount"></b><span>▾</span></button>
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
            <div class="term-mount-confirm" id="mountValueConfirm" hidden>
              <span class="term-mount-confirm-text" id="mountValueConfirmText"></span>
              <span class="term-mount-confirm-actions">
                <button type="button" id="mountValueConfirmNo">否，仅挂载</button>
                <button type="button" class="is-primary" id="mountValueConfirmYes">是，定义为特定值域</button>
              </span>
            </div>
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
      /* 字段枚举值 → 是否定义为特定值域（值域绑定） */
      mountOverlayEl.querySelector("#mountValueConfirmYes").addEventListener("click", applyMountValueBindings);
      mountOverlayEl.querySelector("#mountValueConfirmNo").addEventListener("click", () => {
        const term = terms.find((row) => row.id === mountTermId);
        mountValueCandidates = [];
        finishMountSave(term ? `已为术语「${term.name}」挂载 ${term.mounts.length} 个资产（未定义为特定值域）` : "");
      });
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
      /* 需求：挂载资产入口暂不启用，逻辑保留，开关见文件顶部 MOUNT_ENTRY_ENABLED */
      if (!MOUNT_ENTRY_ENABLED) return;
      const term = terms.find((row) => row.id === termId);
      if (!term) return;
      ensureMountDialog();
      mountTermId = termId;
      mountSelected = new Set((term.mounts || []).map((m) => m.key));
      mountValueCandidates = [];
      const valueConfirmEl = document.getElementById("mountValueConfirm");
      if (valueConfirmEl) valueConfirmEl.hidden = true;
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
      const valueConfirmEl = document.getElementById("mountValueConfirm");
      if (valueConfirmEl) valueConfirmEl.hidden = true;
      mountTermId = "";
      mountSelected = new Set();
      mountValueCandidates = [];
    }

    /* 挂载字段时若该字段已配置枚举值 → 二次确认是否定义为特定值域（即值域绑定） */
    function showMountValueConfirm(candidates) {
      const bar = document.getElementById("mountValueConfirm");
      const textEl = document.getElementById("mountValueConfirmText");
      if (!bar || !textEl) return false;
      const names = candidates.map((c) => c.name).join("、");
      const preview = candidates
        .map((c) => `${c.name} IN (${c.values.map((v) => `'${v}'`).join(", ")})`)
        .join("；");
      textEl.textContent = `字段「${names}」已配置枚举值，是否要将该术语定义为该字段的特定值域？\n确认后写入枚举值集：${preview}`;
      bar.hidden = false;
      return true;
    }

    function applyMountValueBindings() {
      const term = terms.find((row) => row.id === mountTermId);
      const bar = document.getElementById("mountValueConfirm");
      if (bar) bar.hidden = true;
      if (!term) {
        closeMountDialog();
        return;
      }
      const list = Array.isArray(term.valueBindings) ? [...term.valueBindings] : [];
      mountValueCandidates.forEach((candidate) => {
        const idx = list.findIndex((b) => b.field === candidate.name && (b.mode || "expr") === "enum");
        if (idx >= 0) {
          list[idx] = { ...list[idx], values: Array.from(new Set([...(list[idx].values || []), ...candidate.values])) };
        } else {
          list.push({ mode: "enum", field: candidate.name, values: candidate.values, aliases: [] });
        }
      });
      term.valueBindings = list;
      /* 一旦定义为特定值域，术语即具备资产属性 */
      term.kind = "asset";
      const count = mountValueCandidates.length;
      mountValueCandidates = [];
      finishMountSave(`已为术语「${term.name}」挂载 ${term.mounts.length} 个资产，并写入 ${count} 条值域绑定（枚举值集）`);
    }

    function finishMountSave(tip) {
      writeTerms(terms);
      render();
      if (detailViewEl && !detailViewEl.hidden && detailTermId) renderDetailView();
      closeMountDialog();
      if (tip) setTip(tip);
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
      /* 指标侧双写：行内挂载弹窗保存时同步 metric.termIds（与表单关联资产同一数据口径） */
      syncMetricTermLinks(
        [...previous.keys()].filter((key) => key.startsWith("metric:")),
        term.mounts.filter((m) => m.type === "metric").map((m) => m.key),
        term.id
      );
      /* 新增挂载的字段里，有枚举值的先问一句要不要定义为特定值域 */
      const enumMap = collectFieldEnumMap();
      const candidates = [...mountSelected]
        .filter((key) => key.startsWith("field:") && !previous.has(key))
        .map((key) => {
          const asset = assetMap.get(key);
          const name = asset?.name || key.split("|")[1] || key;
          const values = enumMap.get(name) || enumMap.get(String(key).split("|")[1] || "") || [];
          return values.length ? { key, name, values } : null;
        })
        .filter(Boolean);
      mountValueCandidates = candidates;
      if (candidates.length && showMountValueConfirm(candidates)) return;
      finishMountSave(`已为术语「${term.name}」挂载 ${term.mounts.length} 个资产`);
    }

    /* ===== 智能消费端应用就绪增强：术语类型 / 值域绑定 / 值层级 / 同义词冲突 / 版本快照 =====
       对齐 DeepSeek 评审建议的 6 个缺口，全部在本模块内实现，index 零改动 */
    /* 需求：术语类型「过滤」改为「字段」。选「字段」时生效模型必填，
       值域绑定改为加载所选模型下各数据集里的字段供选择 */
    const TERM_TYPE_OPTIONS = [
      { value: "entity", label: "数据集", desc: "结构语义模型的数据集节点，问数时作为查询对象与 JOIN 依据", color: "#2f6bff" },
      { value: "dimension", label: "维度", desc: "分组轴，智能消费端应用时进入 GROUP BY", color: "#00a68a" },
      { value: "metric", label: "指标", desc: "度量口径，智能消费端应用时进入 SELECT 聚合", color: "#f59a23" },
      { value: "field", label: "字段", desc: "模型下的物理字段，智能消费端应用时进入 WHERE 过滤", color: "#7b61ff" },
    ];
    const TERM_VOCAB_GAPS_KEY = "biz-term-vocab-gaps-v1";
    /* 值域绑定两种模式（对应术语绑定的「值绑定」两类写法）：
       enum 外延式：显式列出枚举值集合（如 华东 = 上海、江苏、浙江）
       expr 内涵式：用约束表达式动态确定（如 region_id LIKE '01%'） */
    const VB_MODES = [
      { value: "expr", label: "表达式", hint: "内涵式：用条件表达式确定值域" },
      { value: "enum", label: "枚举值集", hint: "外延式：显式列出枚举值" },
    ];
    /* 治理：变更分离 —— 解释变更 / 口径变更 / 结构变更 分开留痕与提示 */
    const TERM_CHANGE_KINDS = {
      interpretation: { label: "解释变更", color: "#1677ff", desc: "同义词、定义等解释性描述" },
      caliber: { label: "口径变更", color: "#f59a23", desc: "值域绑定等影响取数的口径" },
      structure: { label: "结构变更", color: "#7b61ff", desc: "术语类型、上下级、生效范围" },
    };
    let formEnhInjected = false;
    let formValueBindings = [];
    /* 关联资产（v0.3 挂载融合）：表单草稿态挂载数组，保存时写入 term.mounts 并对指标侧双写 */
    let formMounts = [];
    /* 术语用途：generic 通用知识（只留 名称/同义词/描述/数据域）；asset 业务资产（完整表单） */
    let formTermKind = "generic";
    /* 表单是二级页面：记住是从列表还是从详情进入，退出时回到来源页 */
    let formReturnToDetail = false;

    function termTypeMeta(value) {
      return TERM_TYPE_OPTIONS.find((t) => t.value === value) || TERM_TYPE_OPTIONS[0];
    }

    /* 术语用途判定：业务资产才具备术语类型（参与 SELECT 聚合 / GROUP BY 分组 / WHERE 过滤），
       通用知识只靠描述由 AI 解析，没有类型语义 → 列表与详情都不展示类型标签
       历史数据无 kind 字段时，按与编辑表单一致的反推口径：有挂载资产 / 生效模型 / 值域绑定 即视为业务资产 */
    function termKindOf(term) {
      if (!term) return "generic";
      if (term.kind === "asset" || term.kind === "generic") return term.kind;
      if ((term.mounts || []).length || termModelList(term).length || (term.valueBindings || []).length) return "asset";
      return "generic";
    }

    /* 是否展示类型标签：业务资产且确实配过术语类型（避免无类型的老数据被兜底成「实体」） */
    function isAssetTerm(term) {
      return termKindOf(term) === "asset";
    }

    function showTermTypeBadge(term) {
      return isAssetTerm(term) && Boolean(term.termType);
    }

    function vbMode(mode) {
      return VB_MODES.find((m) => m.value === mode) || VB_MODES[0];
    }

    /* 需求：去掉「术语用途」单选，术语一律按业务资产维护
       （挂载资产 + 值域绑定 + 上级术语），描述保持选填 */
    function applyFormKind() {
      formTermKind = "asset";
      const enhance = document.getElementById("termFormEnhance");
      if (enhance) enhance.hidden = false;
      const descRequired = document.getElementById("termDescRequiredMark");
      const descOptional = document.getElementById("termDescOptionalMark");
      if (descRequired) descRequired.hidden = true;
      if (descOptional) descOptional.hidden = false;
    }

    function readFormKind() {
      applyFormKind();
      syncMountPickerScope();
    }

    function bindTermFormKind() {
      /* 用途单选已移除，保留空实现以兼容既有调用链 */
    }

    function normalizeValueBinding(row) {
      const mode = vbMode(row?.mode).value;
      return {
        mode,
        field: row?.field || "",
        op: row?.op || "=",
        value: row?.value || "",
        values: Array.isArray(row?.values) ? row.values : String(row?.values || "").split(/[,，]/).map((v) => v.trim()).filter(Boolean),
        aliases: Array.isArray(row?.aliases) ? row.aliases : String(row?.aliases || "").split(/[,，、]/).map((v) => v.trim()).filter(Boolean),
      };
    }

    /* 值域绑定渲染成「人可读 + SQL 可读」的两种形态 */
    function valueBindingText(b) {
      if (vbMode(b?.mode).value === "enum") {
        const values = (b.values || []).map((v) => `'${v}'`).join(", ");
        return `${b.field || "—"} IN (${values || "—"})`;
      }
      return `${b.field || "—"} ${b.op || "="} ${b.value || "—"}`;
    }

    function valueBindingSql(b) {
      if (vbMode(b?.mode).value === "enum") {
        const values = (b.values || []).map((v) => `'${String(v).replace(/'/g, "")}'`).join(", ");
        return `t.${b.field} IN (${values})`;
      }
      return `t.${b.field} ${b.op || "="} ${b.value}`;
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

    /* 旧的「全量字段去重清单」已废弃：值域绑定改为按所选模型的数据集字段加载（formDatasetFieldGroups） */

    function ensureFormEnhance() {
      if (formEnhInjected) return;
      const descField = document.getElementById("termFormDescription")?.closest(".term-form-field");
      if (!descField) return;
      formEnhInjected = true;
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        .term-conflict-flag { margin-left: 5px; font-size: 12px; cursor: help; }
        .term-vb-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .term-vb-row select, .term-vb-row input { flex: 1; min-width: 0; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 4px; padding: 6px 8px; font: inherit; font-size: 12px; color: #344054; }
        .term-vb-row .term-vb-op { flex: 0 0 72px; }
        .term-vb-row .term-vb-mode { flex: 0 0 96px; }
        .term-vb-remove { flex: 0 0 auto; border: 0; background: transparent; color: #98a2b3; font-size: 15px; cursor: pointer; }
        .term-vb-add { border: 1px dashed #c9cdd4; background: #fff; border-radius: 4px; padding: 5px 12px; font-size: 12px; color: #475467; cursor: pointer; }
        .term-vb-add:hover { border-color: #1e80ff; color: #1e80ff; }
        .term-vq-row { display: flex; flex-direction: column; gap: 6px; position: relative; margin-bottom: 10px; padding: 8px 30px 8px 10px; border: 1px solid #eef1f5; border-radius: 6px; background: #fbfcfe; }
        .term-vq-row input, .term-vq-row textarea { width: 100%; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 4px; padding: 6px 8px; font: inherit; font-size: 12px; color: #344054; resize: vertical; }
        .term-vq-row textarea { font-family: Consolas, monospace; }
        .term-vq-remove { position: absolute; top: 6px; right: 6px; border: 0; background: transparent; color: #98a2b3; font-size: 15px; cursor: pointer; }
        .term-vq-sql { margin: 4px 0 0; background: #0f1728; color: #d6e2ff; font-family: Consolas, monospace; font-size: 12px; padding: 8px 10px; border-radius: 6px; white-space: pre-wrap; word-break: break-all; }
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
        .term-vb-tag { display: inline-block; margin-right: 6px; padding: 0 6px; border-radius: 8px; font-size: 11px; line-height: 17px; }
        .td-card .term-link-list code { background: #f6f8fb; border: 1px solid #eef1f5; border-radius: 4px; padding: 1px 5px; font-family: Consolas, monospace; font-size: 12px; }
        .term-mount-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .term-mount-chips:empty { margin-bottom: 0; }
        .term-mount-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #f0f7ff; border: 1px solid #cfe4ff; color: #1e5fb3; }
        .term-mount-chip .term-chip-kind { font-style: normal; font-size: 10px; padding: 0 4px; border-radius: 3px; background: rgba(30, 128, 255, 0.12); }
        .term-mount-chip.is-stale { background: #fff7e8; border-color: #ffd591; color: #874d00; }
        .term-mount-chip button { border: 0; background: transparent; cursor: pointer; color: inherit; font-size: 13px; padding: 0; line-height: 1; }
        /* 关联资产：5 个类型页签 */
        .term-mount-tabs { display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: -1px; }
        .term-mount-tab { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; background: transparent; font: inherit; font-size: 12.5px; color: #475467; cursor: pointer; }
        .term-mount-tab:hover { background: #f6f9ff; color: #1e5fb3; }
        .term-mount-tab.is-active { border-color: #e4e7ec; background: #fff; color: #1e5fb3; font-weight: 600; }
        .term-mount-tab em { font-style: normal; min-width: 16px; padding: 0 5px; border-radius: 8px; background: #eef1f5; color: #667085; font-size: 10.5px; line-height: 15px; text-align: center; }
        .term-mount-tab.is-active em { background: #e0edff; color: #1e5fb3; }
        .term-mount-panel { border: 1px solid #e4e7ec; border-radius: 0 6px 6px 6px; background: #fff; padding: 10px; }
        .term-mount-picker-scope { font-size: 11px; color: #98a2b3; margin-bottom: 8px; }
        .term-mount-picker-head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .term-mount-picker-search { flex: 1; min-width: 0; border: 1px solid #d0d5dd; border-radius: 4px; padding: 5px 9px; font: inherit; font-size: 12px; color: #344054; }
        .term-mount-picker-stat { flex-shrink: 0; font-size: 11px; color: #98a2b3; }
        .term-mount-picker-list { max-height: 248px; overflow: auto; border: 1px solid #f0f2f5; border-radius: 4px; }
        .term-mount-picker-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; font-size: 12px; color: #344054; cursor: pointer; border-bottom: 1px solid #f7f8fa; }
        .term-mount-picker-item:hover { background: #f8fafc; }
        .term-mount-picker-item .path { margin-left: auto; color: #98a2b3; font-size: 11px; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .term-mount-picker-empty { padding: 18px 0; text-align: center; color: #98a2b3; font-size: 12px; }
        /* 关联资产行占满整行（不留右侧提示列），页签与列表更宽松 */
        .term-enh-field-wide { grid-template-columns: 116px minmax(0, 1fr); }
      `;
      document.head.appendChild(styleEl);
      /* 需求：关联资产放到右列（#termFormMountHost），其余增强项留在左列 */
      const mountWrap = document.createElement("div");
      mountWrap.innerHTML = `
        <div class="term-form-field term-enh-field term-enh-field-wide" id="termFormMountField">
          <label>关联资产</label>
          <div class="term-enh-control">
            <div id="termFormMountChips" class="term-mount-chips"></div>
            <div class="term-mount-tabs" id="termFormMountTabs" role="tablist" aria-label="关联资产类型"></div>
            <div class="term-mount-panel" id="termFormMountPanel">
              <div class="term-mount-picker-scope" id="termFormMountScope"></div>
              <div class="term-mount-picker-head">
                <input class="term-mount-picker-search" id="termFormMountSearch" type="search" placeholder="搜索当前类型的资产" autocomplete="off" />
                <span class="term-mount-picker-stat" id="termFormMountStat"></span>
              </div>
              <div class="term-mount-picker-list" id="termFormMountList"></div>
            </div>
            <div class="term-enh-hint">按 模型 / 数据集 / 字段 / 指标 / 维度 分页勾选，勾选即关联；候选范围受所选数据域过滤</div>
          </div>
        </div>`;
      const mountHost = document.getElementById("termFormMountHost");
      if (mountHost) mountHost.append(...Array.from(mountWrap.children));
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="term-form-field term-enh-field">
          <label for="termFormParentTerm">上级术语</label>
          <div class="term-enh-control">
            <select id="termFormParentTerm"><option value="">无 — 顶层术语</option></select>
          </div>
          <div class="term-enh-hint term-enh-side">建立「上海 ⊂ 华东」这类值层级后，智能消费端应用可沿层级上卷或展开</div>
        </div>
        <div class="term-form-field term-enh-field" id="termValueBindingField">
          <label>值域绑定</label>
          <div class="term-enh-control">
            <div id="termValueBindingRows"></div>
            <button type="button" id="termValueBindingAdd" class="term-vb-add">＋ 添加值域规则</button>
          </div>
          <div class="term-enh-hint term-enh-side">字段候选来自右侧「关联资产」勾选的模型 / 数据集（未关联时为空）。<br />枚举值集＝显式列举（展开为 IN）；表达式＝条件约束，如 region_id LIKE '01%'</div>
        </div>
        <div class="term-save-confirm" id="termSaveConfirm" hidden>
          <span class="term-save-confirm-text" id="termSaveConfirmText"></span>
          <span class="term-save-confirm-actions">
            <button type="button" id="termSaveConfirmCancel">取消</button>
            <button type="button" class="is-primary" id="termSaveConfirmBtn">仍要保存</button>
          </span>
        </div>
      `;
      /* 增强区（上级术语 / 值域绑定 / 保存确认条）整体放进左列容器 */
      const enhanceBlock = document.createElement("div");
      enhanceBlock.id = "termFormEnhance";
      enhanceBlock.append(...Array.from(wrap.children));
      const enhanceHost = document.getElementById("termFormEnhanceHost");
      if (enhanceHost) enhanceHost.appendChild(enhanceBlock);
      else if (descField) descField.after(enhanceBlock);
      document.getElementById("termValueBindingAdd").addEventListener("click", () => {
        formValueBindings.push(normalizeValueBinding({ mode: "expr" }));
        renderValueBindingRows();
      });
      syncValueBindingVisibility();
      syncTypeDrivenRules();
      /* 页面内确认条：替代原生 confirm（内嵌 webview 中原生对话框会冻结/不可见） */
      document.getElementById("termSaveConfirmBtn").addEventListener("click", () => {
        hideSaveConfirm();
        saveForm(true);
      });
      document.getElementById("termSaveConfirmCancel").addEventListener("click", hideSaveConfirm);
      /* 关联资产：5 个类型页签（模型/数据集/字段/指标/维度）+ 已选 chips，候选随所选数据域/模型联动 */
      document.getElementById("termFormMountTabs")?.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-mount-tab]");
        if (!tab) return;
        activeFormMountTab = tab.dataset.mountTab || FORM_MOUNT_TYPES[0].type;
        renderFormMountPanel();
      });
      document.getElementById("termFormMountChips")?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-mountchip-remove]");
        if (!btn) return;
        formMounts = formMounts.filter((m) => m.key !== btn.dataset.mountchipRemove);
        renderFormMountChips();
        renderFormMountPanel();
        /* 值域绑定的字段候选来自关联资产，移除后需同步刷新 */
        renderValueBindingRows();
      });
      document.getElementById("termFormMountSearch")?.addEventListener("input", renderFormMountPanel);
      bindFormMountPanel();
    }

    /* 需求：值域绑定的候选字段来源于「关联资产」——
       取关联资产里勾选的模型（model）与其下的数据集、以及直接勾选的数据集（dataset），
       字段再取数据集下的 维度 / 度量 / 指标（结构语义模型 store.models[].datasets[]） */
    function formMountedModelNames() {
      return [...new Set(formMounts.filter((m) => m.type === "model").map((m) => m.name).filter(Boolean))];
    }

    function formSelectedModels() {
      const names = formMountedModelNames();
      if (!names.length) return [];
      return (global.MetricModule?.listBusinessModels?.() || []).filter((model) => names.includes(model.name));
    }

    function formDatasetFieldGroups() {
      let bridgeModels = [];
      try {
        bridgeModels = global.SemanticBridge?.ensureSeed?.()?.models || [];
      } catch (_err) {
        bridgeModels = [];
      }
      const mountedModels = new Set(formMountedModelNames());
      const mountedDatasets = new Set(formMounts.filter((m) => m.type === "dataset").map((m) => m.name).filter(Boolean));
      const groups = [];
      const pushDataset = (modelName, ds) => {
        const fields = [...(ds.dimensions || []), ...(ds.measures || []), ...(ds.metrics || [])]
          .map((f) => ({ name: f.name || f.fqn || "", fqn: f.fqn || "", dataType: f.dataType || "" }))
          .filter((f) => f.name);
        if (fields.length) groups.push({ model: modelName, dataset: ds.name || "数据集", fields });
      };
      /* 1) 关联资产里勾选的模型 → 该模型下全部数据集 */
      formSelectedModels().forEach((model) => {
        const dsList = (bridgeModels.find((m) => m.name === model.name)?.datasets) || [];
        if (dsList.length) {
          dsList.forEach((ds) => pushDataset(model.name, ds));
          return;
        }
        /* 该模型在结构语义里还没有数据集时，回退到模型自带的字段清单 */
        const fallback = (model.fieldNames || []).map((name) => ({ name, fqn: "", dataType: "" }));
        if (fallback.length) groups.push({ model: model.name, dataset: `${model.name}字段`, fields: fallback });
      });
      /* 2) 直接勾选的数据集（其所属模型未勾选时单独补充） */
      if (mountedDatasets.size) {
        bridgeModels.forEach((m) => {
          if (mountedModels.has(m.name)) return;
          (m.datasets || []).forEach((ds) => {
            if (mountedDatasets.has(ds.name)) pushDataset(m.name, ds);
          });
        });
      }
      return groups;
    }

    function formDatasetFieldValues() {
      const values = [];
      formDatasetFieldGroups().forEach((g) => g.fields.forEach((f) => values.push(f.fqn || f.name)));
      return values;
    }

    function renderValueBindingRows() {
      const rowsEl = document.getElementById("termValueBindingRows");
      if (!rowsEl) return;
      const groups = formDatasetFieldGroups();
      rowsEl.innerHTML = formValueBindings.length
        ? formValueBindings
            .map((row, index) => {
              const mode = vbMode(row.mode).value;
              /* 旧数据里保存的字段名可能不在当前候选内，补一个保留项，避免保存时被清空 */
              const keepCurrent =
                row.field && !groups.some((g) => g.fields.some((f) => (f.fqn || f.name) === row.field))
                  ? `<option value="${escapeHtml(row.field)}" selected>${escapeHtml(row.field)}（当前值，不在所选模型数据集内）</option>`
                  : "";
              const options = groups.length
                ? groups
                    .map(
                      (g) =>
                        `<optgroup label="${escapeHtml(g.model + " · " + g.dataset)}">${g.fields
                          .map(
                            (f) =>
                              `<option value="${escapeHtml(f.fqn || f.name)}" ${row.field === (f.fqn || f.name) ? "selected" : ""} title="类型：${escapeHtml(f.dataType || "—")}">${escapeHtml(f.name)}${f.fqn ? ` · ${escapeHtml(f.fqn)}` : ""}</option>`
                          )
                          .join("")}</optgroup>`
                    )
                    .join("")
                : `<option value="" disabled>${formMountedModelNames().length ? "关联模型下没有数据集字段" : "请先在右侧「关联资产 → 模型」勾选模型"}</option>`;
              const fieldSelect = `
                <select data-vb-role="field" data-vb-placeholder="1">
                  <option value="">选择字段</option>
                  ${keepCurrent}${options}
                </select>`;
              const tail =
                mode === "enum"
                  ? `<input data-vb-role="values" type="text" placeholder="枚举值，逗号分隔：上海,江苏,浙江" value="${escapeHtml((row.values || []).join(","))}" />
                     <input data-vb-role="aliases" type="text" placeholder="别名/口语问法（选填）：华东,华东大区" value="${escapeHtml((row.aliases || []).join("、"))}" />`
                  : `<select data-vb-role="op" class="term-vb-op">
                      ${["=", "IN", "LIKE", ">", "<", ">=", "<="]
                        .map((op) => `<option value="${op}" ${row.op === op ? "selected" : ""}>${op}</option>`)
                        .join("")}
                     </select>
                     <input data-vb-role="value" type="text" placeholder="值，如 '01','02'" value="${escapeHtml(row.value)}" />`;
              return `
              <div class="term-vb-row" data-vb-index="${index}" title="${vbMode(row.mode).hint}">
                <select data-vb-role="mode" class="term-vb-mode" title="${vbMode(row.mode).hint}">
                  ${VB_MODES.map((m) => `<option value="${m.value}" ${mode === m.value ? "selected" : ""} title="${m.hint}">${m.label}</option>`).join("")}
                </select>
                ${fieldSelect}
                ${tail}
                <button type="button" class="term-vb-remove" data-vb-remove="${index}" aria-label="删除">×</button>
              </div>`;
            })
            .join("")
        : '<div class="term-enh-hint">尚未配置，可添加值域规则</div>';
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
        const role = event.target.dataset.vbRole;
        if (role === "value") formValueBindings[index].value = event.target.value;
        if (role === "values") {
          formValueBindings[index].values = String(event.target.value || "")
            .split(/[,，]/)
            .map((v) => v.trim())
            .filter(Boolean);
        }
        if (role === "aliases") {
          formValueBindings[index].aliases = String(event.target.value || "")
            .split(/[,，、]/)
            .map((v) => v.trim())
            .filter(Boolean);
        }
      });
      rowsEl.addEventListener("change", (event) => {
        const rowEl = event.target.closest(".term-vb-row");
        if (!rowEl) return;
        const index = Number(rowEl.dataset.vbIndex);
        if (!formValueBindings[index]) return;
        const role = event.target.dataset.vbRole;
        if (role === "field") formValueBindings[index].field = event.target.value;
        if (role === "op") formValueBindings[index].op = event.target.value;
        /* 切换模式需要重绘该行（表达式 ↔ 枚举值集 的输入项不同） */
        if (role === "mode") {
          const current = formValueBindings[index];
          formValueBindings[index] = normalizeValueBinding({ ...current, mode: event.target.value });
          renderValueBindingRows();
        }
      });
      rowsEl.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-vb-remove]");
        if (!btn) return;
        formValueBindings.splice(Number(btn.dataset.vbRemove), 1);
        renderValueBindingRows();
      });
    }

    /* ===== 需求：术语类型已从表单移除，值域绑定常显（不再按类型控制显隐） ===== */
    function syncValueBindingVisibility() {
      const field = document.getElementById("termValueBindingField");
      if (!field) return;
      field.hidden = false;
    }

    /* 需求：生效模型表单项已移除（模型改在「关联资产 → 模型」勾选），
       该函数只负责重绘值域绑定的数据集字段候选（候选来自关联资产） */
    function syncTypeDrivenRules() {
      if (document.getElementById("termValueBindingRows")) renderValueBindingRows();
    }

    /* 结构语义模型里的数据集节点（SemanticBridge store.models[].datasets）
       传入 modelNames 时只取这些模型下的数据集——数据集来源于模型，
       模型候选按所选数据域过滤后，数据集必须同步收敛，避免域外模型的数据集漏进来 */
    function collectSemanticDatasets(modelNames) {
      const out = [];
      try {
        const store = global.SemanticBridge?.ensureSeed?.();
        (store?.models || []).forEach((model) => {
          if (modelNames && !modelNames.has(model.name)) return;
          (model.datasets || []).forEach((ds) => {
            out.push({
              key: `dataset:${ds.id || ds.name}`,
              type: "dataset",
              name: ds.name || ds.id || "",
              path: model.name || "结构语义模型",
              meta: "",
            });
          });
        });
      } catch (_err) {
        /* ignore */
      }
      return out;
    }

    /* 模型 → 字段名清单：优先建模侧落库的字段设置（fieldSettings）与数据集字段（真实编辑内容），
       为空时由调用方回退到模型自带 fieldNames。指标（metrics）是指标回写不算物理字段，不取 */
    function collectSemanticFieldMap() {
      const map = new Map();
      try {
        const store = global.SemanticBridge?.ensureSeed?.();
        (store?.models || []).forEach((model) => {
          const names = [];
          const push = (name) => {
            const value = String(name || "").trim();
            if (value && !names.includes(value)) names.push(value);
          };
          (model.fieldSettings || []).forEach((group) => (group.fields || []).forEach((f) => push(f.name)));
          (model.datasets || []).forEach((ds) => {
            [...(ds.dimensions || []), ...(ds.measures || [])].forEach((f) => push(f.name));
          });
          if (names.length) map.set(model.name, names);
        });
      } catch (_err) {
        /* ignore */
      }
      return map;
    }

    /* ===== 关联资产（v0.3 挂载融合）：表单内按 模型/数据集/字段/指标/维度 五个页签勾选，
       候选按所选数据域与生效模型过滤 ===== */
    const FORM_MOUNT_TYPES = [
      { type: "model", label: "模型" },
      { type: "dataset", label: "数据集" },
      { type: "field", label: "字段" },
      { type: "metric", label: "指标" },
      { type: "dimension", label: "维度" },
    ];
    /* 当前激活的关联资产页签（openForm 时回到第一个） */
    let activeFormMountTab = FORM_MOUNT_TYPES[0].type;

    function syncMountPickerScope() {
      renderFormMountChips();
      renderFormMountPanel();
    }

    /* 候选范围：所选数据域下的模型，未选数据域则给全量 */
    function formScopeModels() {
      const all = global.MetricModule?.listBusinessModels?.() || [];
      const domains = [...selectedFormDomains];
      if (domains.length) return modelsForDomains(domains);
      return all;
    }

    function formMountScopeLabel() {
      if (selectedFormDomains.size) return `候选范围：所选数据域下的模型（${selectedFormDomains.size} 个域）`;
      return "候选范围：未限定数据域";
    }

    /* 按表单所选数据域/模型过滤五类候选：模型来自范围内的业务模型，
       字段与维度来自范围内模型的 fieldNames，指标按 domain / domainModels 命中范围内域或模型 */
    function mountCandidatesForForm() {
      const models = formScopeModels();
      const modelNames = new Set(models.map((model) => model.name));
      const domains = [...selectedFormDomains];
      const scoped = Boolean(modelNames.size || domains.length);
      const modelAssets = models.map((model) => ({
        key: `model:${model.name}`,
        type: "model",
        name: model.name,
        path: model.domain || "模型",
      }));
      const metricAssets = [];
      const dimOwners = new Map();
      const fieldAssets = [];
      /* 字段/维度来源于模型的数据集字段设置：建模侧落库过（fieldSettings / datasets）就用真实内容，
         否则回退模型自带 fieldNames */
      const semanticFieldMap = collectSemanticFieldMap();
      models.forEach((model) => {
        const bridgeFields = semanticFieldMap.get(model.name);
        const fieldList = bridgeFields && bridgeFields.length ? bridgeFields : model.fieldNames || [];
        fieldList.forEach((fieldName) => {
          fieldAssets.push({ key: `field:${model.name}|${fieldName}`, type: "field", name: fieldName, path: model.name });
          if (!MOUNT_MEASURE_NAME_RE.test(fieldName)) {
            if (!dimOwners.has(fieldName)) dimOwners.set(fieldName, new Set());
            dimOwners.get(fieldName).add(model.name);
          }
        });
      });
      const dimAssets = [...dimOwners].map(([name, owners]) => ({
        key: `dimension:${name}`,
        type: "dimension",
        name,
        path: [...owners].join("、"),
      }));
      (global.MetricModule?.readMetrics?.() || []).forEach((metric) => {
        if (scoped) {
          const hitDomain = domains.includes(metric.domain || "");
          const metricModelNames = [...(metric.domainModels || []), ...(metric.modelNames || [])].map((d) =>
            typeof d === "string" ? d : d?.name
          );
          if (!hitDomain && !metricModelNames.some((n) => modelNames.has(n))) return;
        }
        metricAssets.push({
          key: `metric:${metric.id || metric.name}`,
          type: "metric",
          name: metric.name,
          path: metric.domain || metric.domainModels?.[0]?.name || "指标",
          meta: metric.code || "",
        });
      });
      /* 数据集来源于模型：未选数据域时给全量；选了域则只保留范围内模型的数据集
         （与模型页签同源过滤，范围内没有模型时数据集也为空） */
      return [
        ...modelAssets,
        ...collectSemanticDatasets(domains.length ? modelNames : null),
        ...metricAssets,
        ...dimAssets,
        ...fieldAssets,
      ];
    }

    function renderFormMountChips() {
      const chipsEl = document.getElementById("termFormMountChips");
      if (!chipsEl) return;
      if (!formMounts.length) {
        chipsEl.innerHTML = '<div class="term-enh-hint">尚未关联资产，在下方按类型分页勾选即可关联</div>';
        return;
      }
      const candidateKeys = new Set(mountCandidatesForForm().map((asset) => asset.key));
      chipsEl.innerHTML = formMounts
        .map((m) => {
          const stale = !candidateKeys.has(m.key);
          const label = FORM_MOUNT_TYPES.find((t) => t.type === m.type)?.label || m.type;
          return `
          <span class="term-mount-chip ${stale ? "is-stale" : ""}" title="${stale ? "已不在当前所选数据域/模型范围内，建议移除或调整范围" : escapeHtml(m.path || "")}">
            <i class="term-chip-kind">${escapeHtml(label)}</i>${escapeHtml(m.name)}
            <button type="button" data-mountchip-remove="${escapeHtml(m.key)}" aria-label="移除 ${escapeHtml(m.name)}">×</button>
          </span>`;
        })
        .join("");
    }

    /* 页签：模型 / 数据集 / 字段 / 指标 / 维度，各显示已选数量 */
    function renderFormMountTabs() {
      const tabsEl = document.getElementById("termFormMountTabs");
      if (!tabsEl) return;
      const counts = {};
      formMounts.forEach((m) => {
        counts[m.type] = (counts[m.type] || 0) + 1;
      });
      tabsEl.innerHTML = FORM_MOUNT_TYPES.map(
        (typeDef) => `
        <button type="button" class="term-mount-tab ${typeDef.type === activeFormMountTab ? "is-active" : ""}" role="tab" data-mount-tab="${typeDef.type}" aria-selected="${typeDef.type === activeFormMountTab}">
          ${escapeHtml(typeDef.label)}<em>${counts[typeDef.type] || 0}</em>
        </button>`
      ).join("");
    }

    /* 面板：只渲染当前页签类型的候选，勾选即写入关联资产 */
    function renderFormMountPanel() {
      renderFormMountTabs();
      const scopeEl = document.getElementById("termFormMountScope");
      if (scopeEl) scopeEl.textContent = formMountScopeLabel();
      const listEl = document.getElementById("termFormMountList");
      if (!listEl) return;
      const typeDef = FORM_MOUNT_TYPES.find((t) => t.type === activeFormMountTab) || FORM_MOUNT_TYPES[0];
      const keyword = (document.getElementById("termFormMountSearch")?.value || "").trim().toLowerCase();
      const selected = new Set(formMounts.map((m) => m.key));
      const all = mountCandidatesForForm();
      const assets = all
        .filter((asset) => asset.type === typeDef.type)
        .filter(
          (asset) =>
            !keyword || asset.name.toLowerCase().includes(keyword) || String(asset.path || "").toLowerCase().includes(keyword)
        );
      const statEl = document.getElementById("termFormMountStat");
      if (statEl) {
        statEl.textContent = `共 ${all.filter((asset) => asset.type === typeDef.type).length} 项，已选 ${selected.size} 项`;
      }
      if (!assets.length) {
        listEl.innerHTML = `<div class="term-mount-picker-empty">当前范围内没有可选的${escapeHtml(typeDef.label)}，可调整数据域或清除搜索词</div>`;
        return;
      }
      listEl.innerHTML = assets
        .map(
          (asset) => `
          <label class="term-mount-picker-item">
            <input type="checkbox" data-formmount value="${escapeHtml(asset.key)}" ${selected.has(asset.key) ? "checked" : ""} />
            <span title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}${asset.meta ? ` <i style="font-style:normal;color:#98a2b3;">${escapeHtml(asset.meta)}</i>` : ""}</span>
            <span class="path" title="${escapeHtml(asset.path || "")}">${escapeHtml(asset.path || "")}</span>
          </label>`
        )
        .join("");
    }

    function bindFormMountPanel() {
      const listEl = document.getElementById("termFormMountList");
      if (!listEl || listEl.dataset.bound) return;
      listEl.dataset.bound = "1";
      listEl.addEventListener("change", (event) => {
        const input = event.target.closest("input[data-formmount]");
        if (!input) return;
        const key = input.value;
        if (input.checked) {
          if (!formMounts.some((m) => m.key === key)) {
            const asset = mountCandidatesForForm().find((a) => a.key === key);
            formMounts.push({
              key,
              type: asset?.type || key.split(":")[0],
              name: asset?.name || key.split(":").slice(1).join(":"),
              path: asset?.path || "",
              meta: asset?.meta || "",
            });
          }
        } else {
          formMounts = formMounts.filter((m) => m.key !== key);
        }
        /* 勾选只刷新已选 chips 与页签计数，不重建列表（否则会丢焦点 / 滚动位置） */
        renderFormMountChips();
        renderFormMountTabs();
        /* 值域绑定的字段候选来自关联资产（模型 / 数据集），勾选后同步刷新 */
        renderValueBindingRows();
      });
    }

    /* 数据域/模型选择变化后刷新候选与 chips（失效项标黄提示） */
    function refreshFormMountCandidates() {
      renderFormMountChips();
      renderFormMountPanel();
      /* 需求：所选模型变化 → 值域绑定里的「数据集字段」候选同步刷新 */
      syncTypeDrivenRules();
    }

    /* 指标侧双写：挂载/取消挂载指标时同步 metric.termIds，
       保证指标编辑表单与术语引用统计一致（统一数据层过渡期的派生视图）
       注：MetricModule 未导出 writeMetrics，此处按其存储契约直写并派发更新事件 */
    const METRIC_STORAGE_KEY = "glodon.biz-metrics.v7";
    function syncMetricTermLinks(prevMetricKeys, nextMetricKeys, termId) {
      if (!termId) return;
      const prev = new Set(prevMetricKeys.map((k) => String(k).split(":").slice(1).join(":")));
      const next = new Set(nextMetricKeys.map((k) => String(k).split(":").slice(1).join(":")));
      if (!prev.size && !next.size) return;
      const metrics = global.MetricModule?.readMetrics?.() || [];
      let changed = false;
      metrics.forEach((metric) => {
        const id = String(metric.id || metric.name || "");
        if (!id) return;
        const ids = Array.isArray(metric.termIds) ? metric.termIds : [];
        const has = ids.includes(termId);
        if (next.has(id) && !has) {
          metric.termIds = [...ids, termId];
          changed = true;
        } else if (!next.has(id) && has && prev.has(id)) {
          metric.termIds = ids.filter((x) => x !== termId);
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem(METRIC_STORAGE_KEY, JSON.stringify(metrics));
          global.dispatchEvent(new CustomEvent("biz-metrics-updated", { detail: metrics }));
        } catch (_err) {
          /* ignore */
        }
      }
    }

    /* 问句与已确认问法的相似度：用于智能消费端应用模拟里优先复用标准 SQL（词级重合度） */
    function matchVerifiedQuery(question, term) {
      const list = term?.verifiedQueries || [];
      if (!list.length) return null;
      const norm = String(question || "").trim().toLowerCase();
      if (!norm) return null;
      const tokens = norm.split(/[\s,，。?？、]+/).filter(Boolean);
      let best = null;
      let bestScore = 0;
      list.forEach((item) => {
        const target = String(item.question || "").trim().toLowerCase();
        if (!target) return;
        let score = 0;
        if (target === norm || target.includes(norm) || norm.includes(target)) score = 1;
        else if (tokens.length) {
          const hit = tokens.filter((token) => target.includes(token)).length;
          score = hit / tokens.length;
        }
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      });
      return bestScore >= 0.6 ? { item: best, score: bestScore } : null;
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

    /* 同义词冲突检测：本术语的名称/同义词与其他术语的名称/同义词相撞。
       需求：只在「生效的数据域」内判定 —— 数据域不同不属于冲突（各自域内独立路由） */
    function findSynonymConflicts(nameText, synonymsText, editingIdLocal, domainList) {
      const ownWords = new Set(
        [nameText, ...(synonymsText || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter((s) => s.length >= 2)
      );
      const scopeDomains = domainList || [];
      const conflicts = [];
      terms.forEach((other) => {
        if (other.id === editingIdLocal) return;
        /* 不在生效数据域内的术语不参与冲突判定 */
        if (scopeDomains.length && !scopeDomains.some((d) => termHasDomain(other, d))) return;
        const otherWords = [other.name, ...(other.synonyms || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter(Boolean);
        otherWords.forEach((word) => {
          if (word.length >= 2 && ownWords.has(word)) {
            conflicts.push({ word, term: other, crossDomain: false });
          }
        });
      });
      return conflicts;
    }

    /* 列表标记：两条术语只有「数据域存在交集」时才可能在同一生效域内冲突 */
    function collectSynonymConflictKeys() {
      const keys = new Set();
      terms.forEach((term) => {
        const own = [term.name, ...(term.synonyms || "").split(/[,，、;；\s]+/)].map((s) => s.trim()).filter((s) => s.length >= 2);
        const termDomains = termDomainList(term);
        terms.forEach((other) => {
          if (other.id === term.id) return;
          if (!termDomains.some((d) => termHasDomain(other, d))) return;
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

    /* ===== 智能消费端应用模拟器：命中解释 + SQL 片段 + 词汇缺口 ===== */
    let simOverlayEl = null;

    function ensureSimDialog() {
      if (simOverlayEl) return;
      simOverlayEl = document.createElement("div");
      simOverlayEl.className = "term-form-overlay term-sim-overlay";
      simOverlayEl.id = "termAskSimOverlay";
      simOverlayEl.hidden = true;
      simOverlayEl.innerHTML = `
        <div class="term-form-modal term-sim-modal" role="dialog" aria-modal="true" aria-label="智能消费端应用模拟">
          <div class="term-form-head">
            <h3>智能消费端应用模拟 · 术语命中解释</h3>
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
        entry.title = "用一句自然语言模拟智能消费端应用解析，查看术语命中与 SQL 片段";
        syncBtn.before(entry);
        entry.addEventListener("click", openAskSimulation);
      }
    }

    function syncSimEntryLabel() {
      const entry = document.getElementById("termSimEntryBtn");
      if (!entry) return;
      const gaps = readVocabGaps();
      entry.textContent = gaps.length ? `智能消费端应用模拟（缺口 ${gaps.length}）` : "智能消费端应用模拟";
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
              const roleMap = { metric: "SELECT 聚合", dimension: "GROUP BY 分组", filter: "WHERE 过滤", field: "WHERE 过滤", entity: "JOIN 关联" };
              return `「${escapeHtml(h.term.name)}」是 <b style="color:${meta.color}">${meta.label}</b> → 进入 ${roleMap[meta.value]}`;
            })
            .join("；")}</span></div>`
        );
        const bindings = hits.flatMap((h) => (h.term.valueBindings || []).map((b) => ({ ...b, termName: h.term.name })));
        steps.push(
          `<div class="term-sim-step"><span class="no">3</span><span><b>值域绑定</b>：${
            bindings.length
              ? bindings.map((b) => `「${escapeHtml(b.termName)}」→ <b>${escapeHtml(valueBindingText(b))}</b>`).join("；")
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
      /* 验证查询优先：命中已确认问法则直接复用标准 SQL，不再让大模型现拼 */
      let verified = null;
      hits.forEach((h) => {
        const hit = matchVerifiedQuery(question, h.term);
        if (hit && (!verified || hit.score > verified.score)) {
          verified = { ...hit, termName: h.term.name };
        }
      });
      if (verified) {
        steps.push(
          `<div class="term-sim-step"><span class="no">★</span><span><b>验证查询命中</b>：与术语「${escapeHtml(verified.termName)}」下已确认问法「${escapeHtml(verified.item.question)}」相似度 <b>${Math.round(verified.score * 100)}%</b>，直接复用标准 SQL，不再现拼（降低幻觉）</span></div>`
        );
      }
      stepsEl.innerHTML = steps.join("");
      if (verified) {
        sqlEl.hidden = false;
        sqlEl.innerHTML = `<span class="kw">-- 复用已验证查询（${escapeHtml(verified.termName)}）</span>\n${escapeHtml(verified.item.sql)}`;
        return;
      }
      /* SQL 拼装（演示级） */
      const metricHit = hits.find((h) => h.term.termType === "metric");
      const filterHits = hits.filter((h) => ["filter", "dimension"].includes(h.term.termType) && (h.term.valueBindings || []).length);
      const dimensionHit = hits.find((h) => h.term.termType === "dimension");
      const wheres = [];
      filterHits.forEach((h) => (h.term.valueBindings || []).forEach((b) => wheres.push(valueBindingSql(b))));
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
        gapsEl.innerHTML = `<div class="term-sim-gapbar">⚠ 词汇缺口 ${gaps.length} 条：${gaps.map((g) => `「${escapeHtml(g)}」`).join(" ")}（已收进缺口清单，点击顶部「智能消费端应用模拟（缺口 n）」可追溯）</div>`;
      } else {
        gapsEl.innerHTML = "";
      }
    }

    /* 需求：确认步骤不能只有一个提示 —— 补一张摘要清单，导入前可核对关键信息 */
    function renderImportConfirm() {
      const el = document.getElementById("termImportConfirm");
      if (!el) return;
      const domains = [...selectedImportDomains];
      const mode = importModeEls().find((item) => item.checked)?.value || "create";
      const modeLabels = {
        create: "新增（重名失败）",
        upsert: "增量更新（同名更新，无则新增）",
        replace: "覆盖（清空所选数据域后再写入）",
      };
      const ok = validatedRows.filter((r) => r.status === "ok").length;
      const update = validatedRows.filter((r) => r.status === "update").length;
      const err = validatedRows.filter((r) => r.status === "error").length;
      const rows = [
        ["导入文件", escapeHtml(importSourceName || importSourceFile?.name || "—")],
        ["目标数据域", domains.length ? escapeHtml(domains.join("、")) : "—"],
        ["导入模式", modeLabels[mode] || mode],
        ["写入结果", `新增 ${ok} 个、更新 ${update} 个，跳过失败 ${err} 行`],
      ];
      if (mode === "replace") {
        rows.push(["风险提示", "将先清空所选数据域下的全部术语，引用这些术语的指标 / 字段解析会受影响"]);
      }
      el.innerHTML = rows.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("");
    }

    function setImportStep(step) {
      importStep = step;
      if (step === 4) renderImportConfirm();
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
      setImportModeCards();
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

    function setImportModeCards() {
      document.querySelectorAll(".term-import-mode").forEach((wrap) => {
        wrap.classList.toggle("is-checked", Boolean(wrap.querySelector("input:checked")));
      });
    }

    function renderImportPreview() {
      const ok = validatedRows.filter((r) => r.status === "ok").length;
      const update = validatedRows.filter((r) => r.status === "update").length;
      const err = validatedRows.filter((r) => r.status === "error").length;
      if (importSummaryEl) {
        importSummaryEl.textContent = `共 ${validatedRows.length} 行：可新增 ${ok}，将更新 ${update}，失败 ${err}`;
      }
      /* 需求：预览页顶部用统计卡承载结果，避免只有一行文字不好扫读 */
      const stat = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      };
      stat("termImportStatTotal", validatedRows.length);
      stat("termImportStatPass", ok + update);
      stat("termImportStatErr", err);
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
    /* 导入模式卡片：跟随 radio 勾选切换高亮（兼容不支持 :has() 的环境） */
    importModeEls().forEach((el) => el.addEventListener("change", setImportModeCards));
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
        setTip(item.online !== false ? `术语「${item.name}」已上线` : `术语「${item.name}」已下线`);
      }
      if (action === "delete") {
        /* 需求：只有下线状态才允许删除，上线时按钮已置灰，这里再做一层拦截 */
        if (isTermOnline(item)) {
          setTip(`术语「${item.name}」处于上线状态，下线后才可删除`);
          return;
        }
        /* 需求：术语上线 / 下线都允许删除；删除前统一走「影响分析 + 风险自担」弹窗（由 index.html 提供），
           弹窗不存在时回退到原生确认，保证单文件调用也能用 */
        if (typeof global.openTermDeleteModal === "function") {
          global.openTermDeleteModal([id]);
          return;
        }
        if (!window.confirm(`确定删除术语「${item.name}」吗？\n该术语${duplicateRefSummary(item)}，删除后指标/字段上的对应挂载引用将一并失效。`)) return;
        deleteByIds([id]);
        setTip(`已删除术语：${item.name}`);
      }
    });
    formSaveBtnEl?.addEventListener("click", () => saveForm(false));
    formCancelBtnEl?.addEventListener("click", closeForm);
    formCloseBtnEl?.addEventListener("click", closeForm);
    /* ===== 术语详情二级页面：交互 ===== */
    legacyCloseBtnEl?.addEventListener("click", closeDetailLegacy);
    detailBackBtnEl?.addEventListener("click", closeDetail);
    detailEditBtnEl?.addEventListener("click", () => {
      const term = detailTerm();
      if (term) openForm(term);
    });
    detailMountBtnEl?.addEventListener("click", () => {
      if (!MOUNT_ENTRY_ENABLED) return;
      if (detailTermId) openMountDialog(detailTermId);
    });
    /* 需求：挂载资产入口暂不启用 → 详情页按钮直接隐藏（恢复只需把 MOUNT_ENTRY_ENABLED 改为 true） */
    if (!MOUNT_ENTRY_ENABLED && detailMountBtnEl) {
      detailMountBtnEl.hidden = true;
      detailMountBtnEl.style.display = "none";
      detailMountBtnEl.setAttribute("aria-hidden", "true");
    }
    detailOnlineBtnEl?.addEventListener("click", () => {
      const term = detailTerm();
      if (!term) return;
      term.online = term.online === false;
      writeTerms(terms);
      renderDetailView();
      setTip(term.online !== false ? `术语「${term.name}」已上线` : `术语「${term.name}」已下线`);
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

    /* 智能消费端应用演示种子：让「智能消费端应用模拟」开箱即可演示完整的多态路由链路 */
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

    /* ===== 术语 → 语义桥（智能消费端应用运行时消费） =====
       对应「术语绑定」的三类信息：
         概念绑定 = termType + mounts（术语锚定到指标/维度/字段/模型）
         值绑定   = valueBindings（枚举值集 / 条件表达式）
         层级关系 = parentId / children（智能消费端应用可上卷或展开） */
    function termBridgeEntry(term) {
      const meta = termTypeMeta(term.termType);
      const parent = term.parentTermId ? terms.find((t) => t.id === term.parentTermId) : null;
      return {
        id: `bm-term-${term.id}`,
        termId: term.id,
        name: term.name || "",
        type: meta.value,
        typeLabel: meta.label,
        typeDesc: meta.desc,
        synonyms: String(term.synonyms || "")
          .split(/[,，]/)
          .map((v) => v.trim())
          .filter(Boolean),
        description: term.description || "",
        domains: termDomainList(term),
        domain: term.domain || "",
        modelNames: termModelList(term),
        project: term.project || currentProject(),
        online: term.online !== false,
        parentId: parent ? `bm-term-${parent.id}` : "",
        parentName: parent?.name || "",
        children: terms
          .filter((t) => t.parentTermId === term.id)
          .map((t) => ({ id: `bm-term-${t.id}`, name: t.name })),
        valueBindings: (term.valueBindings || []).map((b) => ({
          mode: vbMode(b.mode).value,
          field: b.field || "",
          op: b.op || "=",
          value: b.value || "",
          values: b.values || [],
          aliases: b.aliases || [],
          text: valueBindingText(b),
          sql: valueBindingSql(b),
        })),
        mounts: (term.mounts || []).map((m) => ({
          type: m.type || "",
          name: m.name || "",
          path: m.path || "",
          meta: m.meta || "",
        })),
        verifiedQueries: (term.verifiedQueries || []).map((q) => ({
          question: q.question || "",
          sql: q.sql || "",
        })),
        source: "business-modeling",
        updatedAt: global.SemanticBridge?.nowStamp?.() || formatDate(),
      };
    }

    function pushTermsToBridge(list) {
      const bridge = global.SemanticBridge;
      if (!bridge || typeof bridge.replaceTerms !== "function") return 0;
      try {
        const payload = (list || []).map(termBridgeEntry);
        bridge.replaceTerms(payload);
        return payload.length;
      } catch (_err) {
        return 0;
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
    /* 术语变更即下发语义桥：智能消费端应用侧才能拿到最新的类型 / 值域 / 层级 / 上下线状态 */
    try {
      global.addEventListener("biz-terms-updated", (event) => {
        pushTermsToBridge(Array.isArray(event.detail) ? event.detail : terms);
      });
    } catch (_err) {
      /* ignore */
    }
    render();
    /* 首次加载即灌一次，避免「先点同步才有数据」 */
    pushTermsToBridge(terms);

    /* ===== 批量设置关联：按所选「挂载类型」在数据域内自动推荐匹配资源 =====
       挂载类型多选（模型 / 数据集 / 字段 / 指标 / 维度），只在勾选的类型里匹配 */
    const BATCH_MOUNT_TYPES = [
      { value: "model", label: "模型", desc: "业务模型节点" },
      { value: "dataset", label: "数据集", desc: "模型下的数据集" },
      { value: "field", label: "字段", desc: "数据集下的字段" },
      { value: "metric", label: "指标", desc: "已发布的业务指标" },
      { value: "dimension", label: "维度", desc: "可作分组维度的字段" },
    ];
    const BATCH_MOUNT_ORDER = BATCH_MOUNT_TYPES.reduce((acc, t, index) => ({ ...acc, [t.value]: index }), {});
    /* 名称命中最多取 5 条；没命中时按所选类型兜底取 3 条 */
    const BATCH_HIT_LIMIT = 5;
    const BATCH_FALLBACK_LIMIT = 3;
    /* 匹配规则：与 recommendAssetsForTerm 的实现一一对应，弹窗里原样展示给用户 */
    const BATCH_MATCH_RULES = [
      "精确命中：术语名称或同义词与资源名称完全一致，优先推荐",
      "包含命中：资源名包含术语名（或术语名包含资源名）次之，同义词包含再次之",
      `类型兜底：都没命中时，按勾选的挂载类型取该数据域下的同类资源，每类最多 ${BATCH_FALLBACK_LIMIT} 个`,
      `数量上限：单条术语最多推荐 ${BATCH_HIT_LIMIT} 个资源，已挂载过的资源自动跳过`,
    ];

    /* 推荐范围：优先当前术语库的数据域（即「目前所选数据域」），无库域时回退到所选术语自身的数据域 */
    function batchScopeDomains(ids) {
      const idSet = new Set(ids || []);
      const glossaryDomain = currentGlossaryInfo()?.domain || "";
      if (glossaryDomain) return [glossaryDomain];
      const picked = new Set();
      terms.forEach((t) => {
        if (!idSet.has(t.id)) return;
        termDomainList(t).forEach((d) => picked.add(d));
      });
      return [...picked];
    }

    /* 该数据域下的全部候选资源：模型 + 数据集（结构语义模型 datasets）+ 字段 + 维度（来自模型字段）+ 指标 */
    function batchDomainAssets(domains) {
      const domainSet = new Set(domains || []);
      const assets = [];
      const models = domainSet.size ? modelsForDomains([...domainSet]) : listBusinessModels();
      /* 模型：与术语表单「关联资产 → 模型」页签同一口径 */
      models.forEach((model) => {
        assets.push({ key: `model:${model.name}`, type: "model", name: model.name, path: model.domain || "模型" });
      });
      try {
        const store = global.SemanticBridge?.ensureSeed?.();
        (store?.models || []).forEach((model) => {
          if (domainSet.size && model.domain && !domainSet.has(model.domain)) return;
          (model.datasets || []).forEach((ds) => {
            assets.push({
              key: `dataset:${ds.id || ds.name}`,
              type: "dataset",
              name: ds.name || ds.id || "",
              path: model.name || "",
            });
          });
        });
      } catch (_err) {
        /* ignore */
      }
      const dimOwners = new Map();
      models.forEach((model) => {
        (model.fieldNames || []).forEach((fieldName) => {
          assets.push({ key: `field:${model.name}|${fieldName}`, type: "field", name: fieldName, path: model.name });
          if (!MOUNT_MEASURE_NAME_RE.test(fieldName)) {
            if (!dimOwners.has(fieldName)) dimOwners.set(fieldName, new Set());
            dimOwners.get(fieldName).add(model.name);
          }
        });
      });
      [...dimOwners].forEach(([name, owners]) => {
        assets.push({ key: `dimension:${name}`, type: "dimension", name, path: [...owners].join("、") });
      });
      (global.MetricModule?.readMetrics?.() || []).forEach((metric) => {
        if (domainSet.size && !domainSet.has(metric.domain || "")) return;
        assets.push({
          key: `metric:${metric.id || metric.name}`,
          type: "metric",
          name: metric.name,
          path: metric.domain || "",
          meta: metric.code || "",
        });
      });
      return assets;
    }

    /* 术语名 / 同义词 与资产名的匹配强度：3 完全一致、2 互相包含、1 同义词包含、0 不命中 */
    function batchNameScore(term, assetName) {
      const name = String(term?.name || "").trim();
      const target = String(assetName || "").trim();
      if (!name || !target) return 0;
      if (name === target) return 3;
      if (target.includes(name) || name.includes(target)) return 2;
      const synonyms = String(term.synonyms || "")
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (synonyms.includes(target)) return 3;
      if (synonyms.some((s) => target.includes(s) || s.includes(target))) return 1;
      return 0;
    }

    /* 按勾选的挂载类型（types 数组，空则不限）在该术语未挂载过的资源里推荐：
       先按名称/同义词命中，没命中再按所选类型兜底 */
    function recommendAssetsForTerm(term, assets, types) {
      if (!term) return [];
      const want = new Set((types || []).filter(Boolean));
      const existing = new Set((term.mounts || []).map((m) => m.key));
      const pool = assets.filter((asset) => !existing.has(asset.key) && (!want.size || want.has(asset.type)));
      const byType = (a, b) => (BATCH_MOUNT_ORDER[a.type] ?? 99) - (BATCH_MOUNT_ORDER[b.type] ?? 99);
      const hits = pool
        .filter((asset) => batchNameScore(term, asset.name) > 0)
        .sort((a, b) => batchNameScore(term, b.name) - batchNameScore(term, a.name) || byType(a, b));
      if (hits.length) return hits.slice(0, BATCH_HIT_LIMIT);
      /* 兜底：按挂载类型分组，每类各取最多 BATCH_FALLBACK_LIMIT 个（勾选几类就有几类） */
      const fallback = [];
      BATCH_MOUNT_TYPES.forEach((typeDef) => {
        if (want.size && !want.has(typeDef.value)) return;
        fallback.push(...pool.filter((asset) => asset.type === typeDef.value).slice(0, BATCH_FALLBACK_LIMIT));
      });
      return fallback.sort(byType);
    }

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
      /* ===== 批量设置关联：挂载类型多选 + 自动推荐匹配资源 ===== */
      getMountTypeOptions: () => BATCH_MOUNT_TYPES.map((t) => ({ ...t })),
      /* 匹配规则原文（弹窗直接展示，保证与推荐算法一致） */
      getBatchMatchRules: () => [...BATCH_MATCH_RULES],
      previewBatchMount(ids, types) {
        const idSet = new Set(ids || []);
        const domains = batchScopeDomains(ids);
        const assets = batchDomainAssets(domains);
        const counts = { model: 0, dataset: 0, field: 0, metric: 0, dimension: 0 };
        assets.forEach((a) => {
          if (counts[a.type] !== undefined) counts[a.type] += 1;
        });
        const items = terms
          .filter((t) => idSet.has(t.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
            assets: recommendAssetsForTerm(t, assets, types),
          }));
        return { domains, counts, items, total: assets.length };
      },
      /* 后台批量关联：按 plan 逐条写入资产挂载，返回本次新增数（已挂过的 key 会跳过） */
      batchApplyMounts(planMap) {
        let added = 0;
        Object.keys(planMap || {}).forEach((id) => {
          const term = terms.find((t) => t.id === id);
          if (!term) return;
          const list = Array.isArray(planMap[id]) ? planMap[id] : [];
          if (!list.length) return;
          const existing = new Map((term.mounts || []).map((m) => [m.key, m]));
          const prevMetricKeys = [...existing.keys()].filter((k) => k.startsWith("metric:"));
          list.forEach((asset) => {
            if (existing.has(asset.key)) return;
            existing.set(asset.key, {
              key: asset.key,
              type: asset.type,
              name: asset.name,
              path: asset.path || "",
              meta: asset.meta || "",
            });
            added += 1;
          });
          term.mounts = [...existing.values()];
          /* 指标侧双写，与行内挂载弹窗同一口径 */
          syncMetricTermLinks(
            prevMetricKeys,
            term.mounts.filter((m) => m.type === "metric").map((m) => m.key),
            term.id
          );
        });
        if (added) {
          writeTerms(terms);
          render();
        }
        return added;
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
      /* 需求：术语列表「数据域」下拉支持多选 —— value 可为字符串或数组（数组内满足任一即展示） */
      setDomainFilter(value) {
        domainFilter = Array.isArray(value) ? value.filter(Boolean) : value || "";
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
      syncTermsToBridge: () => pushTermsToBridge(terms),
      toBridgePayload: () => terms.map(termBridgeEntry),
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
