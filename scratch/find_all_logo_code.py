import os, re

root_dir = r'c:\xampp\htdocs\agendatina'

print("=== DETAILED SEARCH FOR LOGO & CARD LOGIC ===")
for r, d, files in os.walk(root_dir):
    if '.git' in r or 'scratch' in r: continue
    for f in files:
        if f.endswith('.js') or f.endswith('.html') or f.endswith('.php'):
            path = os.path.join(r, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                for line_no, line in enumerate(file, 1):
                    line_lower = line.lower()
                    if ('logo' in line_lower or 'calendario' in line_lower) and ('card' in line_lower or 'premium' in line_lower or 'nav' in line_lower or 'img' in line_lower):
                        rel_path = os.path.relpath(path, root_dir)
                        print(f"{rel_path}:{line_no}: {line.strip()[:140]}")
