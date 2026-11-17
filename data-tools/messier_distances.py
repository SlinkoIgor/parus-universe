"""Fill missing Messier positions from frozen, attributed source measurements.

OpenNGC supplies directions/identities, not a complete distance catalogue.
An optical group has no common distance: its map/flight anchor is one named
observed star, with the other components retained at their own distances.
"""
import json
from urllib.parse import quote

PC = 3.2615637771674336


def unresolved_core_rows(core):
    rows = []
    for o in core:
        if o.get('d') is not None or not 1 <= int(o.get('messier') or 0) <= 110:
            continue
        extra = {k: o[k] for k in ('ngc', 'messier', 'angularMajorArcmin', 'angularMinorArcmin', 'positionAngleDeg') if k in o}
        extra['catalogType'] = o.get('catalogType') or o['type'].split('·')[-1].strip()
        extra['referenceURL'] = o['source']
        rows.append([o['id'], o['name'], o['kind'], None, o['raDeg'], o['decDeg'],
                     'unknown', o.get('distanceMethod', ''), o.get('aliases', []),
                     o.get('apparentV'), 'OpenNGC', extra, None, None])
    return rows


def enrich(records, root, projection):
    snapshot = json.loads((root / 'data-tools/messier-distances.json').read_text())
    globular = json.loads((root / 'data-tools/globular-cluster-models.json').read_text())
    nasa = {q['messier']: q for q in snapshot['nasa']}
    audit = []
    for row in records:
        extra = row[11]
        m = int(extra.get('messier') or 0)
        if not 1 <= m <= 110 or row[3] is not None:
            continue
        original = dict(distanceLy=row[3], raDeg=row[4], decDeg=row[5],
                        positionQuality=row[6], distanceMethod=row[7], source=row[10],
                        catalogType=extra.get('catalogType'),
                        angularMajorArcmin=extra.get('angularMajorArcmin'),
                        angularMinorArcmin=extra.get('angularMinorArcmin'))
        model = globular['clusters'].get(str(extra.get('ngc', '')).lower())
        error = None
        if extra.get('catalogType') == 'GCl' and model:
            distance = model['distanceKpc'] * 1000 * PC
            error = model['distanceErrorKpc'] * 1000 * PC
            source = globular['source']
            catalog = 'GlobularModels'
            note = ('Оценка дальности центра по компиляции Baumgardt & Vasiliev: '
                    f"{model['distanceKpc']} ± {model['distanceErrorKpc']} кпк. "
                    'Это дальность скопления, не индивидуальная глубина его звёзд.')
            extra.update(distanceReference=globular['paper'])
        elif m in (40, 73):
            components = [dict(q) for q in snapshot['components']['rows'] if q['messier'] == m]
            assert len(components) == (2 if m == 40 else 4)
            for q in components:
                assert 0 < q['parallaxErrorMas'] / q['parallaxMas'] < 0.05
                q['distanceLy'] = 1000 / q['parallaxMas'] * PC
                q['distanceErrorLy'] = q['distanceLy'] * q['parallaxErrorMas'] / q['parallaxMas']
            anchor_name = 'HD 238107' if m == 40 else 'BD-13  5809'
            anchor = next(q for q in components if q['name'] == anchor_name)
            distance, error = anchor['distanceLy'], anchor['distanceErrorLy']
            row[4:6] = [anchor['raDeg'], anchor['decDeg']]
            source = 'https://simbad.harvard.edu/simbad/sim-id?Ident=' + quote(anchor_name)
            catalog = 'SIMBAD'
            label = 'Оптическая пара' if m == 40 else 'Оптическая группа · астеризм'
            note = (f'M{m} — {"оптическая пара" if m == 40 else "астеризм из четырёх звёзд"}, '
                    'а не физически связанное скопление. Единой дальности нет. '
                    f'Значок карты и цель полёта привязаны к звезде {anchor_name.strip()}; '
                    'её дальность получена из параллакса Gaia EDR3. '
                    'Остальные компоненты находятся на собственных расстояниях. '
                    'Погрешность учитывает формальную ошибку параллакса, без систематики Gaia.')
            row[2] = 'star' if m == 40 else 'cluster'
            extra.update(coordinateAnchor=anchor_name, opticalGroup=True,
                         opticalComponents=components, catalogTypeLabel=label,
                         catalogIdentityLabel=label, catalogType='asterism',
                         angularMajorArcmin=None, angularMinorArcmin=None,
                         sizeUnknown=True, distanceReference=anchor['reference'])
        elif m in nasa:
            q = nasa[m]
            distance, source = q['distanceLy'], q['source']
            catalog = 'NASA'
            note = (f'NASA Hubble Messier Catalog: приблизительно {distance:g} св. лет. '
                    'Опубликованная округлённая оценка; формальная погрешность не приведена.')
            if m == 24:
                note += (' M24 — окно в пылевых облаках, через которое видны звёзды '
                         'примерно в 10 000–16 000 св. лет. Опорная дальность 10 000 св. лет '
                         'не является общей дальностью всех звёзд или центром скопления.')
                extra.update(catalogTypeLabel='Звёздное облако · окно в межзвёздной пыли',
                             catalogIdentityLabel='Звёздное облако',
                             distanceRangeLy=[10000, 16000], sizeUnknown=True,
                             angularMajorArcmin=None, angularMinorArcmin=None)
        else:
            raise ValueError(f'No sourced distance/anchor for M{m}')
        row[3], row[6], row[7] = distance, 'approximate', note
        extra.update(atlasOnly=False, distanceSource=source, distanceEnrichment='messier-v1',
                     distanceErrorLy=error, distanceErrorMinusLy=error, distanceErrorPlusLy=error,
                     distanceRelativeError=error / distance if error is not None else None,
                     catalogAstrometry=original)
        extra['catalogMeasurements'] = [*extra.get('catalogMeasurements', []),
            dict(catalog=catalog, source=source, distanceLy=distance, distanceErrorLy=error,
                 basis=note, coordinateAnchor=extra.get('coordinateAnchor'))]
        row[12:14] = projection(row[4], row[5], distance, row[2], row[0])
        audit.append(dict(id=row[0], messier=m, previous=original, distanceLy=distance,
                          distanceErrorLy=error, source=source,
                          coordinateAnchor=extra.get('coordinateAnchor')))
    return audit
