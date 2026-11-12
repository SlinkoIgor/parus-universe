# Full catalog snapshot, 2026-10-25

Актуальная геометрия от 05.11.2026: [единая проекция протяжённых объектов](../docs/projection-geometry.md). Версия раскладки 4 заменяет исторические ручные повороты галактик, 2D-перенос контуров и отбор протяжённых областей по центру.

Current expansion generator: `build-full-catalog.py`. Existing curated core: `curate_catalog.py`; historical `normalize_catalog.py` must not replace the current core.

Distant supplement: `python3 build-distant-catalog.py` reproduces `../dist/distant-catalog-data.js` and `distant-catalog-audit.json` without network access. CCPC-II fields/units and extracted JADES DR4 v1.2 `Obs_info` rows, URLs and SHA-256 values are retained in `distant-sources/`. FITS re-extraction requires astropy and `--extract-from DIR`; original file hashes are checked. Identity, conflict policy and source limitations: [universe-overview.md](../docs/universe-overview.md). This supplement preserves existing tile revisions and adopted positions.

Shared source registry: from the repository root,
`node data-tools/build-map-filter-index.mjs` regenerates both the source census
(`dist/catalog-registry-data.js`) and the small-selection index. It reads the
active immutable catalogue, atlas-only rows, the merged core and additive layers;
it changes no scientific tiles or coordinates. Both the map filter and the
onboard source library consume the same generated entries. Full catalogue builds
run it after the final black-hole supplement; run it after independently updating
an additive layer too. New imports should provide their own `catalog` or
`catalogMeasurements` names; new names are discovered without editing either UI.
Readable legacy aliases live once in `dist/catalog-registry.js`.
`node verify-catalog-registry.mjs` checks reproducibility, whole-record coverage,
source identities, own measurements and the shared filter/library list.
`node data-tools/build-catalog-registry.mjs --check` checks the census alone.

Historical map collections: from the repository root, `node data-tools/build-map-collection-history.mjs`
reproduces `dist/map-collection-history.js` and its HTML cache key without network
access or dependence on the filter UI. Discovery dates are absent from the
scientific catalogues; the separate factual snapshot `map-collection-history.json`
supplies historical collections with source references, original date precision
and uncertainty. This generator does not rewrite catalogue tiles, coordinates or
expedition saves. Definitions and coverage: [map-visualization.md](../docs/map-visualization.md).

Full HYG 4.1 / OpenNGC / ATNF snapshots → 152010 generated atlas records (+40 nuclear stars at runtime), bounded spatial tiles, lazy search worker index, approximate positions and atlas-only uncertain records and catalog system links. Keep source snapshots in ignored `raw/`; derived streaming directories are ignored too and installed from a pinned release archive. See [catalogue artifacts](../docs/catalog-artifacts.md) for installation and packaging, and `../README-AGENT.md` for regeneration, source paths, uncertainty, persistence and validation. Audit: `full-catalog-audit.json`. Run `node verify-stream.mjs`, `node verify-map.mjs`, `node verify.mjs`.

The legacy curated audit `selection-audit.json` still verifies all 652 IAU names and the original nearest30 / brightest500 core. Licenses/provenance: `../dist/catalog-sources.json` and `../THIRD_PARTY_NOTICES.md`.

Hipparcos matched-solution uncertainties: hipparcos-2007.json (I/311) first, I/239 only for reproducing old exceptions. astrometry_policy.py never borrows an error from a different distance; unmatched adopted distances retain unknown sigma. Matched relative errors >50% are atlas-only. Four sourced extragalactic members: `nearby-galaxy-stars.json`, M31 disk estimates and measured directions; R136a1 uses a young-LMC disk model; HD5980 has unresolved SMC depth and remains atlas-only. Megastructure contours remain; every mapped destination supports arrival and a departure star.

Published system memberships and shared-distance exceptions: `confirmed-systems.json`; independently documented Alpha Centauri, Antennae and Cygnus X-1 also retain confirmed links. Update `../docs/catalog.md` with every selection/position rule change.

25.10.2026: formal policy in coordinate-policy.json; disk geometry in disk_geometry.py + galaxy-disk-models.json; observed selection in galaxy-disk-objects.json. Re-import offline with python3 data-tools/import-galaxy-disks.py, or explicitly use --download to refresh CDS snapshots. Regenerate spatial tiles with build-full-catalog.py afterwards. Full selection and placement rules are in docs/catalog.md; per-record audit galaxy-disk-audit.json.

