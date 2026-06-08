#!/usr/bin/env python3
"""Add <a name='thXX-YY'> anchors before character headers in abilities.md"""
import re, sys

path = sys.argv[1] if len(sys.argv) > 1 else 'doc/abilities.md'

with open(path, encoding='utf-8') as f:
    lines = f.readlines()

result = []
added = 0
for l in lines:
    m = re.match(r'^(#{2,3})\s+(th\d+-\d+[a-z]*|th\d+-ex)\s+', l)
    if m:
        cid = m.group(2)
        # Only add if not already there
        if not result or not result[-1].startswith(f'<a name="{cid}">'):
            result.append(f'<a name="{cid}"></a>\n')
            added += 1
    result.append(l)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f"Added {added} anchors to {path}")
