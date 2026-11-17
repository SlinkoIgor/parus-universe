"""Depth of published open-cluster members from parallax and cluster distance.

A member keeps its observed direction. Its depth combines the individual
Hipparcos parallax with a prior centred on the drawn cluster: the adopted
centre distance, its uncertainty and a conventional width equal to the
published half-number radius r50. r50 is not a measured line-of-sight depth.
"""
import gzip
import json
import math

PC = 3.2615637771674336
MIN_PROBABILITY = 0.5
MAX_TENSION = 3.0
METHOD = 'cluster-membership'
ASTROMETRY = 'Hunt-Reffert membership + Hipparcos'
ENVELOPE = '1σ оценки по членству. Ширина r50 условна, это не измеренная глубина.'


def parallax(d_ly):
    return 1000 * PC / d_ly


def hunt_clusters(root):
    data = json.loads(gzip.decompress((root / 'data-tools/cosmic-catalogs.json.gz').read_bytes()))
    return {o['catalogData']['ID']: o for o in data['objects'] if o['catalogKey'] == 'Gaia-Clusters'}


def hip_index(rows, core):
    index = {o['hip']: o['id'] for o in core if o.get('hip')}
    for r in rows:
        if r[2] == 'star' and r[10] == 'HYG' and r[11].get('hip'):
            index.setdefault(r[11]['hip'], r[0])
    return index


def target_center(ident, core_byid, record_byid, patches, policies):
    if ident in record_byid:
        r = record_byid[ident]
        if r[11].get('atlasOnly') or not r[3] or r[4] is None:
            return None
        return {'id': ident, 'name': r[1], 'd': r[3]}
    o = core_byid.get(ident)
    if not o:
        return None
    patch = patches.get(ident, {})
    d = patch.get('d', o.get('d'))
    if not d or policies.get(ident, {}).get('atlasOnly') or not (o.get('p3') or patch.get('d')):
        return None
    return {'id': ident, 'name': o['name'], 'd': d}


def apply(root, rows, core, patches, policies, system_members, matches, projection):
    members = json.loads((root / 'data-tools/cluster-members.json').read_text())
    columns = members['columns']
    clusters = hunt_clusters(root)
    core_byid = {o['id']: o for o in core}
    record_byid = {r[0]: r for r in rows}
    redirect = {source: target for source, target, _ in matches}
    hip_ident = hip_index(rows, core)
    audit = []
    for values in members['rows']:
        m = dict(zip(columns, values))
        ident = hip_ident.get(m['hip'])
        entry = {'hip': m['hip'], 'gaia': m['gaia'], 'star': ident, 'huntId': m['clusterId'], 'huntName': m['clusterName'], 'probability': m['probability']}
        audit.append(entry)
        source = clusters.get(m['clusterId'])
        if ident is None:
            entry['action'] = 'no-hyg-row'
            continue
        if m['probability'] < MIN_PROBABILITY:
            entry['action'] = 'low-probability'
            continue
        if source is None:
            entry['action'] = 'cluster-not-imported'
            continue
        target_id = redirect.get(source['id'], source['id'])
        target = target_center(target_id, core_byid, record_byid, patches, policies)
        entry['cluster'] = target_id
        if target is None:
            entry['action'] = 'cluster-without-map-position'
            continue
        if ident in core_byid:
            entry['action'] = 'curated-core-position-kept'
            continue
        if ident in system_members:
            entry['action'] = 'stellar-system-component-kept'
            continue
        row = record_byid[ident]
        extra = row[11]
        if extra.get('boundSystemPrimary') or extra.get('galaxyMember') or extra.get('positionEstimate'):
            entry['action'] = 'existing-membership-estimate-kept'
            continue
        data = source['catalogData']
        r50 = data.get('halfNumberRadiusPc')
        if not r50:
            entry['action'] = 'cluster-size-unknown'
            continue
        depth = r50 * PC
        hunt_d = data['dist50Pc'] * PC
        hunt_error = (data['dist84Pc'] - data['dist16Pc']) / 2 * PC
        center_error = max(hunt_error, abs(target['d'] - hunt_d))
        prior_sigma_ly = math.hypot(depth, center_error)
        prior = parallax(target['d'])
        prior_sigma = prior * prior_sigma_ly / target['d']
        own = extra.get('parallaxMas') if extra.get('uncertaintyMatched') else None
        own_sigma = extra.get('parallaxErrorMas') if own is not None else None
        entry.update(priorParallaxMas=prior, priorParallaxErrorMas=prior_sigma, starParallaxMas=own, starParallaxErrorMas=own_sigma, catalogDistanceLy=row[3])
        if own is not None and own_sigma:
            tension = abs(own - prior) / math.hypot(own_sigma, prior_sigma)
            entry['tension'] = tension
            if tension > MAX_TENSION:
                entry['action'] = 'parallax-conflict-kept'
                continue
            weight = own_sigma ** -2 + prior_sigma ** -2
            plx = (own / own_sigma ** 2 + prior / prior_sigma ** 2) / weight
            plx_sigma = weight ** -0.5
            basis = 'параллакс Hipparcos %.2f ± %.2f мсек объединён с расстоянием центра' % (own, own_sigma)
        else:
            plx, plx_sigma = prior, prior_sigma
            basis = 'параллакс без согласованной погрешности не использован; принято расстояние центра'
        d = parallax(plx)
        sigma = d * plx_sigma / plx
        note = 'Оценка по членству в скоплении %s: %s %.0f св. лет, ширина r50 = %.1f св. лет.' % (target['name'], basis, target['d'], depth)
        estimate = {
            'method': METHOD,
            'anchor': target_id,
            'anchorName': target['name'],
            'localEnvelopeLy': round(sigma, 3),
            'referenceScaleLy': round(2 * depth, 3),
            'sharedDistanceErrorLy': round(center_error, 3),
            'envelopeMeaning': ENVELOPE,
        }
        membership = {'huntId': m['clusterId'], 'probability': m['probability'], 'gaiaDR3': m['gaia'], 'catalogDistanceLy': round(row[3], 3) if row[3] else None}
        entry.update(gaiaParallaxMas=m['gaiaParallaxMas'], gaiaParallaxErrorMas=m['gaiaParallaxErrorMas'], catalogQuality=row[6], catalogMethod=row[7], catalogAtlasOnly=bool(extra.get('atlasOnly')))
        extra.update(positionEstimate=estimate, clusterMembership=membership, membershipNote='Hunt–Reffert 2024, Gaia DR3 %s, вероятность %.2f.' % (m['gaia'], m['probability']),
                     distanceRelativeError=round(sigma / d, 5), astrometrySource=ASTROMETRY, atlasOnly=False)
        extra.pop('positionReason', None)
        row[3] = d
        row[6] = 'approximate'
        row[7] = note
        row[12], row[13] = projection(row[4], row[5], d, 'star', ident)
        entry.update(action='membership-distance', distanceLy=d, distanceErrorLy=sigma)
    return {
        'policy': 'Published membership (Prob>=%.1f, the authors\' reliable-member cut) via the official Gaia DR3-Hipparcos-2 best neighbour. Parallax-space combination of the Hipparcos parallax with a prior centred on the drawn cluster; width sqrt(r50^2 + centre uncertainty^2). Members in >%.0f sigma tension, curated core stars, stellar-system components and existing host estimates keep their positions.' % (MIN_PROBABILITY, MAX_TENSION),
        'limitations': 'r50 contains only half of the members and is used as a conventional prior width, not a measured depth. Very bright stars without usable Gaia membership and stars outside Hipparcos are not covered.',
        'rows': audit,
    }