OGLE 2016 Table 3: import-magellanic-cepheids.py (--download explicitly refreshes the author snapshot), 8885 individual Cepheid distances, errors and measured sky positions. Compact input magellanic-cepheids.json; per-record magellanic-cepheid-audit.json; host coverage galaxy-population-coverage.json. Policy v4 excludes unmeasured host-depth records, including PHAT and all ATNF EXGAL. Six measured Cloud Cepheids are bootstrapped as real departure candidates.

Offline geometry audit: `python3 data-tools/audit-map-geometry.py` (Node.js required for the static core). Reads leaf tiles only, checks repeated heliocentric shells, Hough line candidates, ATNF GC distance conflicts, core/system display distortion and astrometric solution provenance. Uses raw/psrcat.db or ../research-data/psrcat.db, as the generator does. Output: map-geometry-audit.json with revision, thresholds, IDs and SHA256. The audit changes no catalog coordinates. Fixes, before/after snapshots and scientific review candidates: ../docs/map-geometry-audit.md; rendering architecture: ../docs/map-visualization.md.


Geometry fixes (policy v4, map version2): shared orthographic Galactic XY for core/stream/free points, bounded compact GC models and coherent host distances, NGC4676 shared published distance and cosmological binding. import-geometry-sources.py reads HIP2007 and authors' GC compilation raw snapshots; compact inputs hipparcos-2007.json / globular-cluster-models.json. import-low-z-distances.py selects explicit independent methods for all 152 low-z targets in the stored SIMBAD ADQL snapshot: 122 independent measurements, one documented system-distance exception (NGC3690A), 29 atlas-only. No invented depth or unrecognized method. Regenerate build-full-catalog.py, run audit-map-geometry.py, then verify-geometry-fixes.mjs. Historical audit retained as map-geometry-audit-before-fixes.json / docs/map-geometry-audit-before-fixes.md. Catalog geometry2 migrates map coordinates and refreshes referenced rows without resetting historical clocks or travelled path.


Black-hole supplement: `node data-tools/build-black-hole-catalog.mjs` from the
repository root reproduces `dist/black-hole-catalog-data.js` and
`data-tools/black-hole-catalog-audit.json` offline. Published compact inputs,
source rows, epochs, units, errors and source URLs are in `black-hole-sources/`.
The builder reads the current full core and canonical leaf tiles to match whole
host identities, including NGC suffixes; it changes neither those tiles nor
filament geometry. Scientific selection/coverage and the research shortlist:
[atlas-expansion.md](../docs/atlas-expansion.md). Regression:
`node verify-atlas-expansion.mjs`.
The full catalogue builder also runs the compact-object builder after its final host tiles; the supplemental revision updates its index.html cache key.


Drawn galaxy hosts with `coordinateHost` receive their own core identity before
source matching. `build-full-catalog.py` exports `identityRedirects` from cosmic
merge results for source IDs matched to these galaxy hosts. Milky Way's UNGC
source row is retained as a `catalogMeasurements` estimate of our own galaxy,
not a second galaxy. Runtime preserves old parked/active navigation estimates
privately during save migration; see `docs/catalog.md` and
`node verify-galaxy-identities.mjs`.


`python3 data-tools/build-stellar-catalog.py` rebuilds the additive stellar
identity/multiplicity layer entirely offline from `stellar-sources/`, rejecting
an incompatible scientific base revision. It runs before map metadata in the
full builder. After a standalone rebuild, regenerate `build-map-radial.py`
when positions or enrichment code change, then `build-map-visibility.mjs`
and `build-map-labels.mjs`, and refresh touched asset cache keys. Coverage,
source limitations and saved-navigation policy: [nearby-stellar-systems.md](../docs/nearby-stellar-systems.md).
Regression: `node verify-stellar-catalog.mjs`.

## Поисковая схема земного неба и фотографии

Проверенные общие цели туманностей: `deep-sky-identities.json` сохраняет
компоненты M16 как одну игровую цель, не смешивая отдельные участки Вуали.
`python3 data-tools/build-deep-sky-identities.py` встраивает политику в текущий
импорт без пересборки научных тайлов; куратор встраивает её при новом импорте.
После изменения выполнить `build-sky-photos.py`, `build-map-filter-index.mjs`
и `node verify-nebula-identities.mjs`, обновить SHA затронутых скриптов.
Причина, источники, сохранения и ограничения проверки:
[nebula-identities.md](../docs/nebula-identities.md).

