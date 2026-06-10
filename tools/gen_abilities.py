#!/usr/bin/env python3
"""
从 abilities.md 生成最终的 HTML 或 Markdown。
支持变量替换：{id}-head 等会根据角色 ID 自动展开。
"""
import re, json, sys
from pathlib import Path

MD = Path(__file__).parent / "abilities.md"

def extract_chars(text):
    """提取所有角色 ID 和名字"""
    chars = []
    for m in re.finditer(r'^## (\S+) (.+)', text, re.M):
        chars.append({"id": m.group(1), "name": m.group(2).split("/")[0].strip()})
    return chars

def expand_vars(text, char_id):
    """把 {id} 替换为角色 ID"""
    return text.replace("{id}", char_id)

def main():
    md_text = MD.read_text(encoding="utf-8")
    
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        chars = extract_chars(md_text)
        for c in chars:
            print(f"{c['id']:20s} {c['name']}")
        return
    
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        # 导出为变量展开后的 md
        # 查找所有角色表格, 替换 {id} 为实际 ID
        result = []
        current_id = None
        for line in md_text.split("\n"):
            m = re.match(r'^## (\S+) ', line)
            if m:
                current_id = m.group(1)
            if current_id:
                line = expand_vars(line, current_id)
            result.append(line)
        
        out = MD.with_suffix(".expanded.md")
        Path(out).write_text("\n".join(result), encoding="utf-8")
        print(f"已展开变量，输出: {out}")
        return
    
    print(f"用法: {sys.argv[0]} list     — 列出所有角色")
    print(f"      {sys.argv[0]} export   — 展开变量生成最终 md")

if __name__ == "__main__":
    main()
