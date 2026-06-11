#!/usr/bin/env python3
"""Parse abilities.md → characters.json"""
import re, json, sys

with open('/home/cc/ai-projects/game-omo-1/doc/abilities.md', 'r') as f:
    text = f.read()

lines = text.split('\n')

teams: list[dict] = []
current_team = None
current_char = None
CHAR_KEYS = ['icon', 'normal', 'win', 'lose', 'skill', 'race', 'ability', 'personality', 'mahjong_skill']
reading_table = False
table_row = 0
# 所有角色的查询表（id → dict），用于补全引用角色的信息
char_lookup: dict[str, dict] = {}

def flush_char():
    global current_char, current_team
    if current_char and current_team:
        if current_char.get('nameCN') or current_char.get('nameJP'):
            if 'members' not in current_team:
                current_team['members'] = []
            current_team['members'].append(current_char)
            # 存入查询表（引用条目信息不全，会被后面的完整条目覆盖）
            cid = current_char.get('id')
            if cid:
                if cid not in char_lookup:
                    char_lookup[cid] = dict(current_char)
                elif not current_char.get('ref'):
                    # 非引用条目覆盖引用条目的占位数据
                    char_lookup[cid].update({k: v for k, v in current_char.items() if k != 'ref'})
        current_char = None

def flush_team():
    global current_team
    if current_team:
        teams.append(current_team)
        current_team = None

for line in lines:
    stripped = line.rstrip()

    # Team header: # thXX title or # group title (players/ftg/qita/pc98)
    m = re.match(r'^#\s+((?:th\d{2}|players|ftg|qita|pc98))\s+(.+)$', stripped)
    if m:
        flush_char()
        flush_team()
        current_team = {'teamId': m.group(1), 'teamName': m.group(2)}
        reading_table = False
        continue

    # Anchor for character
    m = re.match(r'^<a\s+name="([^"]+)"', stripped)
    if m:
        flush_char()
        current_char = {'id': m.group(1)}
        reading_table = False
        table_row = 0
        continue

    # Reference character: ## 参考：ref_id CN(JP) / EN
    if '参考：' in stripped:
        m = re.match(r'^##\s+参考：\s*(\S+)\s+(.+?)\(([^)]+)\)\s*/\s*(.+)$', stripped)
        if m and current_char:
            current_char['id'] = m.group(1)  # use the referenced id
            current_char['nameCN'] = m.group(2).strip()
            current_char['nameJP'] = m.group(3).strip()
            current_char['nameEN'] = m.group(4).strip()
            current_char['ref'] = True
            reading_table = False
            table_row = 0
            continue

    # Character header: ## id CN(JP) / EN
    m = re.match(r'^##\s+(\S+)\s+(.+?)\(([^)]+)\)\s*/\s*(.+)$', stripped)
    if m:
        char_id = m.group(1)
        if current_char and current_char.get('id') == char_id and 'nameCN' not in current_char:
            current_char['nameCN'] = m.group(2).strip()
            current_char['nameJP'] = m.group(3).strip()
            current_char['nameEN'] = m.group(4).strip()
        reading_table = False
        table_row = 0
        continue

    # ## 非角色标题（如附录）→ 清除当前角色，防止后续表格数据污染
    if stripped.startswith('## '):
        flush_char()
        reading_table = False
        table_row = 0
        continue

    # Character header without JP: ## id CN / EN  
    m = re.match(r'^##\s+(\S+)\s+(.+?)\s*/\s*(.+)$', stripped)
    if m and not re.match(r'^##\s+th\d{2}', stripped):
        char_id = m.group(1)
        if current_char and current_char.get('id') == char_id and 'nameCN' not in current_char:
            current_char['nameCN'] = m.group(2).strip()
            current_char['nameEN'] = m.group(3).strip()
        reading_table = False
        table_row = 0
        continue

    # Table lines for character stats
    if stripped.startswith('|'):
        if '立绘' in stripped or '値' in stripped or '------' in stripped:
            reading_table = True
            table_row = 0
            continue
        if reading_table and current_char:
            table_row += 1
            parts = [p.strip() for p in stripped.split('|')[1:-1]]
            if len(parts) >= 2:
                key_idx = table_row - 1
                if key_idx < len(CHAR_KEYS):
                    current_char[CHAR_KEYS[key_idx]] = parts[1]
        continue
    else:
        if reading_table and stripped == '':
            reading_table = False
            table_row = 0

# Flush remaining
flush_char()
flush_team()

# 补全引用角色的信息（从原始条目复制全部关键字段，覆盖 Saki 附录可能的污染）
FILL_KEYS = ['race', 'ability', 'personality', 'mahjong_skill', 'icon', 'normal', 'win', 'lose', 'skill']
for t in teams:
    for m in t['members']:
        if m.get('ref') and m['id'] in char_lookup:
            src = char_lookup[m['id']]
            for key in FILL_KEYS:
                m[key] = src.get(key, '')

print(f"Parsed {len(teams)} teams, {sum(len(t['members']) for t in teams)} total characters", file=sys.stderr)
for t in teams:
    print(f"  {t['teamId']}: {t['teamName']} ({len(t['members'])} chars)", file=sys.stderr)

with open('/home/cc/ai-projects/game-omo-1/public/characters.json', 'w', encoding='utf-8') as f:
    json.dump(teams, f, ensure_ascii=False, indent=2)

print("Done! Written to public/characters.json", file=sys.stderr)
