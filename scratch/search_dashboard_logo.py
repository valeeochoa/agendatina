import os, re

js_dir = r'c:\xampp\htdocs\agendatina\assets\js'

print("=== SEARCH FOR 'logo' IN ASSETS/JS ===")
for root, dirs, files in os.walk(js_dir):
    for f in files:
        if f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                for line_no, line in enumerate(file, 1):
                    if 'logo' in line.lower() or 'calendario' in line.lower():
                        if any(term in line.lower() for term in ['card', 'img', 'src', 'avatar', 'icon', 'premium', 'plan']):
                            print(f"{f}:{line_no}: {line.strip()[:120]}")
