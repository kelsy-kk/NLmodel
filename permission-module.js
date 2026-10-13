/**
 * 语义建模 · 权限（按工程 · 逐条策略：角色 + 模型 + 可选行权限）
 */
(function (global) {
  const POLICY_KEY = "glodon.semantic-role-policies.v4";
  const LEGACY_POLICY_KEYS = ["glodon.semantic-role-policies.v3", "glodon.semantic-role-policies.v2"];
  const USER_KEY = "glodon.semantic-current-user.v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const UNIFIED_ORG_FIELD = "org_id";
  const UNIFIED_TENANT_FIELD = "tenant_id";
  const MODEL_ROW_FILTER_KEY = "glodon.model-row-filters.v1";
  const ALL_MODELS_KEY = "*";

  const ROW_FILTER_MODE = {
    NONE: "NONE",
    FIXED_VALUE: "FIXED_VALUE",
    USER_ATTRIBUTE: "USER_ATTRIBUTE",
  };

  const USER_ATTRIBUTE_OPTIONS = [
    { value: "org_id", label: "org_id（组织）" },
    { value: "tenant_id", label: "tenant_id（租户）" },
  ];

  const DEFAULT_PROJECTS = ["pmlead-市场指标", "pmlead-成本指标", "pmlead-通用AI", "数据工具链"];

  const PLATFORM_ROLES = [
    { code: "data_admin", name: "数据管理员", desc: "工程内全部模型；不启用行权限" },
    { code: "sales_staff", name: "销售专员", desc: "按工程逐条授权模型；可选 org_id 行权限" },
    { code: "sales_manager", name: "销售经理", desc: "按工程逐条授权模型；可选 org_id 含下级" },
    { code: "region_manager", name: "区域经理", desc: "按工程逐条授权模型；可选固定 org 列表" },
    { code: "semantic_viewer", name: "语义查看者", desc: "按工程逐条授权模型；可选固定字段值" },
  ];

  const ORG_TREE = [
    {
      id: "org_group",
      name: "广联达集团",
      tenant_id: "t001",
      children: [
        {
          id: "org_sales_east",
          name: "华东销售区",
          children: [
            { id: "org_sales_dept_03", name: "上海销售三部" },
            { id: "org_sales_dept_04", name: "上海销售四部" },
          ],
        },
        {
          id: "org_revenue_hq",
          name: "收入管理总部",
          children: [{ id: "org_revenue_ops", name: "收入运营组" }],
        },
      ],
    },
  ];

  const DEMO_USERS = [
    {
      id: "user_admin",
      name: "张管理",
      tenant_id: "t001",
      org_id: "org_group",
      org_name: "广联达集团",
      roles: ["data_admin"],
    },
    {
      id: "user_sales_03",
      name: "李销售",
      tenant_id: "t001",
      org_id: "org_sales_dept_03",
      org_name: "上海销售三部",
      roles: ["sales_staff"],
    },
    {
      id: "user_sales_mgr",
      name: "王经理",
      tenant_id: "t001",
      org_id: "org_sales_east",
      org_name: "华东销售区",
      roles: ["sales_manager"],
    },
    {
      id: "user_region_mgr",
      name: "赵区域",
      tenant_id: "t001",
      org_id: "org_revenue_hq",
      org_name: "收入管理总部",
      roles: ["region_manager"],
    },
    {
      id: "user_dataset",
      name: "陈分析",
      tenant_id: "t001",
      org_id: "org_revenue_ops",
      org_name: "收入运营组",
      roles: ["semantic_viewer"],
    },
  ];

  const DEFAULT_MODEL_ROW_FILTERS = {
    分包结算口径模型: {
      filterField: "biz_line_code",
      filterLabel: "业务线编码",
      fixedValues: ["BL_EAST", "BL_SOUTH", "BL_NORTH"],
    },
    收入字段术语挂载模型: {
      filterField: "biz_line_code",
      filterLabel: "业务线编码",
      fixedValues: ["BL_EAST", "BL_SOUTH", "BL_NORTH"],
    },
    __default__: {
      filterField: "biz_line_code",
      filterLabel: "业务线编码",
      fixedValues: ["BL_EAST", "BL_SOUTH", "BL_NORTH"],
    },
  };

  const DEFAULT_POLICIES = [
    {
      id: "pol_admin_mkt",
      project: "pmlead-市场指标",
      roleCode: "data_admin",
      modelKey: ALL_MODELS_KEY,
      domain: "",
      rowPermissionEnabled: false,
      rowFilterMode: ROW_FILTER_MODE.NONE,
      filterField: "",
      fixedValues: [],
      userAttribute: "",
      includeSubOrgs: false,
      enabled: true,
    },
    {
      id: "pol_sales_settle",
      project: "pmlead-市场指标",
      roleCode: "sales_staff",
      modelKey: "分包结算口径模型",
      domain: "收入管理",
      rowPermissionEnabled: true,
      rowFilterMode: ROW_FILTER_MODE.USER_ATTRIBUTE,
      filterField: "org_id",
      fixedValues: [],
      userAttribute: "org_id",
      includeSubOrgs: false,
      enabled: true,
    },
    {
      id: "pol_sales_rev",
      project: "pmlead-市场指标",
      roleCode: "sales_staff",
      modelKey: "收入字段术语挂载模型",
      domain: "收入管理",
      rowPermissionEnabled: false,
      rowFilterMode: ROW_FILTER_MODE.NONE,
      filterField: "",
      fixedValues: [],
      userAttribute: "",
      includeSubOrgs: false,
      enabled: true,
    },
    {
      id: "pol_mgr_settle",
      project: "pmlead-市场指标",
      roleCode: "sales_manager",
      modelKey: "分包结算口径模型",
      domain: "收入管理",
      rowPermissionEnabled: true,
      rowFilterMode: ROW_FILTER_MODE.USER_ATTRIBUTE,
      filterField: "org_id",
      fixedValues: [],
      userAttribute: "org_id",
      includeSubOrgs: true,
      enabled: true,
    },
    {
      id: "pol_region_cost",
      project: "pmlead-成本指标",
      roleCode: "region_manager",
      modelKey: "项目成本归集模型",
      domain: "成本管理",
      rowPermissionEnabled: true,
      rowFilterMode: ROW_FILTER_MODE.FIXED_VALUE,
      filterField: "org_id",
      fixedValues: ["org_sales_dept_03", "org_sales_dept_04"],
      userAttribute: "",
      includeSubOrgs: false,
      enabled: true,
    },
    {
      id: "pol_viewer_rev",
      project: "pmlead-市场指标",
      roleCode: "semantic_viewer",
      modelKey: "收入字段术语挂载模型",
      domain: "收入管理",
      rowPermissionEnabled: true,
      rowFilterMode: ROW_FILTER_MODE.FIXED_VALUE,
      filterField: "biz_line_code",
      fixedValues: ["BL_EAST"],
      userAttribute: "",
      includeSubOrgs: false,
      enabled: true,
    },
  ];

  let scopeCache = null;
  let scopeCacheAt = 0;
  let depsGetCurrentProject = () => DEFAULT_PROJECTS[0];
  let depsCollectModelCatalog = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function flattenOrgs(nodes, acc = []) {
    nodes.forEach((node) => {
      acc.push({ id: node.id, name: node.name, tenant_id: node.tenant_id || "t001" });
      if (node.children?.length) flattenOrgs(node.children, acc);
    });
    return acc;
  }

  const ALL_ORGS = flattenOrgs(ORG_TREE);

  function findOrgNode(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node;
      const hit = findOrgNode(node.children || [], id);
      if (hit) return hit;
    }
    return null;
  }

  function collectOrgChildren(rootId) {
    function walk(node, bag) {
      bag.push(node.id);
      (node.children || []).forEach((child) => walk(child, bag));
    }
    const root = findOrgNode(ORG_TREE, rootId);
    if (!root) return [rootId];
    const bag = [];
    walk(root, bag);
    return bag;
  }

  function newPolicyId() {
    return `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function migrateLegacyRolePolicies(stored) {
    if (!Array.isArray(stored) || !stored.length) return null;
    if (stored[0]?.project !== undefined && stored[0]?.modelKey !== undefined) return stored;
    const project = DEFAULT_PROJECTS[0];
    const modelKeys = ["分包结算口径模型", "收入字段术语挂载模型", "项目成本归集模型"];
    const domainMap = {
      分包结算口径模型: "收入管理",
      收入字段术语挂载模型: "收入管理",
      项目成本归集模型: "成本管理",
    };
    return stored.flatMap((raw) => {
      const policy = migrateLegacyPolicy(raw);
      if (policy.roleCode === "data_admin") {
        return [
          {
            id: newPolicyId(),
            project,
            roleCode: policy.roleCode,
            modelKey: ALL_MODELS_KEY,
            domain: "",
            rowPermissionEnabled: false,
            rowFilterMode: ROW_FILTER_MODE.NONE,
            filterField: "",
            fixedValues: [],
            userAttribute: "",
            includeSubOrgs: false,
          },
        ];
      }
      return modelKeys.slice(0, policy.roleCode === "region_manager" ? 3 : 2).map((modelKey) => ({
        id: newPolicyId(),
        project: policy.roleCode === "region_manager" ? "pmlead-成本指标" : project,
        roleCode: policy.roleCode,
        modelKey,
        domain: domainMap[modelKey] || "",
        rowPermissionEnabled: policy.rowPermissionEnabled,
        rowFilterMode: policy.rowFilterMode,
        filterField: policy.filterField,
        fixedValues: policy.fixedValues,
        userAttribute: policy.userAttribute,
        includeSubOrgs: policy.includeSubOrgs,
      }));
    });
  }

  function readPolicies() {
    let stored = readJson(POLICY_KEY, null);
    if (!stored?.length) {
      for (const legacyKey of LEGACY_POLICY_KEYS) {
        const legacy = readJson(legacyKey, null);
        const migrated = migrateLegacyRolePolicies(legacy);
        if (migrated?.length) {
          stored = migrated;
          writeJson(POLICY_KEY, stored);
          break;
        }
      }
    }
    if (!stored?.length) {
      writeJson(POLICY_KEY, DEFAULT_POLICIES);
      return DEFAULT_POLICIES.map((p) => normalizePolicy({ ...p }));
    }
    return stored.map((p) => normalizePolicy(p));
  }

  function writePolicies(policies) {
    writeJson(POLICY_KEY, policies);
    invalidateScopeCache();
    global.dispatchEvent(new CustomEvent("biz-data-scope-changed"));
  }

  function readModelRowFilters() {
    const stored = readJson(MODEL_ROW_FILTER_KEY, null);
    if (!stored) {
      writeJson(MODEL_ROW_FILTER_KEY, DEFAULT_MODEL_ROW_FILTERS);
      return { ...DEFAULT_MODEL_ROW_FILTERS };
    }
    return stored;
  }

  function writeModelRowFilters(map) {
    writeJson(MODEL_ROW_FILTER_KEY, map);
    invalidateScopeCache();
    global.dispatchEvent(new CustomEvent("biz-data-scope-changed"));
  }

  function getModelRowFilter(modelKey) {
    const key = String(modelKey || "").trim();
    if (!key) return null;
    const map = readModelRowFilters();
    return map[key] || map.__default__ || null;
  }

  function upsertModelRowFilter(modelKey, config) {
    const key = String(modelKey || "").trim();
    if (!key) return;
    const map = readModelRowFilters();
    map[key] = {
      filterField: String(config.filterField || "biz_line_code").trim(),
      filterLabel: String(config.filterLabel || config.filterField || "行权限字段").trim(),
      fixedValues: Array.isArray(config.fixedValues)
        ? config.fixedValues.map((v) => String(v).trim()).filter(Boolean)
        : String(config.fixedValues || "")
            .split(/[,，;；\s]+/)
            .map((v) => v.trim())
            .filter(Boolean),
    };
    writeModelRowFilters(map);
  }

  function migrateLegacyPolicy(raw) {
    if (raw.rowPermissionEnabled !== undefined && raw.rowFilterMode) return raw;
    const policy = { ...raw };
    policy.rowPermissionEnabled = false;
    policy.rowFilterMode = ROW_FILTER_MODE.NONE;
    policy.filterField = policy.filterField || policy.datasetFilterField || policy.orgField || "org_id";
    policy.fixedValues = Array.isArray(policy.fixedValues)
      ? policy.fixedValues
      : policy.datasetFixedValues || policy.fixedOrgIds || [];
    policy.userAttribute = policy.userAttribute || "org_id";
    policy.includeSubOrgs = !!policy.includeSubOrgs;

    if (policy.rowFilterSource === "DATASET_FIELD" && policy.datasetFixedValues?.length) {
      policy.rowPermissionEnabled = true;
      policy.rowFilterMode = ROW_FILTER_MODE.FIXED_VALUE;
      policy.filterField = policy.datasetFilterField || "biz_line_code";
      policy.fixedValues = policy.datasetFixedValues;
    } else if (policy.orgScopeType && policy.orgScopeType !== "ALL") {
      policy.rowPermissionEnabled = true;
      if (policy.orgScopeType === "FIXED_LIST") {
        policy.rowFilterMode = ROW_FILTER_MODE.FIXED_VALUE;
        policy.filterField = "org_id";
        policy.fixedValues = policy.fixedOrgIds || [];
      } else {
        policy.rowFilterMode = ROW_FILTER_MODE.USER_ATTRIBUTE;
        policy.filterField = "org_id";
        policy.userAttribute = "org_id";
      }
    }
    return policy;
  }

  function normalizePolicy(policy) {
    const base = migrateLegacyPolicy(policy);
    const rowPermissionEnabled = !!base.rowPermissionEnabled;
    let rowFilterMode = base.rowFilterMode || ROW_FILTER_MODE.NONE;
    if (!rowPermissionEnabled) rowFilterMode = ROW_FILTER_MODE.NONE;
    return {
      id: base.id || newPolicyId(),
      project: String(base.project || DEFAULT_PROJECTS[0]).trim(),
      roleCode: base.roleCode,
      modelKey: String(base.modelKey || ALL_MODELS_KEY).trim(),
      domain: String(base.domain || "").trim(),
      rowPermissionEnabled,
      rowFilterMode,
      filterField: String(base.filterField || "").trim(),
      fixedValues: Array.isArray(base.fixedValues)
        ? base.fixedValues.map((v) => String(v).trim()).filter(Boolean)
        : [],
      userAttribute: String(base.userAttribute || "org_id").trim(),
      includeSubOrgs: !!base.includeSubOrgs,
      enabled: base.enabled !== false,
    };
  }

  function resolveUserAttributeValues(user, attribute, includeSubOrgs) {
    const attr = attribute || "org_id";
    const raw = user[attr];
    if (raw === undefined || raw === null || raw === "") return [];
    const value = String(raw);
    if (includeSubOrgs && attr === "org_id") {
      return collectOrgChildren(value);
    }
    return [value];
  }

  function buildRowFilters(user, matchedPolicies) {
    const byField = new Map();

    matchedPolicies.forEach((policy) => {
      if (!policy.rowPermissionEnabled) return;

      if (policy.rowFilterMode === ROW_FILTER_MODE.FIXED_VALUE) {
        const field = policy.filterField;
        if (!field || !policy.fixedValues?.length) return;
        mergeFieldFilter(byField, field, policy.fixedValues, {
          mode: ROW_FILTER_MODE.FIXED_VALUE,
        });
        return;
      }

      if (policy.rowFilterMode === ROW_FILTER_MODE.USER_ATTRIBUTE) {
        const field = policy.filterField || policy.userAttribute || "org_id";
        const values = resolveUserAttributeValues(user, policy.userAttribute, policy.includeSubOrgs);
        if (!field || !values.length) return;
        mergeFieldFilter(byField, field, values, {
          mode: ROW_FILTER_MODE.USER_ATTRIBUTE,
          userAttribute: policy.userAttribute || "org_id",
        });
      }
    });

    return [...byField.values()]
      .filter((f) => f.values.length)
      .map((f) => ({ ...f, op: "IN" }));
  }

  function mergeFieldFilter(map, field, values, meta) {
    const uniq = [...new Set(values.map(String))];
    const existing = map.get(field);
    if (!existing) {
      map.set(field, { field, values: uniq, ...meta });
      return;
    }
    existing.values = existing.values.filter((v) => uniq.includes(v));
    existing.mode = existing.mode === meta.mode ? existing.mode : "INTERSECT";
  }

  function rowFilterSummary(rowFilters) {
    if (!rowFilters.length) return "未启用";
    return rowFilters
      .map((f) => {
        if (f.mode === ROW_FILTER_MODE.USER_ATTRIBUTE) {
          return `${f.field} = 用户.${f.userAttribute || "org_id"}${f.values.length > 1 ? `（含 ${f.values.length} 个值）` : ""}`;
        }
        return `${f.field} = 固定值 [${f.values.join(", ")}]`;
      })
      .join(" · ");
  }

  function getCurrentUser() {
    const id = readJson(USER_KEY, DEMO_USERS[0].id);
    return DEMO_USERS.find((u) => u.id === id) || DEMO_USERS[0];
  }

  function setCurrentUser(userId) {
    writeJson(USER_KEY, userId);
    invalidateScopeCache();
    global.dispatchEvent(new CustomEvent("biz-data-scope-changed"));
  }

  function invalidateScopeCache() {
    scopeCache = null;
    scopeCacheAt = 0;
  }

  function getActiveProject(context = {}) {
    return String(context.project ?? depsGetCurrentProject() ?? DEFAULT_PROJECTS[0]).trim();
  }

  function normalizePreviewProject(project, fallbackProject = DEFAULT_PROJECTS[0]) {
    const raw = String(project ?? "").trim();
    if (!raw || raw === "全部工程") return fallbackProject;
    return raw;
  }

  function collectModelCatalog(projectFilter = "") {
    if (typeof depsCollectModelCatalog === "function") {
      return depsCollectModelCatalog(projectFilter);
    }
    const rows = document.querySelectorAll("#businessListBody tr");
    return Array.from(rows)
      .filter((row) => {
        const type = row.dataset.listType || "";
        return type === "域模型" || type === "基础模型";
      })
      .map((row) => ({
        name: row.dataset.listName || "",
        domain: row.dataset.domain || "",
        project: row.dataset.project || "",
        type: row.dataset.listType || "",
      }))
      .filter((m) => {
        if (!m.name) return false;
        if (!projectFilter) return true;
        return !m.project || m.project === projectFilter;
      });
  }

  function policiesForUser(user, project) {
    return readPolicies().filter(
      (p) => p.enabled !== false && user.roles.includes(p.roleCode) && p.project === project
    );
  }

  function resolveDataScope(forceRefresh = false, context = {}) {
    const now = Date.now();
    const project = getActiveProject(context);
    const modelKey = context.modelKey || "";
    const cacheKey = `${project}:${modelKey}:${getCurrentUser().id}`;
    if (
      !forceRefresh &&
      scopeCache &&
      scopeCache._cacheKey === cacheKey &&
      now - scopeCacheAt < CACHE_TTL_MS
    ) {
      return scopeCache;
    }

    const user = getCurrentUser();
    const matched = policiesForUser(user, project);

    if (!matched.length) {
      scopeCache = {
        denied: true,
        user,
        project,
        allowedDomains: [],
        allowedModels: [],
        allDomains: false,
        allModels: false,
        allowedOrgIds: [],
        allOrgs: false,
        rowFilter: null,
        rowFilters: [],
        orgField: UNIFIED_ORG_FIELD,
        tenantField: UNIFIED_TENANT_FIELD,
        tenantId: user.tenant_id,
        modelKey,
        summary: `无匹配策略（工程「${project}」），已拒绝访问`,
        _cacheKey: cacheKey,
      };
      scopeCacheAt = now;
      return scopeCache;
    }

    const allModels = matched.some((p) => p.modelKey === ALL_MODELS_KEY);
    const allowedModels = allModels
      ? [ALL_MODELS_KEY]
      : [...new Set(matched.map((p) => p.modelKey).filter((k) => k && k !== ALL_MODELS_KEY))];
    const allowedDomains = allModels
      ? []
      : [...new Set(matched.map((p) => p.domain).filter(Boolean))];
    const allDomains = allModels;

    let rowFilterPolicies = matched;
    if (modelKey) {
      rowFilterPolicies = matched.filter((p) => p.modelKey === modelKey || p.modelKey === ALL_MODELS_KEY);
    } else {
      rowFilterPolicies = [];
    }
    const rowFilters = buildRowFilters(user, rowFilterPolicies);
    const orgFilter = rowFilters.find((f) => f.field === "org_id");
    const allOrgs = !rowFilters.length;
    const allowedOrgIds = orgFilter?.values || [];

    const rowFilter =
      rowFilters.length === 1
        ? { ...rowFilters[0], tenantField: UNIFIED_TENANT_FIELD, tenantId: user.tenant_id }
        : rowFilters.length
          ? {
              op: "AND",
              tenantField: UNIFIED_TENANT_FIELD,
              tenantId: user.tenant_id,
              filters: rowFilters,
            }
          : { op: "ALL", tenantField: UNIFIED_TENANT_FIELD, tenantId: user.tenant_id };

    scopeCache = {
      denied: false,
      user,
      project,
      matchedPolicies: matched,
      matchedRoles: [...new Set(matched.map((p) => p.roleCode))],
      allowedDomains,
      allowedModels,
      allDomains,
      allModels,
      allowedOrgIds,
      allOrgs,
      rowFilter,
      rowFilters,
      orgField: orgFilter?.field || UNIFIED_ORG_FIELD,
      tenantField: UNIFIED_TENANT_FIELD,
      tenantId: user.tenant_id,
      modelKey,
      modelRowFilter: getModelRowFilter(modelKey),
      summary: buildScopeSummary({
        project,
        allDomains,
        allModels,
        allowedDomains,
        allowedModels,
        user,
        rowFilters,
      }),
      cachedAt: now,
      _cacheKey: cacheKey,
    };
    scopeCacheAt = now;
    return scopeCache;
  }

  function buildScopeSummary(scope) {
    const domainText = scope.allDomains
      ? "全部数据域"
      : scope.allowedDomains.join("、") || "无数据域";
    const modelText = scope.allModels
      ? "全部模型"
      : scope.allowedModels.join("、") || "无模型";
    const rowText = rowFilterSummary(scope.rowFilters || []);
    const rowPart = rowText === "未启用" ? "行权限未启用" : `行权限 ${rowText}`;
    return `工程「${scope.project}」· ${scope.user.name}：可见域 [${domainText}] · 可见模型 [${modelText}] · ${rowPart}`;
  }

  function splitDomains(value) {
    if (Array.isArray(value)) return value.map((d) => String(d).trim()).filter(Boolean);
    return String(value || "")
      .split(/[、,，]/)
      .map((d) => d.trim())
      .filter(Boolean);
  }

  function canAccessDomain(domainOrList, context = {}) {
    const scope = resolveDataScope(false, context);
    if (scope.denied) return false;
    if (scope.allDomains) return true;
    const domains = splitDomains(domainOrList);
    if (!domains.length) return true;
    return domains.some((d) => scope.allowedDomains.includes(d));
  }

  function canAccessModel(modelKey, projectOrContext) {
    const context =
      typeof projectOrContext === "object" && projectOrContext !== null
        ? projectOrContext
        : { project: projectOrContext };
    const scope = resolveDataScope(false, { ...context, modelKey: modelKey || context.modelKey });
    if (scope.denied) return false;
    if (scope.allModels) return true;
    const key = String(modelKey || "").trim();
    if (!key) return false;
    return scope.allowedModels.includes(key);
  }

  function rowMatchesScopeFilters(row, rowFilters, tenantId) {
    const tenant = row[UNIFIED_TENANT_FIELD] ?? row.tenant_id;
    if (tenant && tenantId && tenant !== tenantId) return false;
    if (!rowFilters?.length) return true;
    return rowFilters.every((filter) => {
      if (filter.op === "ALL") return true;
      const value = row[filter.field];
      return filter.values.includes(value);
    });
  }

  function filterRowsByScope(rows, orgFieldOrContext = UNIFIED_ORG_FIELD, maybeContext) {
    const context =
      typeof orgFieldOrContext === "object" && orgFieldOrContext !== null
        ? orgFieldOrContext
        : maybeContext || {};
    if (typeof orgFieldOrContext === "string" && !maybeContext) {
      context.orgField = orgFieldOrContext;
    }
    const scope = resolveDataScope(false, context);
    if (scope.denied) return [];
    return (rows || []).filter((row) => rowMatchesScopeFilters(row, scope.rowFilters, scope.tenantId));
  }

  function getMcpScopePayload(context = {}) {
    const scope = resolveDataScope(false, context);
    return {
      project: scope.project,
      userId: scope.user.id,
      tenant_id: scope.tenantId,
      org_id: scope.user.org_id,
      roles: scope.user.roles,
      allowedDomains: scope.allDomains ? ["*"] : scope.allowedDomains,
      allowedModels: scope.allModels ? ["*"] : scope.allowedModels,
      allowedOrgIds: scope.allOrgs ? ["*"] : scope.allowedOrgIds,
      rowFilter: scope.rowFilter,
      rowFilters: scope.rowFilters,
      modelRowFilter: scope.modelRowFilter,
      matchedPolicies: scope.matchedPolicies?.map((p) => ({
        id: p.id,
        roleCode: p.roleCode,
        modelKey: p.modelKey,
        enabled: p.enabled !== false,
        rowPermissionEnabled: p.rowPermissionEnabled,
      })),
      steps: [
        "① 按工程筛选策略列表",
        "② 选择角色 → 搜索并选定模型（逐条添加）",
        "③ 可选启用行权限：字段 = 固定值，或 字段 = 用户属性值",
      ],
      tools: ["get_user_data_scope", "search_terms", "get_term_field_mapping", "query_metric"],
    };
  }

  function mount(deps = {}) {
    const setTip = typeof deps.setTip === "function" ? deps.setTip : () => {};
    const refreshViews = typeof deps.refreshViews === "function" ? deps.refreshViews : () => {};
    depsGetCurrentProject =
      typeof deps.getCurrentProject === "function" ? deps.getCurrentProject : depsGetCurrentProject;
    depsCollectModelCatalog =
      typeof deps.collectModelCatalog === "function" ? deps.collectModelCatalog : depsCollectModelCatalog;
    const buildPreviewDataset =
      typeof deps.buildPreviewDataset === "function" ? deps.buildPreviewDataset : null;
    const formatPreviewMeta =
      typeof deps.previewScopeMeta === "function" ? deps.previewScopeMeta : null;

    const userSelectEl = document.getElementById("headerDemoUserSelect");
    const policyTableEl = document.getElementById("permissionPolicyTableBody");
    const previewModelSelectEl = document.getElementById("permissionPreviewModelSelect");
    const previewSummaryEl = document.getElementById("permissionPreviewSummary");
    const previewTableHeadEl = document.getElementById("permissionPreviewTableHead");
    const previewTableBodyEl = document.getElementById("permissionPreviewTableBody");
    const previewRunBtn = document.getElementById("permissionPreviewRunBtn");
    const refreshScopeBtn = document.getElementById("permissionRefreshScopeBtn");
    const projectSelectEl = document.getElementById("permissionProjectSelect");
    const addPolicyBtn = document.getElementById("permissionAddPolicyBtn");
    const policyFormEl = document.getElementById("permissionPolicyForm");
    const formRoleEl = document.getElementById("permissionFormRole");
    const formModelSearchEl = document.getElementById("permissionFormModelSearch");
    const formModelResultsEl = document.getElementById("permissionFormModelResults");
    const formSelectedModelEl = document.getElementById("permissionFormSelectedModel");
    const formRowEnabledEl = document.getElementById("permissionFormRowEnabled");
    const formRowModeEl = document.getElementById("permissionFormRowMode");
    const formFilterFieldEl = document.getElementById("permissionFormFilterField");
    const formFixedValuesEl = document.getElementById("permissionFormFixedValues");
    const formUserAttrEl = document.getElementById("permissionFormUserAttribute");
    const formIncludeSubOrgsEl = document.getElementById("permissionFormIncludeSubOrgs");
    const formSubmitBtn = document.getElementById("permissionFormSubmitBtn");
    const formCancelBtn = document.getElementById("permissionFormCancelBtn");
    const formAllModelsEl = document.getElementById("permissionFormAllModels");

    let editingProject = projectSelectEl?.value || DEFAULT_PROJECTS[0];
    let previewModelKey = "";
    let formSelectedModel = null;
    let formAllModels = false;

    function populateUserSelect() {
      if (!userSelectEl) return;
      userSelectEl.innerHTML = DEMO_USERS.map(
        (u) =>
          `<option value="${escapeHtml(u.id)}"${u.id === getCurrentUser().id ? " selected" : ""}>${escapeHtml(u.name)} · ${escapeHtml(u.org_name)}</option>`
      ).join("");
    }

    function populateProjectSelect() {
      if (!projectSelectEl) return;
      const projects = deps.projectOptions || DEFAULT_PROJECTS;
      projectSelectEl.innerHTML = projects
        .map(
          (p) =>
            `<option value="${escapeHtml(p)}"${p === editingProject ? " selected" : ""}>${escapeHtml(p)}</option>`
        )
        .join("");
    }

    function userAttributeOptions(selected = "org_id") {
      return USER_ATTRIBUTE_OPTIONS.map(
        (opt) =>
          `<option value="${escapeHtml(opt.value)}"${opt.value === selected ? " selected" : ""}>${escapeHtml(opt.label)}</option>`
      ).join("");
    }

    function roleName(code) {
      return PLATFORM_ROLES.find((r) => r.code === code)?.name || code;
    }

    function modelLabel(modelKey) {
      return modelKey === ALL_MODELS_KEY ? "全部模型" : modelKey;
    }

    function policiesForEditingProject() {
      return readPolicies().filter((p) => p.project === editingProject);
    }

    function renderPolicyTable() {
      if (!policyTableEl) return;
      const policies = policiesForEditingProject();
      if (!policies.length) {
        policyTableEl.innerHTML = `<tr><td colspan="6" class="perm-empty">当前工程暂无策略，请使用下方表单逐条添加。</td></tr>`;
        return;
      }
      policyTableEl.innerHTML = policies
        .map((policy) => {
          const policyActive = policy.enabled !== false;
          const rowPermEnabled = !!policy.rowPermissionEnabled;
          const mode = policy.rowFilterMode || ROW_FILTER_MODE.NONE;
          const rowSummary = rowPermEnabled
            ? mode === ROW_FILTER_MODE.FIXED_VALUE
              ? `${policy.filterField || "—"} = [${(policy.fixedValues || []).join(", ")}]`
              : `${policy.filterField || policy.userAttribute} = 用户.${policy.userAttribute}${policy.includeSubOrgs ? "（含下级）" : ""}`
            : "未启用";
          const statusTag = policyActive
            ? `<span class="perm-status-tag is-on">已启用</span>`
            : `<span class="perm-status-tag is-off">已关闭</span>`;
          const toggleLabel = policyActive ? "关闭" : "启用";
          return `
          <tr data-policy-id="${escapeHtml(policy.id)}" class="${policyActive ? "" : "perm-policy-disabled"}">
            <td><strong>${escapeHtml(roleName(policy.roleCode))}</strong><div class="perm-sub"><code>${escapeHtml(policy.roleCode)}</code></div></td>
            <td>${escapeHtml(modelLabel(policy.modelKey))}</td>
            <td>${escapeHtml(policy.domain || "—")}</td>
            <td>${escapeHtml(rowSummary)}</td>
            <td>
              ${statusTag}
              <button class="btn-clear-filter perm-toggle-btn" type="button" data-action="toggle-policy" data-policy-id="${escapeHtml(policy.id)}">${toggleLabel}</button>
            </td>
            <td>
              <button class="btn-clear-filter perm-edit-btn" type="button" data-action="edit-policy" data-policy-id="${escapeHtml(policy.id)}">编辑</button>
              <button class="btn-clear-filter perm-delete-btn" type="button" data-action="delete-policy" data-policy-id="${escapeHtml(policy.id)}">删除</button>
            </td>
          </tr>`;
        })
        .join("");
    }

    function togglePolicyEnabled(id) {
      const all = readPolicies();
      const idx = all.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const nextEnabled = all[idx].enabled === false;
      all[idx] = normalizePolicy({ ...all[idx], enabled: nextEnabled });
      writePolicies(all);
      renderPolicyTable();
      renderDataPreviewValidation();
      refreshViews();
      setTip(nextEnabled ? "策略已启用" : "策略已关闭，不再参与权限计算");
    }

    function showPolicyForm() {
      if (policyFormEl) policyFormEl.hidden = false;
    }

    function hidePolicyForm() {
      if (policyFormEl) policyFormEl.hidden = true;
    }

    function resetPolicyForm() {
      formSelectedModel = null;
      formAllModels = false;
      if (formRoleEl) formRoleEl.selectedIndex = 0;
      if (formModelSearchEl) formModelSearchEl.value = "";
      if (formModelResultsEl) formModelResultsEl.innerHTML = "";
      if (formSelectedModelEl) formSelectedModelEl.textContent = "尚未选择模型";
      if (formAllModelsEl) formAllModelsEl.checked = false;
      if (formRowEnabledEl) formRowEnabledEl.checked = false;
      if (formRowModeEl) formRowModeEl.value = ROW_FILTER_MODE.FIXED_VALUE;
      if (formFilterFieldEl) formFilterFieldEl.value = "";
      if (formFixedValuesEl) formFixedValuesEl.value = "";
      if (formUserAttrEl) formUserAttrEl.innerHTML = userAttributeOptions("org_id");
      if (formIncludeSubOrgsEl) formIncludeSubOrgsEl.checked = false;
      syncFormRowVisibility();
      policyFormEl?.removeAttribute("data-editing-id");
    }

    function closePolicyForm() {
      resetPolicyForm();
      hidePolicyForm();
    }

    function syncFormRowVisibility() {
      const enabled = formRowEnabledEl?.checked;
      const mode = formRowModeEl?.value;
      if (formRowModeEl) formRowModeEl.disabled = !enabled;
      if (formFilterFieldEl) formFilterFieldEl.disabled = !enabled;
      const isFixed = enabled && mode === ROW_FILTER_MODE.FIXED_VALUE;
      const isUserAttr = enabled && mode === ROW_FILTER_MODE.USER_ATTRIBUTE;
      if (formFixedValuesEl) formFixedValuesEl.disabled = !isFixed;
      if (formUserAttrEl) formUserAttrEl.disabled = !isUserAttr;
      if (formIncludeSubOrgsEl) formIncludeSubOrgsEl.disabled = !isUserAttr;
    }

    function renderModelSearchResults() {
      if (!formModelResultsEl) return;
      const query = String(formModelSearchEl?.value || "")
        .trim()
        .toLowerCase();
      if (formAllModels) {
        formModelResultsEl.innerHTML = "";
        return;
      }
      const models = collectModelCatalog(editingProject);
      const hits = models
        .filter((m) => !query || m.name.toLowerCase().includes(query) || m.domain.toLowerCase().includes(query))
        .slice(0, 12);
      if (!hits.length) {
        formModelResultsEl.innerHTML = `<div class="perm-model-empty">未找到模型，请调整关键词或确认工程筛选。</div>`;
        return;
      }
      formModelResultsEl.innerHTML = hits
        .map(
          (m) => `
        <button class="perm-model-hit" type="button" data-model-name="${escapeHtml(m.name)}" data-model-domain="${escapeHtml(m.domain)}">
          <strong>${escapeHtml(m.name)}</strong>
          <span>${escapeHtml(m.domain || "未分类")} · ${escapeHtml(m.type || "模型")}</span>
        </button>`
        )
        .join("");
    }

    function fillFormFromPolicy(policy) {
      if (!policy) return;
      if (formRoleEl) formRoleEl.value = policy.roleCode;
      formAllModels = policy.modelKey === ALL_MODELS_KEY;
      if (formAllModelsEl) formAllModelsEl.checked = formAllModels;
      if (formAllModels) {
        formSelectedModel = null;
        if (formSelectedModelEl) formSelectedModelEl.textContent = "已选：全部模型（工程内）";
      } else {
        formSelectedModel = { name: policy.modelKey, domain: policy.domain };
        if (formSelectedModelEl) {
          formSelectedModelEl.textContent = `已选：${policy.modelKey}${policy.domain ? `（${policy.domain}）` : ""}`;
        }
      }
      if (formRowEnabledEl) formRowEnabledEl.checked = !!policy.rowPermissionEnabled;
      if (formRowModeEl) formRowModeEl.value = policy.rowFilterMode || ROW_FILTER_MODE.FIXED_VALUE;
      if (formFilterFieldEl) formFilterFieldEl.value = policy.filterField || "";
      if (formFixedValuesEl) formFixedValuesEl.value = (policy.fixedValues || []).join(", ");
      if (formUserAttrEl) formUserAttrEl.innerHTML = userAttributeOptions(policy.userAttribute || "org_id");
      if (formIncludeSubOrgsEl) formIncludeSubOrgsEl.checked = !!policy.includeSubOrgs;
      syncFormRowVisibility();
      policyFormEl?.setAttribute("data-editing-id", policy.id);
      showPolicyForm();
      policyFormEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function collectFormPolicy() {
      const roleCode = formRoleEl?.value || PLATFORM_ROLES[0].code;
      const rowPermissionEnabled = formRowEnabledEl?.checked || false;
      const rowFilterMode = rowPermissionEnabled
        ? formRowModeEl?.value || ROW_FILTER_MODE.FIXED_VALUE
        : ROW_FILTER_MODE.NONE;
      const modelKey = formAllModels ? ALL_MODELS_KEY : formSelectedModel?.name || "";
      if (!modelKey) return null;
      return normalizePolicy({
        id: policyFormEl?.getAttribute("data-editing-id") || newPolicyId(),
        project: editingProject,
        roleCode,
        modelKey,
        domain: formAllModels ? "" : formSelectedModel?.domain || "",
        rowPermissionEnabled,
        rowFilterMode,
        filterField: formFilterFieldEl?.value?.trim() || "",
        fixedValues: String(formFixedValuesEl?.value || "")
          .split(/[,，;；\s]+/)
          .map((v) => v.trim())
          .filter(Boolean),
        userAttribute: formUserAttrEl?.value || "org_id",
        includeSubOrgs: formIncludeSubOrgsEl?.checked || false,
        enabled: policyFormEl?.getAttribute("data-editing-id")
          ? readPolicies().find((p) => p.id === policyFormEl.getAttribute("data-editing-id"))?.enabled !== false
          : true,
      });
    }

    function upsertPolicyFromForm() {
      const next = collectFormPolicy();
      if (!next) {
        setTip("请先选择角色并搜索选定模型（或勾选「全部模型」）");
        return;
      }
      const all = readPolicies();
      const duplicate = all.find(
        (p) =>
          p.project === next.project &&
          p.roleCode === next.roleCode &&
          p.modelKey === next.modelKey &&
          p.id !== next.id
      );
      if (duplicate) {
        setTip("该工程下已存在相同角色 + 模型的策略，请编辑原条目");
        return;
      }
      const idx = all.findIndex((p) => p.id === next.id);
      if (idx >= 0) all[idx] = next;
      else all.push(next);
      writePolicies(all);
      renderPolicyTable();
      renderDataPreviewValidation();
      refreshViews();
      closePolicyForm();
      setTip(`已保存策略：${roleName(next.roleCode)} · ${modelLabel(next.modelKey)}`);
    }

    function deletePolicy(id) {
      const all = readPolicies().filter((p) => p.id !== id);
      writePolicies(all);
      renderPolicyTable();
      renderDataPreviewValidation();
      refreshViews();
      setTip("已删除策略条目");
    }

    function getPreviewProject() {
      return normalizePreviewProject(getActiveProject(), editingProject || DEFAULT_PROJECTS[0]);
    }

    function populatePreviewModelSelect() {
      if (!previewModelSelectEl) return;
      const project = getPreviewProject();
      const models = collectModelCatalog(project);
      if (!models.length) {
        previewModelSelectEl.innerHTML = `<option value="">当前工程暂无模型</option>`;
        previewModelKey = "";
        return;
      }
      if (!previewModelKey || !models.some((m) => m.name === previewModelKey)) {
        const accessible = models.find((m) => canAccessModel(m.name, { project }));
        previewModelKey = accessible?.name || models[0].name;
      }
      previewModelSelectEl.innerHTML = models
        .map((m) => {
          const granted = canAccessModel(m.name, { project });
          const suffix = granted ? "" : "（无模型权限）";
          return `<option value="${escapeHtml(m.name)}"${m.name === previewModelKey ? " selected" : ""}>${escapeHtml(m.name)}${suffix}</option>`;
        })
        .join("");
      previewModelSelectEl.value = previewModelKey;
    }

    function renderPreviewSummary(scope, modelKey, dataset) {
      if (!previewSummaryEl) return;
      if (scope.denied) {
        previewSummaryEl.className = "perm-preview-summary is-denied";
        previewSummaryEl.textContent = `工程「${scope.project}」下当前用户 ${scope.user.name} 无匹配策略，无法预览「${modelKey}」。`;
        return;
      }
      if (!canAccessModel(modelKey, { project: scope.project })) {
        previewSummaryEl.className = "perm-preview-summary is-denied";
        previewSummaryEl.textContent = `当前用户 ${scope.user.name} 在工程「${scope.project}」下未授权模型「${modelKey}」，元数据不可见，数据预览为空。`;
        return;
      }
      previewSummaryEl.className = "perm-preview-summary";
      const domainText = scope.allDomains
        ? "全部数据域"
        : scope.allowedDomains.join("、") || "—";
      const modelText = scope.allModels ? "全部模型" : scope.allowedModels.join("、") || modelKey;
      const rowText = rowFilterSummary(scope.rowFilters || []);
      const dataMeta = dataset && formatPreviewMeta ? formatPreviewMeta(dataset) : "";
      previewSummaryEl.innerHTML = [
        `<strong>模拟用户</strong>：${escapeHtml(scope.user.name)}（${escapeHtml(scope.user.org_name)}） · <strong>工程</strong>：${escapeHtml(scope.project)}`,
        `<strong>可见域</strong>：${escapeHtml(domainText)} · <strong>可见模型</strong>：${escapeHtml(modelText)}`,
        `<strong>行权限</strong>：${escapeHtml(rowText === "未启用" ? "未启用" : rowText)}`,
        dataMeta ? `<strong>样例数据</strong>：${escapeHtml(dataMeta)}` : "",
      ]
        .filter(Boolean)
        .join("<br>");
    }

    function renderPreviewTable(dataset) {
      if (!previewTableHeadEl || !previewTableBodyEl) return;
      if (!dataset?.filteredRows?.length) {
        previewTableHeadEl.innerHTML = "";
        previewTableBodyEl.innerHTML =
          `<tr><td class="perm-preview-empty" colspan="99">无可见数据行（请检查模型授权或行权限配置）</td></tr>`;
        return;
      }
      const columns = (dataset.columns || []).filter((col) =>
        ["tenant_id", "org_id", "biz_line_code"].includes(col.name)
          ? true
          : dataset.filteredRows.some((row) => row[col.name] !== undefined && row[col.name] !== "")
      );
      const displayCols = columns.length ? columns : dataset.columns.slice(0, 6);
      previewTableHeadEl.innerHTML = `<tr>${displayCols
        .map(
          (col) =>
            `<th title="${escapeHtml(col.type || "")}">${escapeHtml(col.label || col.name)}<br><span style="color:#98a2b3;font-weight:400;">${escapeHtml(col.name)}</span></th>`
        )
        .join("")}</tr>`;
      previewTableBodyEl.innerHTML = dataset.filteredRows
        .map(
          (row) =>
            `<tr>${displayCols
              .map((col) => `<td>${escapeHtml(row[col.name] ?? "")}</td>`)
              .join("")}</tr>`
        )
        .join("");
    }

    function renderDataPreviewValidation() {
      populatePreviewModelSelect();
      const project = getPreviewProject();
      const modelKey = previewModelKey || previewModelSelectEl?.value || "";
      const scope = resolveDataScope(true, { project, modelKey });
      if (!modelKey) {
        renderPreviewSummary(scope, "—", null);
        renderPreviewTable(null);
        return;
      }

      if (!buildPreviewDataset || scope.denied || !canAccessModel(modelKey, { project })) {
        renderPreviewSummary(scope, modelKey, null);
        renderPreviewTable(null);
        return;
      }

      const dataset = buildPreviewDataset(modelKey);
      renderPreviewSummary(scope, modelKey, dataset);
      renderPreviewTable(dataset);
    }

    function renderPermissionPanel() {
      populateProjectSelect();
      renderPolicyTable();
      renderDataPreviewValidation();
      if (formRoleEl && !formRoleEl.options.length) {
        formRoleEl.innerHTML = PLATFORM_ROLES.map(
          (r) => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.name)}</option>`
        ).join("");
      }
      if (formUserAttrEl && !formUserAttrEl.options.length) {
        formUserAttrEl.innerHTML = userAttributeOptions("org_id");
      }
    }

    userSelectEl?.addEventListener("change", () => {
      setCurrentUser(userSelectEl.value);
      setTip(`已切换模拟用户：${getCurrentUser().name}`);
      renderDataPreviewValidation();
      refreshViews();
    });

    projectSelectEl?.addEventListener("change", () => {
      editingProject = projectSelectEl.value;
      renderPolicyTable();
      renderModelSearchResults();
      setTip(`已切换策略工程：${editingProject}`);
    });

    refreshScopeBtn?.addEventListener("click", () => {
      invalidateScopeCache();
      renderDataPreviewValidation();
      refreshViews();
      setTip("已强制刷新数据范围缓存");
    });

    addPolicyBtn?.addEventListener("click", () => {
      resetPolicyForm();
      showPolicyForm();
      policyFormEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTip("请依次选择角色、搜索模型，再决定是否启用行权限");
    });

    formModelSearchEl?.addEventListener("input", renderModelSearchResults);
    formModelSearchEl?.addEventListener("focus", renderModelSearchResults);

    formAllModelsEl?.addEventListener("change", () => {
      formAllModels = !!formAllModelsEl.checked;
      if (formAllModels) {
        formSelectedModel = null;
        if (formSelectedModelEl) formSelectedModelEl.textContent = "已选：全部模型（工程内）";
        if (formModelResultsEl) formModelResultsEl.innerHTML = "";
        if (formModelSearchEl) formModelSearchEl.value = "";
      } else if (formSelectedModelEl) {
        formSelectedModelEl.textContent = "尚未选择模型";
      }
    });

    formModelResultsEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-model-name]");
      if (!btn) return;
      formAllModels = false;
      if (formAllModelsEl) formAllModelsEl.checked = false;
      formSelectedModel = {
        name: btn.dataset.modelName,
        domain: btn.dataset.modelDomain || "",
      };
      if (formSelectedModelEl) {
        formSelectedModelEl.textContent = `已选：${formSelectedModel.name}${formSelectedModel.domain ? `（${formSelectedModel.domain}）` : ""}`;
      }
      if (formModelSearchEl) formModelSearchEl.value = formSelectedModel.name;
      formModelResultsEl.innerHTML = "";
    });

    formRowEnabledEl?.addEventListener("change", syncFormRowVisibility);
    formRowModeEl?.addEventListener("change", syncFormRowVisibility);

    formSubmitBtn?.addEventListener("click", upsertPolicyFromForm);
    formCancelBtn?.addEventListener("click", () => {
      closePolicyForm();
      setTip("已取消，添加策略表单已关闭");
    });

    policyTableEl?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.policyId;
      const policy = readPolicies().find((p) => p.id === id);
      if (btn.dataset.action === "edit-policy") {
        fillFormFromPolicy(policy);
        setTip("已载入策略到编辑表单");
      } else if (btn.dataset.action === "toggle-policy") {
        togglePolicyEnabled(id);
      } else if (btn.dataset.action === "delete-policy") {
        deletePolicy(id);
      }
    });

    previewModelSelectEl?.addEventListener("change", () => {
      previewModelKey = previewModelSelectEl.value || "";
      renderDataPreviewValidation();
    });

    previewRunBtn?.addEventListener("click", () => {
      invalidateScopeCache();
      renderDataPreviewValidation();
      setTip("已刷新数据预览验证");
    });

    populateUserSelect();

    return {
      resolveDataScope,
      canAccessDomain,
      canAccessModel,
      filterRowsByScope,
      getMcpScopePayload,
      getCurrentUser,
      invalidateScopeCache,
      renderPermissionPanel,
      renderDataPreviewValidation,
      collectModelCatalog,
      UNIFIED_ORG_FIELD,
      UNIFIED_TENANT_FIELD,
      ROW_FILTER_MODE,
      DEMO_ORG_IDS: ALL_ORGS.map((o) => o.id),
      getModelRowFilter,
      upsertModelRowFilter,
      readModelRowFilters,
    };
  }

  global.PermissionModule = {
    mount,
    resolveDataScope,
    canAccessDomain,
    canAccessModel,
    filterRowsByScope,
    getMcpScopePayload,
    getCurrentUser,
    setCurrentUser,
    readPolicies,
    writePolicies,
    readModelRowFilters,
    writeModelRowFilters,
    getModelRowFilter,
    upsertModelRowFilter,
    invalidateScopeCache,
    collectModelCatalog,
    UNIFIED_ORG_FIELD,
    UNIFIED_TENANT_FIELD,
    ROW_FILTER_MODE,
    USER_ATTRIBUTE_OPTIONS,
    DEFAULT_PROJECTS,
    ALL_MODELS_KEY,
    DEMO_ORG_IDS: ALL_ORGS.map((o) => o.id),
    ALL_ORGS,
  };
})(window);