`python3 data-tools/build-sky-guide.py` собирает отдельный UI-набор
`dist/sky-guide-data.js` из замороженных `sky-sources/`: XHIP до V=6,
линии/названия созвездий d3-celestial, границы Roman B1875 и проверенные
наблюдения обсерваторий с полными кредитами. Сеть и пересборка научного
каталога не требуются. Из полных областей Roman дополнительно выводятся
экстремумы склонения J2000 всех 88 созвездий для широт наблюдения;
учитываются внутренние экстремумы дуг, оба участка Змеи и небесные полюса.
Полные источники, условия наблюдения, ограничения,
сверка 935 созвездий с Astropy и описание горизонтальной галереи —
[docs/sky-guide.md](../docs/sky-guide.md). Регрессия: `node verify-sky-guide.mjs`.


## Предварительная подготовка DSS

`node data-tools/build-sky-dss.mjs` готовит фотографические направления всех
звёздных исходников без пересборки научных тайлов, p3 и орбит. HYG читается из
`raw/hyg_v41.csv`, где сохранились исходные PM. Зарегистрированные звёзды и
быстрые HYG проходят пакетные SIMBAD/FITS-проверки с четырьмя рабочими запросами;
результаты/заголовки сохраняются в `sky-sources/dss-prepared-measurements.json`.
Сборка возобновляется, ошибки сети повторяются. `--offline` воспроизводит сборку
из замороженных данных; `--calibrate-all` дополнительно проверяет фактические
пластинки всех звёзд с известным движением (длительный пакетный запуск).

Выход: `dist/sky-dss-data.js`, 128 локальных файлов в `dist/sky-dss-data/<revision>/`
и `sky-dss-audit.json`. `calibrated` означает проверенные DATE-OBS и WCS,
`plate-epoch-estimate` — приблизительный центр по опубликованной эпохе ближайшей
пластинки из 1907 полей NASA SkyView; `catalogue-direction` — неизвестное движение.
Последние два статуса не получают ложную точную отметку/дату. Единицы:
направления — градусы J2000, эпохи — юлианские годы, PM — mas/yr, параллакс — mas,
RV — km/s, маркеры — пиксели GIF (начало сверху). Ошибки HYG неизвестны;
ошибки и библиографические ссылки SIMBAD сохраняются. Открытие карточки ничего
из этого не вычисляет и не запрашивает астрометрию по сети.

Регрессии: `node verify-sky-dss.mjs`, `node verify-sky-guide.mjs`.
Ограничения и источник списка пластинок — `docs/sky-guide.md`.

## Массовые фотографии обсерваторий

`python3 data-tools/fetch-astropix-media.py --cache /tmp/parus-astropix-metadata`
получает метаданные официального JSON API AstroPix. Для нового сетевого снимка
использовать новую папку кеша: частичный сбой не должен смешать страницы разных
версий архива. Изображения не скачиваются. Фильтруются тип Observation,
подпись, права, кредиты и идентичность; графики, иллюстрации и модели
исключаются. Чистые версии `unannotated` не отбрасываются как annotated.
Опубликованные обсерваториями DSS-поля сохраняются с явной подписью и идут
после остальных фотографий; автоматический вырез DSS остаётся последним.
`filterSummary` считает все отклонения по причинам, включая отсутствие прав,
кредитов и идентификаторов. Производные метаданные с происхождением замораживаются в
`sky-sources/media-astropix.json`; сырые страницы остаются во временном кеше.

`python3 data-tools/build-sky-photos.py` воспроизводит `dist/sky-photos-index.js`
и 15 JSON с метаданными по поставщикам без сети и без пересборки научных
каталогов. Имена изображений в URL AstroPix приводятся к нижнему регистру,
включая исходные AVM ID WISE/NRAO. Звёздные компоненты B/C не отождествляются
с планетами b/c. Полные/краткие названия созвездий и звёздные обозначения
нормализуются общими правилами Python/JS (генитивы d3-celestial). Сопоставляются
только собственные типизированные `*`/`V*` имена, с сохранением компонентов;
MU Cephei не смешивается с mu Cephei. Для ошибочно помеченного планетой
DSS-поля основное название и начало подписи могут прямо подтвердить звезду;
доказательство отдельно сохраняется, исходный AVM не переписывается.
Прямые изображения планет не переназначаются их звёздам.
`photo_target_roles.py` разделяет основные цели и остальные AVM-теги общего
кадра. Собственные алиасы читаются из установленного каталога; заголовок и
начало исходной подписи подтверждают основную цель или совместный портрет.
Неоднозначные привязки без такого подтверждения не включаются в индекс;
исходная выгрузка сохраняется полностью. Результат и текстовые доказательства —
`sky-sources/photo-target-audit.json`. Подпись берётся из исходного заголовка,
а не первого элемента AVM Subject.Name. Индекс сохраняет ревизию каталога;
его SHA-ключ в index.html обновляется сборщиком автоматически.
`SkyPhotos.ownNames` исключает поисковые псевдонимы хозяина
у всех классов членов галактик. У скоплений галактик дополнительно требуется
соответствующая категория AVM. Схемы и снимки не меняют физику/сохранения.

