#!/usr/bin/env python3
"""Assemble a PRD from actual content and reusable document components."""
import argparse
import json
import math
import shutil
import uuid
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from pm_runtime import atomic_write

ROOT = Path(__file__).resolve().parent.parent


class DeviceIds(HTMLParser):
    def __init__(self):
        super().__init__()
        self.counts = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "device" in (attrs.get("class") or "").split() and attrs.get("id"):
            key = attrs["id"]
            self.counts[key] = self.counts.get(key, 0) + 1

    handle_startendtag = handle_starttag


def validate_pages(pages, output):
    if not isinstance(pages, list):
        raise ValueError("页面目录必须是数组；仅文档使用 []")
    seen, devices = set(), {}
    prototype_root = (output.parent.parent / "原型").resolve()
    for index, page in enumerate(pages, 1):
        if not isinstance(page, dict):
            raise ValueError(f"第{index}个页面必须是对象")
        for key in ("value", "label", "url"):
            if not isinstance(page.get(key), str) or not page[key].strip():
                raise ValueError(f"第{index}个页面的 {key} 必须是非空字符串")
        if page["value"] in seen:
            raise ValueError("页面编号重复")
        seen.add(page["value"])
        for key in ("w", "h"):
            size = page.get(key)
            if isinstance(size, bool) or not isinstance(size, (int, float)) or not math.isfinite(size) or size <= 0:
                raise ValueError(f"页面 {key} 必须是有限的正数")
        url = urlsplit(page["url"])
        if url.scheme or url.netloc or not url.path.startswith("../原型/"):
            raise ValueError("页面应使用同需求原型的相对路径")
        fragment = unquote(url.fragment)
        if fragment != page["value"]:
            raise ValueError("页面 URL 锚点必须与 value 一致")
        target = (output.parent / unquote(url.path)).resolve()
        target.relative_to(prototype_root)
        if not target.is_file():
            raise FileNotFoundError(str(target))
        if target not in devices:
            parser = DeviceIds()
            parser.feed(target.read_text(encoding="utf-8"))
            devices[target] = parser.counts
        if devices[target].get(fragment, 0) != 1:
            raise ValueError(f"原型中应有唯一的 .device[id={fragment}] 状态")


def build(content, pages, output, overwrite=False):
    output = Path(output).resolve()
    output.relative_to(ROOT)  # 校验输出必须位于项目目录内，越界即抛 ValueError
    if output.parent.name != "需求文档": raise ValueError("输出必须位于需求文档目录")
    validate_pages(pages, output)
    template = (ROOT / "templates/prd-shell.html").read_text(encoding="utf-8")
    values = {"CONTENT": content, "PAGES": json.dumps(pages, ensure_ascii=False).replace("<", "\\u003c"),
              "SERVICE": (ROOT / "scripts/prototype-export-client.js").read_text(encoding="utf-8"),
              "DOCUMENT": (ROOT / "scripts/pm-document.js").read_text(encoding="utf-8")}
    for key, value in values.items(): template = template.replace("{{" + key + "}}", value)
    if output.exists():
        if not overwrite: raise FileExistsError("文件已存在，复核后使用 --overwrite，覆盖前自动备份")
        backup = ROOT / ".handoff/build-backups" / uuid.uuid4().hex / output.name
        backup.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(output, backup)
    atomic_write(output, template)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", required=True)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    print(build(Path(args.content).read_text(encoding="utf-8"), json.loads(Path(args.pages).read_text(encoding="utf-8")), args.output, args.overwrite))
