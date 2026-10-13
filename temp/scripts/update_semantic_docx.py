# -*- coding: utf-8 -*-
"""Update 业务语义层产品方案.docx: 结论前置 + 章节一补充权限中心"""
import shutil
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph

SRC = Path(r"c:\Users\liuy-eh\Desktop\业务语义层产品方案.docx")
BAK = SRC.with_suffix(".docx.bak")


def find_para(doc, prefix):
    for p in doc.paragraphs:
        if p.text.strip().startswith(prefix):
            return p
    return None


def insert_paragraph_after(paragraph, text="", style="Normal"):
    """Insert a fresh empty paragraph after `paragraph`."""
    new_p = OxmlElement("w:p")
    paragraph._p.addnext(new_p)
    new_para = Paragraph(new_p, paragraph._parent)
    if style:
        try:
            new_para.style = style
        except Exception:
            pass
    if text:
        new_para.add_run(text)
    return new_para


def remove_between(start_para, end_para):
    """Remove paragraphs strictly between start and end (exclusive)."""
    to_remove = []
    collecting = False
    for p in start_para._parent.paragraphs:
        el = p._element
        if el is start_para._element:
            collecting = True
            continue
        if end_para and el is end_para._element:
            break
        if collecting and p.text.strip():
            to_remove.append(el)
    for el in to_remove:
        parent = el.getparent()
        if parent is not None:
            parent.remove(el)


def set_para_text(para, text):
    para.clear()
    para.add_run(text)


def insert_block_after(anchor, items):
    cur = anchor
    for style, text in items:
        cur = insert_paragraph_after(cur, text, style)
    return cur


CONCLUSION_PARAS = [
    (
        "Normal",
        "业务语义层是数据中台面向智能问数等消费端的「可发布、可授权、可复用」语义资产层，规定业务上能问什么、怎么算、用哪个词、谁能看。",
    ),
    (
        "Normal",
        "核心结论一（术语定语言）：术语表为 LLM 提供业务语言的确定性映射锚点。语义模型定义「数据是什么」，术语表定义「用户怎么说」，两者叠加，智能问数才能从「能生成 SQL」走向「生成正确的 SQL」。",
    ),
    (
        "Normal",
        "核心结论二（结构语义定口径）：域模型/基础模型承载字段与 Join 关系，指标承载公式/SQL 与维度配置，是计算一致性的唯一来源；Prompt 可引导模型，但不能替代已发布的指标口径与绑模型校验。",
    ),
    (
        "Normal",
        "核心结论三（文档定依据）：知识文档按数据域管理，挂接模型后为问数提供口径解释与指标切片依据，与术语、指标共同构成可审计的语义解释链。",
    ),
    (
        "Normal",
        "核心结论四（权限定边界）：权限中心按工程配置「角色 → 模型 → 可选行权限」逐条策略，建模端列表/预览与问数 MCP 消费端须透传同一数据范围；仅靠语义定义无法保障安全边界，必须显式策略验证。",
    ),
    (
        "Normal",
        "建设路径：1030 术语中心 → 1130 语义权限体系 → 1230 指标中心 + 语义/数据血缘；术语、模型、指标、文档汇合后经「同步到问数」进入智能问数，权限策略全链路生效。",
    ),
    (
        "Normal",
        "MVP 验收闭环：术语挂载字段并 MCP 命中标准问句；销售角色仅见销售域+本部门数据（列表/预览/问数三处一致）；指标审核发布后 MCP 返回答案与口径。",
    ),
]

SECTION_13 = [
    ("Heading 3", "1.3 权限中心对语义模型的价值"),
    ("Normal", "第四层：访问控制——解决「同一语义，不同角色可见范围不同」"),
    (
        "Normal",
        "语义资产（术语、模型、指标、文档）完成定义与发布后，消费端仍须受平台角色与行级权限约束。销售专员不应看到其他部门的合同额，区域经理不应越权访问未授权模型。权限中心将「谁能看、能看到哪些行」从问数 Prompt 中剥离，变为可配置、可预览、可审计的策略资产。",
    ),
    (
        "Normal",
        "在工具链语义层的解决思路：按所属工程隔离策略；每条策略依次选择平台角色、搜索并授权模型（或工程内全部模型）、可选启用行权限（字段=固定值，或字段=用户属性如 org_id，支持含本下级组织）。模型编辑侧登记可用于行过滤的字段（如 dept_id、project_id、biz_line_code），实际规则在权限中心配置；配置完成后通过「数据预览验证」模拟顶栏用户，确认可见行数与过滤条件。",
    ),
    ("Normal", "权限中心与其他模块的协同："),
    (
        "Normal",
        "• 与结构语义·模型：策略授权到具体模型；模型 rowFilter 字段供策略引用；未授权模型在列表与问数语义包中不可见。",
    ),
    (
        "Normal",
        "• 与术语/指标/文档：域级可见范围过滤左侧树与列表；已发布资产同步到问数时须叠加当前用户策略与 rowFilter。",
    ),
    (
        "Normal",
        "• 与智能问数/MCP：问数 MCP 网关透传用户身份，get_semantic_package / query_metric 自动注入 rowFilter；销售与管理员同一 query 结果范围不同。",
    ),
    (
        "Normal",
        "• 与语义首页：血缘图谱按工程/域/上线状态筛选；权限范围外的资产不参与浏览（与列表过滤一致）。",
    ),
    (
        "Normal",
        "权限与术语三层作用的关系：术语解决「说的是否同一回事」，指标/模型解决「算的是否同一口径」，权限中心解决「看的是否授权范围内的数」——三者缺一不可，共同构成可治理的语义层。",
    ),
]

