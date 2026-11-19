# Проверки Starsail

Все команды выполняются из корня репозитория. Нужен Node.js 18 или новее;
для проверок Python — Python 3.9 или новее. Каталоги устанавливаются по
[основной инструкции](../README.md#запуск-локально); проверки генераторов
также используют исходные снимки из `data-tools/raw/`.

```sh
node verify.mjs                  # обычный прогон, бюджет 55 секунд
node verify.mjs --extended       # полный прогон, несколько минут
node verify.mjs --extended --list
node tests/verify-map.mjs        # отдельный набор
python3 tests/verify-cosmic-catalogs.py
python3 tests/verify-galaxy-model.py
```

`verify-map.mjs` содержит общий браузерный каркас, используемый остальными
наборами. `catalog-path.mjs` читает актуальный указатель каталога из `dist/`.
Состав обычного и расширенного прогонов задаёт корневой `verify.mjs`;
наборы вне этих списков запускаются напрямую.

Проверки инструментов остаются рядом с инструментами:

```sh
python3 data-tools/test_catalog_artifacts.py
python3 deployment/analytics/verify-setup.py
node deployment/analytics/verify-report.mjs
```
