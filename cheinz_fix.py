import json
import sqlite3

# Подключаемся к базе данных
conn = sqlite3.connect("dnd_campaign.db")
cursor = conn.cursor()

# Находим персонажей, у которых активна маскировка чейнджлинга
cursor.execute("SELECT id, visual_custom FROM characters WHERE visual_custom LIKE '%disguise_active%'")
rows = cursor.fetchall()

updated = 0
for char_id, vc_raw in rows:
    try:
        vc = json.loads(vc_raw) if isinstance(vc_raw, str) else vc_raw
        if vc.get("disguise_active"):
            # Возвращаем настоящую расу в таблицу базы
            cursor.execute("UPDATE characters SET race = 'Чейнджлинг' WHERE id = ?", (char_id,))
            updated += 1
    except Exception as e:
        print(f"Ошибка парсинга ID {char_id}: {e}")

conn.commit()
conn.close()
print(f"Готово! Восстановлено чейнджлингов: {updated}")