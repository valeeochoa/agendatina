import re

with open('perfil.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all IDs in HTML elements: id="..." or id='...'
html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', content))

# Extract all getElementById('...') calls
js_get_ids = set(re.findall(r'document\.getElementById\(["\']([^"\']+)["\']\)', content))

print("=== HTML IDs in perfil.html ===")
print(sorted(list(html_ids)))

print("\n=== JS getElementById IDs in perfil.html ===")
print(sorted(list(js_get_ids)))

missing = js_get_ids - html_ids
print("\n=== MISSING IDs (Accessed by JS but NOT in HTML) ===")

for m in sorted(list(missing)):
    print(f"  ❌ Missing ID: '{m}'")
