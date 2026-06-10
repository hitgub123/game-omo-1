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

def flush_char():
    global current_char, current_team
    if current_char and current_team:
        if current_char.get('nameCN') or current_char.get('nameJP'):
            if 'members' not in current_team:
                current_team['members'] = []
            current_team['members'].append(current_char)
        current_char = None

def flush_team():
    global current_team
    if current_team:
        teams.append(current_team)
        current_team = None

for line in lines:
    stripped = line.rstrip()

    # Team header: # thXX title
    m = re.match(r'^#\s+(th\d{2})\s+(.+)$', stripped)
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

print(f"Parsed {len(teams)} teams, {sum(len(t['members']) for t in teams)} total characters", file=sys.stderr)
for t in teams:
    print(f"  {t['teamId']}: {t['teamName']} ({len(t['members'])} chars)", file=sys.stderr)

with open('/home/cc/ai-projects/game-omo-1/public/characters.json', 'w', encoding='utf-8') as f:
    json.dump(teams, f, ensure_ascii=False, indent=2)

print("Done! Written to public/characters.json", file=sys.stderr)
