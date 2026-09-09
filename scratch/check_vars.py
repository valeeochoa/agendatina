import re

with open('perfil.html', 'r', encoding='utf-8') as f:
    content = f.read()

print("Occurrences of currentPlan:")
for line_no, line in enumerate(content.split('\n'), 1):
    if 'currentPlan' in line:
        print(f"Line {line_no}: {line.strip()}")

print("\nOccurrences of updatePlanBadge:")
for line_no, line in enumerate(content.split('\n'), 1):
    if 'updatePlanBadge' in line:
        print(f"Line {line_no}: {line.strip()}")
