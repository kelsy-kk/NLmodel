/**
 * 与「业务定义页面还原.html」左侧业务知识库目录 treeData 保持一致。
 * 语义资产等页面通过本文件读取主题域（数据域）选项。
 */
(function (global) {
  const pmLeadModules = [
    ["pmlead-project-info", "项目信息"],
    ["pmlead-market", "市场管理"],
    ["pmlead-revenue", "收入管理"],
    ["pmlead-cost", "成本管理"],
    ["pmlead-equipment", "机械设备管理"],
    ["pmlead-material", "物资管理"],
    ["pmlead-labor-subcontract", "劳务分包管理"],
    ["pmlead-professional-subcontract", "专业分包管理"],
    ["pmlead-capital-tax", "资税管理"],
    ["pmlead-production", "生产管理"],
    ["pmlead-quality", "质量管理"],
    ["pmlead-technology", "技术管理"],
    ["pmlead-safety", "安全管理"],
  ];

  const pmLeadProductNode = {
    id: "pmlead-product",
    label: "PMLead产品",
    level: 1,
    children: pmLeadModules.map(([id, label]) => ({
      id,
      label,
      level: 2,
      children: [],
    })),
  };

  const businessBoards = [
    ["biz-data-component", "数据组件"],
    ["biz-production-center", "生产中台"],
    ["biz-safety-management", "安全管理"],
    ["biz-xinqi-platform", "项企平台"],
    ["biz-cost-management", "成本管理"],
    ["biz-data-toolchain", "数据工具链"],
  ];

  const defaultDomainTemplates = [
    ["zhichu", "支出域"],
    ["pbs", "PBS"],
    ["wuzhi", "物资域"],
    ["shouru", "收入域"],
    ["caigou", "采购域"],
    ["shebei", "设备域"],
    ["fengxian", "风险域"],
    ["chengben", "成本域"],
  ];

  const businessBoardNodes = [
    pmLeadProductNode,
    ...businessBoards.map(([id, label]) => ({
      id,
      label,
      level: 1,
      children: defaultDomainTemplates.map(([suffix, domainLabel]) => ({
        id: `${id}-${suffix}`,
        label: domainLabel,
        level: 2,
        children: [],
      })),
    })),
  ];

  const treeData = [
    {
      id: "tree-all",
      label: "全部",
      level: 0,
      children: businessBoardNodes,
    },
  ];

  function collectSubjectDomainOptions() {
    const options = [];
    (treeData[0].children || []).forEach((board) => {
      (board.children || []).forEach((domain) => {
        options.push({
          id: domain.id,
          boardId: board.id,
          boardLabel: board.label,
          domainLabel: domain.label,
          value: `${board.id}::${domain.label}`,
        });
      });
    });
    return options;
  }

  function groupSubjectDomainsByBoard(options) {
    const groups = new Map();
    options.forEach((item) => {
      if (!groups.has(item.boardId)) {
        groups.set(item.boardId, {
          boardId: item.boardId,
          boardLabel: item.boardLabel,
          domains: [],
        });
      }
      groups.get(item.boardId).domains.push(item);
    });
    return Array.from(groups.values());
  }

  global.BusinessNavTree = {
    treeData,
    collectSubjectDomainOptions,
    groupSubjectDomainsByBoard,
  };
})(window);
