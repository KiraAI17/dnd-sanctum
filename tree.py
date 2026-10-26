from pathlib import Path

# Папки и файлы, которые нужно игнорировать
IGNORE_DIRS = {'.venv', 'env', 'venv', '.git', '.vscode', '__pycache__', 'node_modules', 'dist', 'build', '.idea'}


def generate_tree(path: Path, prefix: str = '') -> list[str]:
    lines = []
    # Сортируем: сначала папки, потом файлы
    contents = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))

    # Фильтруем игнорируемые директории
    contents = [c for c in contents if not (c.is_dir() and c.name in IGNORE_DIRS)]

    pointers = ['├── '] * (len(contents) - 1) + ['└── '] if contents else []

    for pointer, item in zip(pointers, contents):
        lines.append(f"{prefix}{pointer}{item.name}")
        if item.is_dir():
            extension = '│   ' if pointer == '├── ' else '    '
            lines.extend(generate_tree(item, prefix + extension))

    return lines


if __name__ == '__main__':
    root_dir = Path.cwd()
    tree_lines = [root_dir.name + '/'] + generate_tree(root_dir)
    output_text = '\n'.join(tree_lines)

    # Сохраняем в файл
    with open('directory_structure.txt', 'w', encoding='utf-8') as f:
        f.write(output_text)

    print(output_text)
    print('\nФайл с деревом успешно сохранен в directory_structure.txt')