Проверка фактического охвата установленного каталога:
`node data-tools/audit-sky-photos.mjs /tmp/sky-photo-coverage.json`.
Она отдельно считает материалы архива, сопоставленные снимки, записи и классы;
обрабатывает также потоковые тайлы с исходными алиасами и ведущими нулями.
Регрессия: `node verify-sky-photos.mjs` (включена в `verify.mjs`), включая
отобранные исходные поля реальных записей в `sky-sources/photo-import-checks.json`.
Отсутствие результата в AstroPix не означает отсутствия наблюдений в полном
архиве конкретного телескопа; рисунки и кривые блеска не считаются фотографиями.
После пересборки обновить SHA-ключи затронутых скриптов в `dist/index.html`.
Затем выполнить `node data-tools/build-map-filter-index.mjs`: подборка
«Красивые снимки» зависит от исходной галереи, AstroPix и SGA и проверяет их
ревизии. Она исключает карты/поля DSS, учитывает весь исходный каталог и хранит
полный набор фотографических ID. До2000 записей выборка загружается целиком;
большие наборы сохраняют полные классы не более300 объектов (в общем бюджете
до2000), остальные классы используют обычную плотность карты. Например, тысячи
галактик SGA не скрывают три чёрные дыры и56 звёзд с собственными снимками.
Полнота небольших классов проверяется по всему каталогу, независимо от камеры.
Предел других подборок остаётся300.

Массовый дополнительный источник — Siena Galaxy Atlas 2020 / DESI Legacy
Imaging Surveys: 12 000 опубликованных цветных JPEG отдельных галактик.
Воспроизводимая последовательность (временный кеш вне репозитория):

```sh
mkdir -p /tmp/parus-sga
/opt/homebrew/bin/node data-tools/export-photo-candidates.mjs /tmp/parus-sga/candidates.json
python3 data-tools/fetch-sga-photos.py --cache /tmp/parus-sga --candidates /tmp/parus-sga/candidates.json --limit 12000
python3 data-tools/build-sky-imaging.py
/opt/homebrew/bin/node data-tools/build-map-filter-index.mjs
```

Первый шаг только читает установленный каталог. Импорт делает шесть запросов
NOIRLab TAP `sga2020.ellipse`, требует чистую одиночную группу, собственный точный
PGC/NGC/IC и согласованные координаты. Кандидаты сортируются по измеренному D26;
проверяются внешние observational `image-grz.jpg` (HEAD, без скачивания пикселей).
Отказ или неполный набор не заменяет `sky-sources/media-sga.json`. Этот файл
содержит SHA ответов, условия/отклонения, происхождение, права, точные привязки
и проверки всех URL. Сырые CSV остаются вне Git. Для нового сетевого снимка
использовать новый кеш; уже проверенный незавершённый импорт можно возобновить.
Офлайн-сборщик создаёт компактный индекс и32 ленивые части метаданных, обновляет
SHA в HTML. Регрессия `verify-sky-imaging.mjs` проверяет весь набор, ошибки
идентичности, ленивую загрузку, лимит кеша, standalone и детерминизм сборки.

Трёхсимвольные имена (LMC, SMC, WLM, AP6) сохраняются наравне с длинными;
для буквенных кодов требуется подтверждение в исходном заголовке/начале подписи.
Пустая AVM-категория допускает расширенный объект только при явно названном
физическом классе в первой фразе. Общие планы с целью в начале заголовка
идут раньше участков внутри неё. Регрессия покрывает короткие коды, ошибочный
тег LMC у фотографии SMC и наследование хозяина у членов галактик.
`sky-sources/observing-evidence.json` отдельно сохраняет прямые свидетельства
NOIRLab о видимости БМО/ММО глазом: они разрешают карты без выдуманной V,
не меняя научные записи, и включаются офлайн-сборкой `build-sky-guide.py`.

### Эпохи, сверхструктуры и подборка сфотографированных квазаров

