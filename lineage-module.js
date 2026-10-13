/**
 * 语义首页 · 多视角血缘图谱（MVP）
 */
(function initLineageModule(global) {
  const PERSPECTIVE_LABELS = {
    term: "术语",
    model: "模型",
    metric: "指标",
    document: "文档",
  };

  const NODE_META = {
    domain: { label: "数据域", color: "#1e3a8a", fill: "#ffffff", text: "#1e3a8a", stroke: "#1d4ed8", dashed: true },
    model: { label: "模型", color: "#1d4ed8", fill: "#1d4ed8", text: "#ffffff", stroke: "#1e40af" },
    term: { label: "术语", color: "#2563eb", fill: "#2563eb", text: "#ffffff", stroke: "#1d4ed8" },
    metric: { label: "指标", color: "#3b82f6", fill: "#3b82f6", text: "#ffffff", stroke: "#2563eb" },
    field: { label: "字段", color: "#60a5fa", fill: "#60a5fa", text: "#ffffff", stroke: "#3b82f6" },
    document: { label: "文档", color: "#93c5fd", fill: "#bfdbfe", text: "#1e3a8a", stroke: "#60a5fa" },
    query: { label: "问数", color: "#64748b", fill: "#dbeafe", text: "#1e40af", stroke: "#93c5fd" },
  };

  const EDGE_LABELS = {
    mount: "挂载",
    relate: "关联",
    derive: "派生",
    bind: "绑定",
    link: "挂接",
    explain: "解释",
    sync: "同步",
    depend: "依赖",
    belong: "归属",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readStore() {
    return global.SemanticBridge?.ensureSeed?.() || { models: [], docs: [], links: [] };
  }

  function readTerms() {
    return global.TermModule?.readTerms?.() || [];
  }

  function readMetrics() {
    return global.MetricModule?.readMetrics?.() || [];
  }

  function readFieldTermMap() {
    return global.TermModule?.readFieldTermMap?.() || {};
  }

  function parseFormulaFields(formula) {
    return global.MetricModule?.parseFormulaFields?.(formula) || { fieldKeys: [], fieldNames: [] };
  }

  function parseDerivedMetricNames(formula) {
    const names = [];
    const re = /metric\[['"]([^'"]+)['"]\]/g;
    let m;
    while ((m = re.exec(String(formula || "")))) names.push(m[1]);
    return names;
  }

  function isOnlineTerm(term) {
    return term?.online !== false;
  }

  function isPublishedMetric(metric) {
    return metric?.status === "published" && metric?.online !== false;
  }

  function resolveModel(modelKey) {
    if (!modelKey) return null;
    const store = readStore();
    return (
      store.models.find((m) => m.id === modelKey || m.name === modelKey) ||
      listModels().find((m) => m.id === modelKey || m.name === modelKey)?.bridge ||
      listModels().find((m) => m.name === modelKey) ||
      null
    );
  }

  const DEFAULT_PROJECT_OPTIONS = [
    "pmlead-市场指标",
    "pmlead-成本指标",
    "pmlead-通用AI",
    "数据工具链",
  ];

  function splitDomainList(value) {
    return String(value || "")
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function listModels() {
    const store = readStore();
    const map = new Map();
    (store.models || []).forEach((m) => {
      map.set(m.name, {
        id: m.name,
        name: m.name,
        domain: m.domain || "",
        project: m.project || "",
        bridge: m,
      });
    });
    document.querySelectorAll("#listCatalogModelPanel tbody tr").forEach((row) => {
      const link = row.querySelector(".name-link");
      const name = link?.dataset.title || link?.textContent?.trim();
      if (!name) return;
      const domain = row.dataset.domain || row.querySelector(".domain-cell")?.textContent?.trim() || "";
      const project = row.dataset.project || "";
      if (map.has(name)) {
        const existing = map.get(name);
        existing.domain = existing.domain || domain;
        existing.project = existing.project || project;
        return;
      }
      map.set(name, { id: name, name, domain, project, bridge: null });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  function listDocuments() {
    const store = readStore();
    const docs = (store.docs || []).slice();
    document.querySelectorAll("#documentListBody tr").forEach((row) => {
      const name = row.dataset.listName || row.querySelector(".name-link")?.textContent?.trim();
      if (!name || docs.some((d) => d.name === name)) return;
      docs.push({
        id: row.dataset.listId || `doc:${name}`,
        name,
        domain: row.dataset.domain || "",
        project: row.dataset.project || "",
        online: row.dataset.online !== "0",
      });
    });
    return docs.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-CN"));
  }

  function collectProjectOptions() {
    const labels = new Set(DEFAULT_PROJECT_OPTIONS);
    const mainSelect = document.getElementById("projectFilterSelect");
    if (mainSelect) {
      Array.from(mainSelect.options).forEach((opt) => {
        const value = (opt.value || opt.textContent || "").trim();
        if (value) labels.add(value);
      });
    }
    listModels().forEach((m) => {
      if (m.project) labels.add(m.project);
    });
    readTerms().forEach((t) => {
      if (t.project) labels.add(t.project);
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function collectDomainOptions() {
    const labels = new Set();
    if (typeof global.collectUniqueDomainLabels === "function") {
      global.collectUniqueDomainLabels().forEach((label) => labels.add(label));
    }
    listModels().forEach((m) => {
      if (m.domain) labels.add(m.domain);
    });
    readTerms().forEach((t) => {
      splitDomainList(t.domain).forEach((label) => labels.add(label));
      (t.domains || []).forEach((label) => labels.add(label));
    });
    readMetrics().forEach((m) => {
      splitDomainList(m.domain).forEach((label) => labels.add(label));
      (m.domains || []).forEach((label) => labels.add(label));
    });
    listDocuments().forEach((d) => {
      if (d.domain) labels.add(d.domain);
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function resolveMetricProject(metric) {
    const modelNames = [
      ...(metric.boundModelNames || []),
      ...(metric.domainModels || []).map((m) => m.name),
      ...(metric.boundModelIds || []),
    ].filter(Boolean);
    for (const name of modelNames) {
      const model = listModels().find((m) => m.id === name || m.name === name);
      if (model?.project) return model.project;
    }
    return "";
  }

  function matchesProjectFilter(item, projectFilter) {
    if (!projectFilter) return true;
    const project = item.project || "";
    return !project || project === projectFilter;
  }

  function matchesDomainFilter(item, domainFilter) {
    if (!domainFilter) return true;
    const domains = [
      ...splitDomainList(item.domain),
      ...(Array.isArray(item.domains) ? item.domains : []),
    ];
    return domains.includes(domainFilter);
  }

  function getActiveProject() {
    const el = document.getElementById("projectFilterSelect");
    return (el?.value || "pmlead-市场指标").trim();
  }

  function matchesDataScope(item) {
    const PM = global.PermissionModule;
    if (!PM) return true;
    const project = getActiveProject();
    if (item.name && (item.bridge !== undefined || item.type === "model" || item.project !== undefined)) {
      const canAccessModel = PM.canAccessModel;
      if (canAccessModel && item.name) {
        const rowProject = item.project || "";
        if (rowProject && rowProject !== project) return false;
        return canAccessModel(item.name, { project });
      }
    }
    const canAccess = PM.canAccessDomain;
    if (!canAccess) return true;
    const domains = [
      ...splitDomainList(item.domain),
      ...(Array.isArray(item.domains) ? item.domains : []),
    ];
    if (!domains.length) return true;
    return domains.some((d) => canAccess(d, { project }));
  }

  function createGraphBuilder() {
    const nodes = new Map();
    const edges = [];

    function addNode(type, key, payload = {}) {
      const id = `${type}:${key}`;
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          type,
          key,
          label: payload.label || key,
          status: payload.status || "",
          meta: payload.meta || {},
        });
      }
      return id;
    }

    function addEdge(from, to, kind, style = "solid") {
      if (!from || !to || from === to) return;
      const sig = `${from}->${to}:${kind}`;
      if (edges.some((e) => e.sig === sig)) return;
      edges.push({ from, to, kind, style, sig, label: EDGE_LABELS[kind] || kind });
    }

    function resolveDomainsForNode(node) {
      if (!node || node.type === "domain" || node.type === "query") return [];
      if (node.type === "term") {
        const term = readTerms().find((t) => t.id === node.key);
        if (term) {
          return [...new Set([...splitDomainList(term.domain), ...(term.domains || [])].filter(Boolean))];
        }
        return splitDomainList(node.meta?.domain);
      }
      if (node.type === "model") {
        const model =
          listModels().find((m) => m.id === node.key || m.name === node.key) || resolveModel(node.key);
        if (model?.domain) return [model.domain];
        return splitDomainList(node.meta?.domain);
      }
      if (node.type === "metric") {
        const metric = readMetrics().find((m) => m.id === node.key);
        if (metric) {
          return [...new Set([...splitDomainList(metric.domain), ...(metric.domains || [])].filter(Boolean))];
        }
        return splitDomainList(node.meta?.domain);
      }
      if (node.type === "document") {
        const doc = listDocuments().find((d) => d.id === node.key);
        if (doc?.domain) return [doc.domain];
        return splitDomainList(node.meta?.domain);
      }
      if (node.type === "field") {
        const modelName = node.meta?.modelName;
        if (!modelName) return [];
        const model = listModels().find((m) => m.name === modelName);
        return model?.domain ? [model.domain] : [];
      }
      return splitDomainList(node.meta?.domain);
    }

    function attachDomainNodes() {
      [...nodes.values()].forEach((node) => {
        resolveDomainsForNode(node).forEach((label) => {
          const domainNodeId = addNode("domain", label, {
            label,
            status: "domain",
            meta: { domain: label },
          });
          addEdge(node.id, domainNodeId, "belong", "dotted");
        });
      });
    }

    function buildQueryNode() {
      return addNode("query", "smart-query", { label: "智能问数", status: "active" });
    }

    function expandTerm(termId, depth, onlineOnly) {
      const terms = readTerms();
      const term = terms.find((t) => t.id === termId);
      if (!term) return;
      if (onlineOnly && !isOnlineTerm(term)) return;
      const root = addNode("term", term.id, {
        label: term.name,
        status: isOnlineTerm(term) ? "online" : "offline",
        meta: { domain: term.domain, entityId: term.id },
      });
      if (depth < 1) return root;

      const fieldMap = readFieldTermMap();
      Object.entries(fieldMap).forEach(([key, ids]) => {
        if (!Array.isArray(ids) || !ids.includes(term.id)) return;
        if (global.TermModule?.isFieldTermDismissed?.(key, term.id)) return;
        const [modelName, fieldEn] = key.split("|");
        const fieldId = addNode("field", key, {
          label: fieldEn,
          meta: { modelName, fieldEn },
        });
        addEdge(root, fieldId, "mount");
        if (depth >= 2) expandField(fieldId, modelName, fieldEn, depth - 1, onlineOnly);
      });

      readMetrics()
        .filter((m) => Array.isArray(m.termIds) && m.termIds.includes(term.id))
        .forEach((metric) => {
          if (onlineOnly && metric.online === false) return;
          const mid = addNode("metric", metric.id, {
            label: metric.name,
            status: isPublishedMetric(metric) ? "published" : "draft",
            meta: { entityId: metric.id, kind: metric.kind },
          });
          addEdge(root, mid, "relate");
          if (depth >= 2) expandMetric(mid, metric.id, depth - 1, onlineOnly);
        });
      return root;
    }

    function expandField(fieldNodeId, modelName, fieldEn, depth, onlineOnly) {
      if (depth < 1) return;
      readMetrics().forEach((metric) => {
        const parsed = parseFormulaFields(metric.formula);
        const keys = metric.fieldKeys || parsed.fieldKeys || [];
        const modelNames = metric.boundModelNames || metric.domainModels || [];
        if (!keys.includes(fieldEn) && !parsed.fieldNames.includes(fieldEn)) return;
        if (modelNames.length && !modelNames.includes(modelName)) return;
        if (onlineOnly && metric.online === false) return;
        const mid = addNode("metric", metric.id, {
          label: metric.name,
          status: isPublishedMetric(metric) ? "published" : "draft",
          meta: { entityId: metric.id },
        });
        addEdge(fieldNodeId, mid, "depend");
        if (depth >= 2) expandMetric(mid, metric.id, depth - 1, onlineOnly);
      });
    }

    function expandMetric(metricNodeId, metricId, depth, onlineOnly) {
      const metric = readMetrics().find((m) => m.id === metricId);
      if (!metric) return;
      if (depth < 1) return;

      parseDerivedMetricNames(metric.formula).forEach((name) => {
        const base = readMetrics().find((m) => m.name === name);
        if (!base) return;
        const bid = addNode("metric", base.id, {
          label: base.name,
          status: isPublishedMetric(base) ? "published" : "draft",
          meta: { entityId: base.id, kind: base.kind },
        });
        addEdge(bid, metricNodeId, "derive", "dashed");
      });

      const modelNames = [
        ...(metric.boundModelNames || []),
        ...(metric.domainModels || []).map((m) => (typeof m === "string" ? m : m.name)).filter(Boolean),
      ];
      [...new Set(modelNames)].forEach((name) => {
        const model = listModels().find((m) => m.name === name);
        const modelId = addNode("model", model?.id || name, {
          label: name,
          meta: { entityId: model?.id || name },
        });
        addEdge(metricNodeId, modelId, "bind");
        if (depth >= 2) expandModel(modelId, model?.id || name, depth - 1, onlineOnly);
      });

      if (isPublishedMetric(metric)) {
        const qid = buildQueryNode();
        addEdge(metricNodeId, qid, "sync", "dotted");
      }
    }

    function expandModel(modelNodeId, modelKey, depth, onlineOnly) {
      const store = readStore();
      const model = resolveModel(modelKey);
      if (!model || depth < 1) return;

      const linkedDocIds = new Set(
        (store.links || []).filter((l) => l.modelId === model.id).map((l) => l.docId)
      );

      (store.links || [])
        .filter((l) => l.modelId === model.id)
        .forEach((link) => {
          const doc = (store.docs || []).find((d) => d.id === link.docId);
          if (!doc) return;
          if (onlineOnly && doc.online === false) return;
          const did = addNode("document", doc.id, {
            label: doc.name,
            meta: { entityId: doc.id },
          });
          addEdge(modelNodeId, did, "link");
          if (depth >= 2) expandDocument(did, doc.id, depth - 1, onlineOnly);
        });

      (store.docs || []).forEach((doc) => {
        if (linkedDocIds.has(doc.id)) return;
        if (onlineOnly && doc.online === false) return;
        if (doc.domain && model.domain && doc.domain !== model.domain) return;
        const did = addNode("document", doc.id, {
          label: doc.name,
          meta: { entityId: doc.id },
        });
        addEdge(modelNodeId, did, "link", "dotted");
        if (depth >= 2) expandDocument(did, doc.id, depth - 1, onlineOnly);
      });

      const fieldMap = readFieldTermMap();
      Object.entries(fieldMap).forEach(([key, ids]) => {
        const [modelName] = key.split("|");
        if (modelName !== model.name) return;
        const [, fieldEn] = key.split("|");
        const fieldId = addNode("field", key, { label: fieldEn, meta: { modelName, fieldEn } });
        addEdge(modelNodeId, fieldId, "depend", "dotted");
        ids.forEach((termId) => {
          const term = readTerms().find((t) => t.id === termId);
          if (!term) return;
          if (onlineOnly && !isOnlineTerm(term)) return;
          const tid = addNode("term", term.id, {
            label: term.name,
            status: isOnlineTerm(term) ? "online" : "offline",
            meta: { entityId: term.id },
          });
          addEdge(fieldId, tid, "mount");
        });
      });

      readMetrics().forEach((metric) => {
        const names = metric.boundModelNames || [];
        if (!names.includes(model.name)) return;
        if (onlineOnly && metric.online === false) return;
        const mid = addNode("metric", metric.id, {
          label: metric.name,
          meta: { entityId: metric.id },
        });
        addEdge(modelNodeId, mid, "bind");
      });

      if (model.publishStatus === "published") {
        const qid = buildQueryNode();
        addEdge(modelNodeId, qid, "sync", "dotted");
      }
    }

    function expandDocument(docNodeId, docId, depth, onlineOnly) {
      const store = readStore();
      const doc = (store.docs || []).find((d) => d.id === docId);
      if (!doc || depth < 1) return;
      (doc.chunks || []).forEach((chunk) => {
        if (!chunk.metricName) return;
        const metric = readMetrics().find((m) => m.name === chunk.metricName);
        if (!metric) {
          const placeholder = addNode("metric", `chunk:${chunk.metricName}`, {
            label: chunk.metricName,
            meta: { fromChunk: true },
          });
          addEdge(docNodeId, placeholder, "explain");
          return;
        }
        if (onlineOnly && metric.online === false) return;
        const mid = addNode("metric", metric.id, {
          label: metric.name,
          meta: { entityId: metric.id },
        });
        addEdge(docNodeId, mid, "explain");
      });
    }

    function buildFromTerm(termId, depth, onlineOnly) {
      nodes.clear();
      edges.length = 0;
      const root = expandTerm(termId, depth, onlineOnly);
      attachDomainNodes();
      return { rootId: root, nodes: [...nodes.values()], edges };
    }

    function buildFromModel(modelKey, depth, onlineOnly) {
      nodes.clear();
      edges.length = 0;
      const model = listModels().find((m) => m.id === modelKey || m.name === modelKey) || resolveModel(modelKey);
      if (!model) return { rootId: null, nodes: [], edges: [] };
      const root = addNode("model", model.name, {
        label: model.name,
        meta: { entityId: model.name, domain: model.domain },
      });
      expandModel(root, model.name, depth, onlineOnly);
      attachDomainNodes();
      return { rootId: root, nodes: [...nodes.values()], edges };
    }

    function buildFromMetric(metricId, depth, onlineOnly) {
      nodes.clear();
      edges.length = 0;
      const metric = readMetrics().find((m) => m.id === metricId);
      if (!metric) return { rootId: null, nodes: [], edges: [] };
      const root = addNode("metric", metric.id, {
        label: metric.name,
        status: isPublishedMetric(metric) ? "published" : "draft",
        meta: { entityId: metric.id, kind: metric.kind, domain: metric.domain, domains: metric.domains },
      });
      (metric.termIds || []).forEach((termId) => {
        const term = readTerms().find((t) => t.id === termId);
        if (!term) return;
        if (onlineOnly && !isOnlineTerm(term)) return;
        const tid = addNode("term", term.id, {
          label: term.name,
          meta: { entityId: term.id },
        });
        addEdge(tid, root, "relate");
      });
      expandMetric(root, metric.id, depth, onlineOnly);
      attachDomainNodes();
      return { rootId: root, nodes: [...nodes.values()], edges };
    }

    function buildFromDocument(docId, depth, onlineOnly) {
      nodes.clear();
      edges.length = 0;
      const doc = listDocuments().find((d) => d.id === docId);
      if (!doc) return { rootId: null, nodes: [], edges: [] };
      const root = addNode("document", doc.id, {
        label: doc.name,
        meta: { entityId: doc.id, domain: doc.domain },
      });
      expandDocument(root, doc.id, depth, onlineOnly);
      const store = readStore();
      (store.links || [])
        .filter((l) => l.docId === doc.id)
        .forEach((link) => {
          const model = store.models.find((m) => m.id === link.modelId);
          if (!model) return;
          const mid = addNode("model", model.id, {
            label: model.name,
            meta: { entityId: model.id, domain: model.domain },
          });
          addEdge(mid, root, "link");
        });
      attachDomainNodes();
      return { rootId: root, nodes: [...nodes.values()], edges };
    }

    return {
      buildFromTerm,
      buildFromModel,
      buildFromMetric,
      buildFromDocument,
    };
  }

  function getNodeRadius(node, graph) {
    if (node.id === graph.rootId) return 46;
    const sizeMap = { domain: 38, model: 40, term: 36, metric: 34, field: 32, document: 34, query: 30 };
    return sizeMap[node.type] || 32;
  }

  function splitNodeLabel(text, maxLen = 4) {
    const value = String(text || "");
    if (value.length <= maxLen) return [value];
    const lines = [];
    for (let i = 0; i < value.length && lines.length < 3; i += maxLen) {
      lines.push(value.slice(i, i + maxLen));
    }
    if (value.length > maxLen * 3) {
      lines[2] = `${lines[2].slice(0, Math.max(1, maxLen - 1))}…`;
    }
    return lines;
  }

  function getEdgePoints(from, to, radiusFrom, radiusTo) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: from.x + ux * radiusFrom,
      y1: from.y + uy * radiusFrom,
      x2: to.x - ux * radiusTo,
      y2: to.y - uy * radiusTo,
      mx: from.x + dx * 0.5,
      my: from.y + dy * 0.5,
    };
  }

  const GRAPH_LEGEND_INSET_Y = 96;
  const GRAPH_PADDING = 48;

  const LAYOUT_TYPE_ORDER = {
    term: 1,
    field: 2,
    metric: 3,
    model: 4,
    document: 5,
    query: 6,
    domain: 7,
  };

  function sortLayerNodes(nodeIds, nodeById) {
    return [...nodeIds].sort((a, b) => {
      const na = nodeById.get(a);
      const nb = nodeById.get(b);
      const oa = LAYOUT_TYPE_ORDER[na?.type] || 99;
      const ob = LAYOUT_TYPE_ORDER[nb?.type] || 99;
      if (oa !== ob) return oa - ob;
      return String(na?.label || "").localeCompare(String(nb?.label || ""), "zh-CN");
    });
  }

  function computeLayout(graph, width, height) {
    const positions = {};
    if (!graph.nodes.length) return positions;

    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const domainIds = new Set(graph.nodes.filter((node) => node.type === "domain").map((node) => node.id));
    const rootId = graph.rootId || graph.nodes[0].id;
    const rootDomainIds = graph.edges
      .filter((edge) => edge.kind === "belong" && edge.from === rootId && domainIds.has(edge.to))
      .map((edge) => edge.to);

    const children = new Map();
    graph.nodes.forEach((node) => children.set(node.id, []));
    graph.edges.forEach((edge) => {
      if (edge.kind === "belong") return;
      children.get(edge.from)?.push(edge.to);
    });

    const layerGapY = 110;
    const nodeGapX = 150;
    const domainY = GRAPH_LEGEND_INSET_Y;
    const startY = rootDomainIds.length ? domainY + layerGapY : domainY;
    const depthOf = new Map([[rootId, 0]]);
    const queue = [rootId];
    const maxDepth = graph.maxDepth || 2;

    while (queue.length) {
      const id = queue.shift();
      const depth = depthOf.get(id);
      if (depth >= maxDepth) continue;
      (children.get(id) || []).forEach((childId) => {
        if (domainIds.has(childId)) return;
        const nextDepth = depth + 1;
        if (!depthOf.has(childId) || depthOf.get(childId) > nextDepth) {
          depthOf.set(childId, nextDepth);
          queue.push(childId);
        }
      });
    }

    const layers = [];
    depthOf.forEach((depth, id) => {
      if (!layers[depth]) layers[depth] = [];
      layers[depth].push(id);
    });

    layers.forEach((layer, li) => {
      const sorted = sortLayerNodes(layer, nodeById);
      const layerWidth = Math.max(0, (sorted.length - 1) * nodeGapX);
      const startX = width / 2 - layerWidth / 2;
      sorted.forEach((id, idx) => {
        positions[id] = { x: startX + idx * nodeGapX, y: startY + li * layerGapY };
      });
    });

    if (rootDomainIds.length) {
      const sortedDomains = sortLayerNodes(rootDomainIds, nodeById);
      const domainWidth = Math.max(0, (sortedDomains.length - 1) * nodeGapX);
      const domainStartX = width / 2 - domainWidth / 2;
      sortedDomains.forEach((id, idx) => {
        positions[id] = { x: domainStartX + idx * nodeGapX, y: domainY };
      });
      const rootPos = positions[rootId];
      if (rootPos) {
        const domainCenterX =
          sortedDomains.length === 1
            ? positions[sortedDomains[0]].x
            : (positions[sortedDomains[0]].x + positions[sortedDomains[sortedDomains.length - 1]].x) / 2;
        rootPos.x = domainCenterX;
      }
    }

    const domainParents = new Map();
    graph.edges.forEach((edge) => {
      if (edge.kind !== "belong" || !domainIds.has(edge.to) || edge.from === rootId) return;
      if (!domainParents.has(edge.to)) domainParents.set(edge.to, []);
      domainParents.get(edge.to).push(edge.from);
    });

    domainParents.forEach((parentIds, domainId) => {
      const parentPositions = parentIds.map((id) => positions[id]).filter(Boolean);
      if (!parentPositions.length) return;
      const maxY = Math.max(...parentPositions.map((pos) => pos.y));
      const avgX = parentPositions.reduce((sum, pos) => sum + pos.x, 0) / parentPositions.length;
      positions[domainId] = { x: avgX, y: maxY + layerGapY };
    });

    let orphanCol = 0;
    graph.nodes.forEach((node) => {
      if (positions[node.id]) return;
      positions[node.id] = {
        x: 80 + (orphanCol % 4) * nodeGapX,
        y: startY + layers.length * layerGapY + Math.floor(orphanCol / 4) * layerGapY,
      };
      orphanCol += 1;
    });

    return positions;
  }

  function renderGraphSvg(svgEl, graph, positions, selectedId, onSelect) {
    if (!svgEl) return;
    svgEl.setAttribute("preserveAspectRatio", "xMidYMin meet");
    const padding = GRAPH_PADDING;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    graph.nodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;
      const radius = getNodeRadius(node, graph);
      minX = Math.min(minX, pos.x - radius);
      maxX = Math.max(maxX, pos.x + radius);
      minY = Math.min(minY, pos.y - radius);
      maxY = Math.max(maxY, pos.y + radius);
    });

    if (!Number.isFinite(minX)) {
      minX = 0;
      maxX = 480;
      minY = GRAPH_LEGEND_INSET_Y;
      maxY = GRAPH_LEGEND_INSET_Y + 180;
    }

    minX -= padding;
    maxX += padding;
    minY = Math.max(0, minY - padding);
    maxY += padding;
    const width = Math.max(320, maxX - minX);
    const height = Math.max(160, maxY - minY);

    svgEl.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    svgEl.innerHTML = "";

    if (!graph.nodes.length) {
      svgEl.innerHTML = `<text x="${minX + width / 2}" y="${minY + height / 2}" text-anchor="middle" fill="#98a2b3" font-size="13">暂无血缘数据，请先在左侧选择资产或完成术语/指标挂载</text>`;
      return [minX, minY, width, height];
    }

    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    edgeLayer.setAttribute("class", "lineage-edge-layer");
    graph.edges.forEach((edge) => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      const fromNode = nodeById.get(edge.from);
      const toNode = nodeById.get(edge.to);
      if (!from || !to || !fromNode || !toNode) return;

      const isWeak = edge.style === "dashed" || edge.style === "dotted";
      const points = getEdgePoints(
        from,
        to,
        getNodeRadius(fromNode, graph),
        getNodeRadius(toNode, graph)
      );
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", points.x1);
      line.setAttribute("y1", points.y1);
      line.setAttribute("x2", points.x2);
      line.setAttribute("y2", points.y2);
      line.setAttribute("stroke", "#9aa3ad");
      line.setAttribute("stroke-width", "1.4");
      if (isWeak) line.setAttribute("stroke-dasharray", "7 5");
      edgeLayer.appendChild(line);

      if (edge.label) {
        const labelWidth = Math.max(28, edge.label.length * 11 + 10);
        const labelHeight = 16;
        const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        labelBg.setAttribute("x", points.mx - labelWidth / 2);
        labelBg.setAttribute("y", points.my - labelHeight / 2 - 1);
        labelBg.setAttribute("width", labelWidth);
        labelBg.setAttribute("height", labelHeight);
        labelBg.setAttribute("rx", "2");
        labelBg.setAttribute("fill", "#ffffff");
        labelBg.setAttribute("stroke", "none");
        edgeLayer.appendChild(labelBg);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", points.mx);
        label.setAttribute("y", points.my + 4);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", "#667085");
        label.setAttribute("font-size", "11");
        label.textContent = edge.label;
        edgeLayer.appendChild(label);
      }
    });
    svgEl.appendChild(edgeLayer);

    const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeLayer.setAttribute("class", "lineage-node-layer");
    graph.nodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;
      const meta = NODE_META[node.type] || NODE_META.term;
      const radius = getNodeRadius(node, graph);
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "lineage-node");
      g.dataset.nodeId = node.id;
      g.style.cursor = "pointer";

      if (node.id === selectedId) {
        const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        halo.setAttribute("cx", pos.x);
        halo.setAttribute("cy", pos.y);
        halo.setAttribute("r", radius + 5);
        halo.setAttribute("fill", "none");
        halo.setAttribute("stroke", meta.stroke);
        halo.setAttribute("stroke-width", "2.5");
        g.appendChild(halo);
      }

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pos.x);
      circle.setAttribute("cy", pos.y);
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", meta.fill);
      circle.setAttribute("stroke", meta.stroke);
      circle.setAttribute("stroke-width", node.id === graph.rootId ? "2.5" : meta.dashed ? "2.2" : "1.2");
      if (meta.dashed) circle.setAttribute("stroke-dasharray", "5 3");
      g.appendChild(circle);

      const lines = splitNodeLabel(node.label, radius >= 40 ? 4 : 3);
      const lineHeight = 14;
      const textStartY = pos.y - ((lines.length - 1) * lineHeight) / 2;
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", pos.x);
      text.setAttribute("y", textStartY);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", meta.text);
      text.setAttribute("font-size", radius >= 40 ? "13" : "12");
      text.setAttribute("font-weight", node.id === graph.rootId ? "600" : "500");
      lines.forEach((line, index) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", pos.x);
        tspan.setAttribute("dy", index === 0 ? "0" : lineHeight);
        tspan.textContent = line;
        text.appendChild(tspan);
      });
      g.appendChild(text);

      g.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect?.(node);
      });
      nodeLayer.appendChild(g);
    });
    svgEl.appendChild(nodeLayer);
    return [minX, minY, width, height];
  }

  function mount(deps = {}) {
    const setTip = typeof deps.setTip === "function" ? deps.setTip : () => {};
    const switchCatalog = deps.switchCatalog;

    const listEl = document.getElementById("lineageAssetList");
    const svgEl = document.getElementById("lineageGraphSvg");
    const wrapEl = document.getElementById("lineageGraphWrap");
    const detailEl = document.getElementById("lineageDetailPanel");
    const searchEl = document.getElementById("lineageSearchInput");
    const projectFilterEl = document.getElementById("lineageProjectFilter");
    const domainFilterEl = document.getElementById("lineageDomainFilter");
    const depthEl = document.getElementById("lineageDepthSelect");
    const onlineEl = document.getElementById("lineageOnlineOnly");
    const zoomLabelEl = document.getElementById("lineageZoomLabel");
    const zoomInBtn = document.getElementById("lineageZoomInBtn");
    const zoomOutBtn = document.getElementById("lineageZoomOutBtn");
    const builder = createGraphBuilder();

    const ZOOM_MIN = 0.4;
    const ZOOM_MAX = 2.5;
    const ZOOM_STEP = 1.15;
    const DEFAULT_ZOOM = 0.5;

    let perspective = "model";
    let selectedAssetKey = "";
    let selectedNodeId = "";
    let currentGraph = { nodes: [], edges: [], rootId: null };
    let baseViewBox = null;
    let zoomLevel = DEFAULT_ZOOM;
    let panX = 0;
    let panY = 0;
    let panState = null;

    function getDepth() {
      return Number(depthEl?.value || 2);
    }

    function onlineOnly() {
      return onlineEl ? onlineEl.checked : false;
    }

    function getProjectFilter() {
      return (projectFilterEl?.value || "").trim();
    }

    function getDomainFilter() {
      return (domainFilterEl?.value || "").trim();
    }

    function syncFilterOptions() {
      const projects = collectProjectOptions();
      const domains = collectDomainOptions();
      const currentProject = getProjectFilter();
      const currentDomain = getDomainFilter();

      if (projectFilterEl) {
        projectFilterEl.innerHTML = `<option value="">全部工程</option>${projects
          .map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`)
          .join("")}`;
        projectFilterEl.value = !currentProject || projects.includes(currentProject) ? currentProject : "";
      }

      if (domainFilterEl) {
        domainFilterEl.innerHTML = `<option value="">全部数据域</option>${domains
          .map((domain) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`)
          .join("")}`;
        domainFilterEl.value = !currentDomain || domains.includes(currentDomain) ? currentDomain : "";
      }
    }

    function listAssets() {
      const q = (searchEl?.value || "").trim().toLowerCase();
      const projectFilter = getProjectFilter();
      const domainFilter = getDomainFilter();

      if (perspective === "term") {
        return readTerms()
          .filter(
            (t) =>
              matchesDataScope(t) &&
              matchesProjectFilter(t, projectFilter) &&
              matchesDomainFilter(t, domainFilter) &&
              (!q || t.name.toLowerCase().includes(q) || String(t.synonyms || "").toLowerCase().includes(q))
          )
          .map((t) => ({
            key: t.id,
            label: t.name,
            sub: t.domain || "",
            badge: isOnlineTerm(t) ? "已上线" : "未上线",
          }));
      }
      if (perspective === "metric") {
        return readMetrics()
          .filter((m) => {
            const enriched = { ...m, project: resolveMetricProject(m) };
            return (
              matchesDataScope(m) &&
              matchesProjectFilter(enriched, projectFilter) &&
              matchesDomainFilter(m, domainFilter) &&
              (!q || m.name.toLowerCase().includes(q) || String(m.caliber || "").toLowerCase().includes(q))
            );
          })
          .map((m) => ({
            key: m.id,
            label: m.name,
            sub: m.kind === "derived" ? "派生" : "基础",
            badge: isPublishedMetric(m) ? "已发布" : "草稿",
          }));
      }
      if (perspective === "document") {
        return listDocuments()
          .filter(
            (d) =>
              matchesDataScope(d) &&
              matchesProjectFilter(d, projectFilter) &&
              matchesDomainFilter(d, domainFilter) &&
              (!q || d.name.toLowerCase().includes(q))
          )
          .map((d) => ({
            key: d.id,
            label: d.name,
            sub: d.domain || "",
            badge: d.online === false ? "未上线" : "已上线",
          }));
      }
      return listModels()
        .filter(
          (m) =>
            matchesDataScope(m) &&
            matchesProjectFilter(m, projectFilter) &&
            matchesDomainFilter(m, domainFilter) &&
            (!q || m.name.toLowerCase().includes(q))
        )
        .map((m) => ({
          key: m.id,
          label: m.name,
          sub: m.domain || "模型",
          badge: m.bridge?.publishStatus === "published" ? "已发布" : "草稿",
        }));
    }

    function buildGraph() {
      const depth = getDepth();
      const onlyOnline = onlineOnly();
      if (!selectedAssetKey) return { rootId: null, nodes: [], edges: [], maxDepth: depth };
      if (perspective === "term") return { ...builder.buildFromTerm(selectedAssetKey, depth, onlyOnline), maxDepth: depth };
      if (perspective === "metric") return { ...builder.buildFromMetric(selectedAssetKey, depth, onlyOnline), maxDepth: depth };
      if (perspective === "document") return { ...builder.buildFromDocument(selectedAssetKey, depth, onlyOnline), maxDepth: depth };
      return { ...builder.buildFromModel(selectedAssetKey, depth, onlyOnline), maxDepth: depth };
    }

    function renderDetail(node) {
      if (!detailEl) return;
      if (!node) {
        detailEl.innerHTML = `<p class="lineage-detail-empty">选择节点查看详情</p>`;
        return;
      }
      const meta = NODE_META[node.type] || {};
      const jumpLabel = {
        term: "术语中心",
        metric: "结构语义 · 指标",
        model: "结构语义 · 模型",
        document: "文档中心",
      }[node.type];
      detailEl.innerHTML = `
        <div class="lineage-detail-card">
          <div class="lineage-detail-type" style="color:${meta.color}">${meta.label || node.type}</div>
          <h4 class="lineage-detail-title">${escapeHtml(node.label)}</h4>
          ${node.status && node.type !== "domain" ? `<p class="lineage-detail-meta">状态：${escapeHtml(node.status)}</p>` : ""}
          ${node.type === "domain" ? `<p class="lineage-detail-meta">业务域节点，关联资产通过「归属」关系挂接。</p>` : ""}
          ${node.meta?.domain && node.type !== "domain" ? `<p class="lineage-detail-meta">数据域：${escapeHtml(node.meta.domain)}</p>` : ""}
          ${node.meta?.modelName ? `<p class="lineage-detail-meta">所属模型：${escapeHtml(node.meta.modelName)}</p>` : ""}
          ${node.meta?.kind ? `<p class="lineage-detail-meta">类型：${node.meta.kind === "derived" ? "派生指标" : "基础指标"}</p>` : ""}
          ${
            jumpLabel && switchCatalog
              ? `<button class="lineage-detail-jump" type="button" data-lineage-jump="${node.type}">在${jumpLabel}查看</button>`
              : ""
          }
        </div>`;
      detailEl.querySelector("[data-lineage-jump]")?.addEventListener("click", () => {
        if (node.type === "term") switchCatalog("term");
        else if (node.type === "metric") switchCatalog("metric");
        else if (node.type === "document") switchCatalog("document");
        else switchCatalog("data-model");
        setTip(`已切换到${jumpLabel}，可在列表中继续编辑「${node.label}」`);
      });
    }

    function updateZoomControls() {
      if (zoomLabelEl) zoomLabelEl.textContent = `${Math.round(zoomLevel * 100)}%`;
      if (zoomInBtn) zoomInBtn.disabled = zoomLevel >= ZOOM_MAX - 0.001;
      if (zoomOutBtn) zoomOutBtn.disabled = zoomLevel <= ZOOM_MIN + 0.001;
    }

    function getViewportViewBox() {
      const [bx, by, bw, bh] = baseViewBox;
      const w = bw / zoomLevel;
      const h = bh / zoomLevel;
      return {
        x: bx + (bw - w) / 2 + panX,
        y: by + panY,
        w,
        h,
      };
    }

    function syncPanFromViewBox(x, y, w) {
      const [bx, by, bw, bh] = baseViewBox;
      panX = x - (bx + (bw - w) / 2);
      panY = y - by;
    }

    function applyViewport() {
      if (!svgEl || !baseViewBox) return;
      const v = getViewportViewBox();
      svgEl.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
      updateZoomControls();
    }

    function applyDefaultViewport() {
      if (!svgEl || !baseViewBox) return;
      zoomLevel = DEFAULT_ZOOM;
      panX = 0;
      panY = 0;
      applyViewport();
    }

    function fitGraphToView() {
      if (!svgEl || !wrapEl || !baseViewBox) return;
      const rect = wrapEl.getBoundingClientRect();
      const [, , bw, bh] = baseViewBox;
      zoomLevel = 1;
      panX = 0;
      panY = 0;
      if (rect.width > 0 && rect.height > 0 && bw > 0 && bh > 0) {
        const paddingX = 32;
        const paddingY = 24;
        const availW = Math.max(120, rect.width - paddingX * 2);
        const availH = Math.max(120, rect.height - paddingY * 2);
        if (bw > availW || bh > availH) {
          zoomLevel = Math.max(bw / availW, bh / availH);
        }
      }
      applyViewport();
    }

    function resetViewport() {
      applyDefaultViewport();
    }

    function setZoomLevel(next) {
      zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      applyViewport();
    }

    function zoomIn() {
      setZoomLevel(zoomLevel * ZOOM_STEP);
    }

    function zoomOut() {
      setZoomLevel(zoomLevel / ZOOM_STEP);
    }

    function zoomAtPointer(clientX, clientY, factor) {
      if (!svgEl || !baseViewBox) return;
      const nextLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel * factor));
      if (nextLevel === zoomLevel) return;

      const rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        setZoomLevel(nextLevel);
        return;
      }

      const vb = svgEl.viewBox.baseVal;
      const sx = (clientX - rect.left) / rect.width;
      const sy = (clientY - rect.top) / rect.height;
      const px = vb.x + sx * vb.width;
      const py = vb.y + sy * vb.height;

      zoomLevel = nextLevel;
      const [, , bw, bh] = baseViewBox;
      const newW = bw / zoomLevel;
      const newH = bh / zoomLevel;
      const newX = px - sx * newW;
      const newY = py - sy * newH;
      syncPanFromViewBox(newX, newY, newW);
      applyViewport();
    }

    function shouldStartPan(target) {
      if (!target?.closest) return false;
      if (target.closest(".lineage-graph-toolbar")) return false;
      if (target.closest(".lineage-legend")) return false;
      if (target.closest(".lineage-node")) return false;
      return true;
    }

    function onPanStart(event) {
      if (event.button !== 0 || !baseViewBox || !shouldStartPan(event.target)) return;
      panState = {
        startX: event.clientX,
        startY: event.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      wrapEl?.classList.add("is-panning");
      event.preventDefault();
    }

    function onPanMove(event) {
      if (!panState || !svgEl || !baseViewBox) return;
      const rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const vb = svgEl.viewBox.baseVal;
      const scaleX = vb.width / rect.width;
      const scaleY = vb.height / rect.height;
      const dx = event.clientX - panState.startX;
      const dy = event.clientY - panState.startY;
      panX = panState.startPanX - dx * scaleX;
      panY = panState.startPanY - dy * scaleY;
      applyViewport();
    }

    function onPanEnd() {
      if (!panState) return;
      panState = null;
      wrapEl?.classList.remove("is-panning");
    }

    function renderGraph(preserveView = false) {
      if (!preserveView) {
        zoomLevel = DEFAULT_ZOOM;
        panX = 0;
        panY = 0;
      }
      currentGraph = buildGraph();
      const width = 680;
      const height = 420;
      const positions = computeLayout(currentGraph, width, height);
      baseViewBox = renderGraphSvg(svgEl, currentGraph, positions, selectedNodeId, (node) => {
        selectedNodeId = node.id;
        renderDetail(node);
        renderGraph(true);
      });
      if (preserveView) applyViewport();
      else applyDefaultViewport();
      if (!selectedNodeId && currentGraph.rootId) {
        const rootNode = currentGraph.nodes.find((n) => n.id === currentGraph.rootId);
        renderDetail(rootNode || null);
      }
    }

    function renderList() {
      if (!listEl) return;
      const items = listAssets();
      if (!items.length) {
        listEl.innerHTML = `<div class="lineage-list-empty">暂无${PERSPECTIVE_LABELS[perspective]}数据</div>`;
        selectedAssetKey = "";
        renderGraph();
        return;
      }
      if (!items.some((item) => item.key === selectedAssetKey)) {
        selectedAssetKey = items[0].key;
        selectedNodeId = "";
      }
      listEl.innerHTML = items
        .map(
          (item) => `
        <button type="button" class="lineage-list-item ${item.key === selectedAssetKey ? "is-active" : ""}" data-lineage-asset="${escapeHtml(item.key)}">
          <span class="lineage-list-item-name">${escapeHtml(item.label)}</span>
          <span class="lineage-list-item-sub">${escapeHtml(item.sub)}</span>
          <span class="lineage-list-item-badge">${escapeHtml(item.badge)}</span>
        </button>`
        )
        .join("");
      listEl.querySelectorAll("[data-lineage-asset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedAssetKey = btn.dataset.lineageAsset;
          selectedNodeId = "";
          renderList();
          renderGraph();
        });
      });
      renderGraph();
    }

    function renderAll() {
      syncFilterOptions();
      renderList();
    }

    document.querySelectorAll("[data-lineage-perspective]").forEach((btn) => {
      btn.addEventListener("click", () => {
        perspective = btn.dataset.lineagePerspective || "model";
        document.querySelectorAll("[data-lineage-perspective]").forEach((el) => {
          el.classList.toggle("active", el.dataset.lineagePerspective === perspective);
        });
        selectedAssetKey = "";
        selectedNodeId = "";
        renderAll();
      });
    });

    searchEl?.addEventListener("input", renderList);
    projectFilterEl?.addEventListener("change", () => {
      selectedAssetKey = "";
      selectedNodeId = "";
      renderList();
      const project = getProjectFilter();
      const domain = getDomainFilter();
      if (project || domain) {
        const parts = [project && `工程「${project}」`, domain && `数据域「${domain}」`].filter(Boolean);
        setTip(`已按${parts.join("、")}筛选资产列表`);
      } else {
        setTip("已显示全部工程与数据域");
      }
    });
    domainFilterEl?.addEventListener("change", () => {
      selectedAssetKey = "";
      selectedNodeId = "";
      renderList();
      const project = getProjectFilter();
      const domain = getDomainFilter();
      if (project || domain) {
        const parts = [project && `工程「${project}」`, domain && `数据域「${domain}」`].filter(Boolean);
        setTip(`已按${parts.join("、")}筛选资产列表`);
      } else {
        setTip("已显示全部工程与数据域");
      }
    });
    depthEl?.addEventListener("change", () => renderGraph(false));
    onlineEl?.addEventListener("change", () => renderGraph(false));
    document.getElementById("lineageRefreshBtn")?.addEventListener("click", renderAll);
    document.getElementById("lineageFitBtn")?.addEventListener("click", () => fitGraphToView());
    zoomInBtn?.addEventListener("click", zoomIn);
    zoomOutBtn?.addEventListener("click", zoomOut);

    wrapEl?.addEventListener(
      "wheel",
      (event) => {
        if (!baseViewBox) return;
        event.preventDefault();
        const factor = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        zoomAtPointer(event.clientX, event.clientY, factor);
      },
      { passive: false }
    );

    wrapEl?.addEventListener("mousedown", onPanStart);
    document.addEventListener("mousemove", onPanMove);
    document.addEventListener("mouseup", onPanEnd);

    window.addEventListener("biz-terms-updated", renderAll);
    window.addEventListener("biz-metrics-updated", renderAll);
    window.addEventListener("biz-field-terms-updated", renderAll);

    return { render: renderAll, refresh: renderAll };
  }

  global.LineageModule = { mount, createGraphBuilder, computeLayout };
})(window);
