with open('perfil.html', 'r', encoding='utf-8') as f:
    content = f.read()

print("isProf occurrences:")
for line_no, line in enumerate(content.split('\n'), 1):
    if 'isProf' in line:
        print(f"Line {line_no}: {line.strip()}")

print("\nisStaff occurrences:")
for line_no, line in enumerate(content.split('\n'), 1):
    if 'isStaff' in line:
        print(f"Line {line_no}: {line.strip()}")