`sky-sources/media-cosmic.json` добавляет к галереям 40 материалов (39 внешних
URL), явно различая снимки, карты, реконструкции и иллюстрации; кадры привязаны
к собственным ID. Полное покрытие: семь эпох, 17 именованных мегаструктур/войдов
и 16 квазаров с прежним 3C273. До прозрачности и за горизонтом используются
поясняющие схемы; прямых фотографий этих стадий не заявляется.

`sky-sources/quasars.json` — замороженные строки SIMBAD для 15 добавленных ядер:
ICRS J2000 в градусах, безразмерные z/ошибки, флаги качества, первичные bibcode
и SHA исходных ответов. `build-quasar-catalog.py` воспроизводит только отмеченный
добавочный блок в `dist/cosmic-catalog.js`. Неизвестные ошибки остаются null,
массы/светимости/размеры не назначаются. Сопутствующие расстояния вычисляет общая
космология атласа, а не округлённые расстояния из подписей снимков.

Сборка: `build-quasar-catalog.py` → `build-sky-guide.py` →
`build-map-visibility.mjs` → `build-map-labels.mjs` → `build-map-filter-index.mjs`.
Оба картографических индекса учитывают `cosmic-catalog.js` в своём хеше входов.
Основные каталоги и их неизменяемые тайлы не пересоздаются.
Регрессия `verify-cosmic-media.mjs` проверяет происхождение координат/z/ошибок,
независимое интегрирование расстояний, точные привязки, проекции, восстановление,
галереи всех эпох/структур, фотофильтр и детерминированную офлайн-сборку.

## ESA/Webb: отдельный архив наблюдений · 8 ноября 2026

`python3 data-tools/fetch-webb-media.py --cache /tmp/parus-webb-metadata-NEW`
обходит официальный архив ESA/Webb. Для нового сетевого снимка нужна новая
папка кеша; частичная загрузка не заменяет замороженный результат. Загружаются
HTML и HTTP HEAD, пиксели остаются на `cdn.esawebb.org`. В снимке703 записи,
242 принятых наблюдения,461 явно отклонённая запись; результаты каждой
страницы, SHA, причины отклонений и проверки URL сохранены в
`sky-sources/media-webb.json`. Все242 ссылки проверены HTTP200/image.

Источник иногда вообще не заполняет поле Name. Это отличается от потери при
импорте: `originalNames` сохраняется пустым, а `nameEvidence` указывает явное
название из заголовка или начала подписи. Каталожные коды/имена не выводятся
из близости координат. Общая проверка основной цели применяется и к AstroPix,
и к ESA/Webb. Hubble-кадры сравнений, спектры, схемы, коллажи и прямые изображения
экзопланет не переназначаются звёздам-хозяевам. Исходные подписи/имена/фильтры
сохраняются в снимке; научный каталог не пересобирается.

Офлайн: `python3 data-tools/build-sky-photos.py`, затем
`node data-tools/build-map-filter-index.mjs`. Отдельный ленивый файл
`dist/sky-photos-esawebb.json` входит и в однофайловый экспорт. Рантайм допускает
только официальный ESA CDN и официальный источник; исходный регистр пути
сохраняется. Две доступные поисковые карты остаются первыми, затем идут кадры
Webb, другие обсерватории, SGA и DSS. Источники и полный кредит видимы у кадра.

У60 записей PHAT/AP альтернативные имена вида M042 оказались внутренними
обозначениями скоплений M31, а не номерами Мессье. Эти имена остаются в поиске
и исходных данных, но исключаются из сопоставления фотографий всего класса
PHAT. Пять настоящих Hubble-портретов с точными AP-идентичностями сохранены.
Регрессия `verify-sky-photos.mjs` проверяет все2753 PHAT-скопления, реальные
выдержки ESA/Webb в `webb-import-checks.json`, новые идентичности, порядок
карт/снимков, ленивую загрузку и экспорт без сети.

В `sky-sources/media.json` также есть наблюдательный ролик ESO eso1825e для
Стрельца A*: `format: video`, HTTPS MP4, HTTPS `poster`, независимый `mediaType`,
авторство, условия использования и точная цитата страницы ESO. Общая офлайн-сборка
`python3 data-tools/build-sky-guide.py` проверяет формат и сохраняет метаданные
в sky-guide-data.js. После изменения галереи выполнить
`node data-tools/build-map-filter-index.mjs`: индекс фильтра зависит от версии
SKY_GUIDE_DATA даже при неизменном наборе объектов. Научные каталоги не
пересобираются. Ролик и постер загружаются напрямую с CDN ESO.