SECTION_24 = [
    ("Normal", "权限中心是语义建模的一级 Tab，与术语中心、结构语义、文档中心并列，按工程管理访问策略。"),
    ("Normal", "2.4.1 策略配置（按工程 · 逐条）"),
    (
        "Normal",
        "入口：语义模型 → 权限中心。选择策略所属工程后，以列表管理策略；点击「添加策略」进入三步表单：① 选择平台角色（数据管理员、销售专员、销售经理、区域经理、语义查看者等）；② 搜索并选定授权模型，或勾选「授权工程内全部模型」；③ 可选启用行权限——模式为「字段=固定值」或「字段=用户属性值（org_id / tenant_id）」，支持组织属性含本下级。策略可启用/关闭，关闭后不参与权限计算。",
    ),
    ("Normal", "2.4.2 模型侧行权限字段登记"),
    (
        "Normal",
        "入口：结构语义 → 模型编辑 → 顶栏「数据集行权限」。建模人员登记模型可用于行过滤的字段名与固定值示例（供配置参考）；实际生效规则在权限中心策略中维护。",
    ),
    ("Normal", "2.4.3 数据预览验证"),
    (
        "Normal",
        "入口：权限中心 → 数据预览验证。选择验证模型，结合顶栏「模拟用户」与列表「所属工程」，点击「刷新预览」加载样例数据，展示当前策略下的可见行数与过滤条件摘要，用于 POC（如水电十四局销售域+本部门场景）联调前自检。",
    ),
    ("Normal", "2.4.4 与问数消费的一致性要求"),
    (
        "Normal",
        "术语列表、模型/指标列表、语义首页筛选、问数 MCP 返回的语义包与查询结果，必须在同一用户身份下数据范围一致；权限变更后支持「强制刷新缓存」（默认 5 分钟 TTL）。",
    ),
]

UPDATE_21 = (
    "语义模型内容设置分四块：术语中心、结构语义、文档中心、权限中心。"
    "术语定语言，结构语义定模型和指标，文档沉淀依据，权限定边界；"
    "四者汇合后同步到问数。"
)

UPDATE_FINAL_PATH = (
    "最终的实现路径：\n"
    "建设术语模块：解决消费端口径漂移；\n"
    "建设复合指标模块：解决规则无法强制情况；\n"
    "建设权限中心：解决多角色、多组织下的语义与数据越权访问；\n"
    "全局保证语义模型对消费端的可复用性、计算一致性与安全边界。"
)


def main():
    if not BAK.exists():
        shutil.copy2(SRC, BAK)
        print(f"backup -> {BAK}")

    doc = Document(SRC)

    h_conclusion = find_para(doc, "结论前置")
    h_chapter1 = find_para(doc, "一、核心依据")

    if h_conclusion and h_chapter1:
        remove_between(h_conclusion, h_chapter1)
        insert_block_after(h_conclusion, CONCLUSION_PARAS)

    for p in doc.paragraphs:
        if p.text.strip().startswith("最终的实现路径"):
            set_para_text(p, UPDATE_FINAL_PATH)
            break

    # Remove duplicate old bullets after 最终的实现路径 if present
    final_p = find_para(doc, "最终的实现路径")
    if final_p:
        remove_targets = []
        collecting = False
        for p in doc.paragraphs:
            if p._element is final_p._element:
                collecting = True
                continue
            if not collecting:
                continue
            if p.style.name.startswith("Heading"):
                break
            t = p.text.strip()
            if t.startswith("建设术语模块") or t.startswith("建设复合指标模块") or t.startswith("全局修复"):
                remove_targets.append(p._element)
        for el in remove_targets:
            parent = el.getparent()
            if parent is not None:
                parent.remove(el)

    if not find_para(doc, "1.3 权限中心"):
        h_12 = find_para(doc, "1.2 术语表与指标定义的分工")
        insert_at = h_12
        seen = False
        for p in doc.paragraphs:
            if p._element is h_12._element:
                seen = True
                continue
            if not seen:
                continue
            if p.style.name.startswith("Heading") and (
                p.text.startswith("核心功能") or p.text.startswith("2.")
            ):
                break
            if p.text.strip():
                insert_at = p
        insert_block_after(insert_at, SECTION_13)

    for p in doc.paragraphs:
        if "语义模型内容设置分" in p.text and "术语中心" in p.text:
            set_para_text(p, UPDATE_21)
            break

    h_24 = find_para(doc, "2.4")
    h_25 = find_para(doc, "2.5")
    if h_24:
        remove_between(h_24, h_25)
        insert_block_after(h_24, SECTION_24)

    doc.save(SRC)
    print(f"updated -> {SRC}")


if __name__ == "__main__":
    main()
