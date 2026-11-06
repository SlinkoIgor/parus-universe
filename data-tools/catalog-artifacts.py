"""Package and install pinned browser catalogues; Python 3 standard library only."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import ssl
import tarfile
import tempfile
import urllib.request

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / 'data-tools/catalog-artifact.json'
LAYERS = ('catalog-data', 'map-radial', 'map-slices', 'map-visibility', 'map-layers')
DATA_DIRS = (*LAYERS, 'sky-dss-data', 'hierarchy-data')


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def safe_path(name):
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or str(p) != name:
        raise ValueError('Unsafe archive path: ' + name)
    if len(p.parts) < 3 or p.parts[0] != 'dist' or p.parts[1] not in DATA_DIRS:
        raise ValueError('Not a catalogue path: ' + name)
    return p


def build(data_dir, output, manifest_path):
    files, units, pointers = {}, [], []
    for layer in LAYERS:
        pointer = data_dir / layer / 'current.json'
        data_root = json.loads(pointer.read_text())['dataRoot']
        if not re.fullmatch(re.escape(layer) + r'/[a-f0-9]{12}', data_root):
            raise ValueError('Invalid data root: ' + data_root)
        units.append('dist/' + data_root)
        pointers.append('dist/' + layer + '/current.json')
        files[pointers[-1]] = pointer
    sky = (REPO / 'dist/sky-dss-data.js').read_text()
    sky_match = re.search(r'"dataRoot"\s*:\s*"(sky-dss-data/[a-f0-9]{12})"', sky)
    if sky_match is None:
        raise ValueError('Missing DSS data root')
    sky_root = sky_match.group(1)
    units.append('dist/' + sky_root)
    for unit in units:
        source = data_dir / unit.removeprefix('dist/')
        if not source.is_dir():
            raise ValueError('Missing catalogue: ' + str(source))
        for p in sorted(source.rglob('*')):
            if p.is_symlink():
                raise ValueError('Symlinked catalogue input: ' + str(p))
            if p.is_file() and not p.name.startswith('.') and not re.search(r' \d+\.[^.]+$', p.name):
                files['dist/' + p.relative_to(data_dir).as_posix()] = p
    units += ['dist/hierarchy-data/tree.json.gz', 'dist/catalog-data/NOTICES.md']
    files[units[-2]] = data_dir / 'hierarchy-data/tree.json.gz'
    files[units[-1]] = REPO / 'THIRD_PARTY_NOTICES.md'
    units += pointers  # Publish pointers after their complete immutable directories.
    entries = []
    for name, source in sorted(files.items()):
        safe_path(name)
        entries.append({'path': name, 'size': source.stat().st_size, 'sha256': digest(source)})
    identity = hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:16]
    filename = 'parus-catalogs-' + identity + '.tar.gz'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / filename
    partial = archive.with_suffix('.partial')
    print('Packing', len(entries), 'files…', flush=True)
    try:
        with partial.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0, compresslevel=6) as compressed:
            with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.PAX_FORMAT) as tar:
                for entry in entries:
                    source = files[entry['path']]
                    if source.stat().st_size != entry['size'] or digest(source) != entry['sha256']:
                        raise ValueError('Catalogue changed while packaging: ' + str(source))
                    info = tarfile.TarInfo(entry['path'])
                    info.size, info.mode, info.mtime = entry['size'], 0o644, 0
                    with source.open('rb') as f:
                        tar.addfile(info, f)
        archive_hash = digest(partial)
        identity = archive_hash[:16]
        filename = 'parus-catalogs-' + identity + '.tar.gz'
        archive = output / filename
        partial.replace(archive)
    finally:
        partial.unlink(missing_ok=True)
    manifest = {'version': 1, 'revision': identity, 'filename': filename,
                'url': 'https://github.com/SlinkoIgor/parus-universe/releases/download/catalog-data-' + identity + '/' + filename,
                'sha256': digest(archive), 'bytes': archive.stat().st_size,
                'unpackedBytes': sum(e['size'] for e in entries), 'units': units, 'files': entries}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(str(archive), '\nSHA-256:', manifest['sha256'], '\nCompressed bytes:', manifest['bytes'], flush=True)
    return manifest


def load_manifest(path):
    m = json.loads(path.read_text())
    if m['version'] != 1 or not re.fullmatch('[a-f0-9]{64}', m['sha256']):
        raise ValueError('Unsupported catalogue manifest')
    if Path(m['filename']).name != m['filename'] or len(m['units']) != len(set(m['units'])):
        raise ValueError('Invalid archive filename or duplicate publication units')
    paths = [entry['path'] for entry in m['files']]
    if len(paths) != len(set(paths)):
        raise ValueError('Duplicate catalogue paths')
    units = [safe_path(unit) for unit in m['units']]
    for entry in m['files']:
        p = safe_path(entry['path'])
        if entry['size'] < 0 or not re.fullmatch('[a-f0-9]{64}', entry['sha256']):
            raise ValueError('Invalid file description')
        if not any(p == u or u in p.parents for u in units):
            raise ValueError('File outside published units: ' + str(p))
    for a in units:
        if any(a != b and a in b.parents for b in units):
            raise ValueError('Overlapping published units')
    return m


def check(m, target, full=True):
    for entry in m['files']:
        path = target / entry['path']
        if not path.is_file() or path.is_symlink() or path.stat().st_size != entry['size']:
            return False
        if full and digest(path) != entry['sha256']:
            return False
    return True


def remove(path):
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def install(m, target, archive=None, replace=os.replace, force=False):
    target = target.resolve()
    target.mkdir(parents=True, exist_ok=True)
    marker = target / 'dist/.catalog-artifact.json'
    try:
        installed_hash = json.loads(marker.read_text()).get('sha256')
    except (OSError, ValueError):
        installed_hash = None
    if not force and installed_hash == m['sha256'] and check(m, target, full=False):
        print('Catalogues already installed:', m['revision'])
        return
    with tempfile.TemporaryDirectory(prefix='.parus-catalogs-', dir=target) as temp:
        temp = Path(temp)
        if archive is None:
            if not m['url'].startswith('https://'):
                raise ValueError('Catalogue downloads require HTTPS')
            archive = temp / m['filename']
            context = ssl.create_default_context()
            if Path('/etc/ssl/cert.pem').is_file():
                context.load_verify_locations('/etc/ssl/cert.pem')
            print('Downloading', m['url'], flush=True)
            with urllib.request.urlopen(m['url'], context=context, timeout=60) as response, archive.open('wb') as f:
                shutil.copyfileobj(response, f)
        if archive.stat().st_size != m['bytes'] or digest(archive) != m['sha256']:
            raise ValueError('Archive size or SHA-256 differs; existing catalogues were not changed')
        expected = {e['path']: e for e in m['files']}
        seen = set()
        stage = temp / 'new'
        with tarfile.open(archive, mode='r|gz') as tar:
            for member in tar:
                safe_path(member.name)
                if not member.isfile() or member.name not in expected or member.name in seen:
                    raise ValueError('Unexpected archive member: ' + member.name)
                entry = expected[member.name]
                if member.size != entry['size']:
                    raise ValueError('Unexpected member size: ' + member.name)
                path = stage / member.name
                path.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as source, path.open('wb') as f:
                    shutil.copyfileobj(source, f)
                if digest(path) != entry['sha256']:
                    raise ValueError('Invalid catalogue checksum: ' + member.name)
                seen.add(member.name)
        if seen != set(expected):
            raise ValueError('Archive is missing catalogue files')
        # Refuse symlinked destination ancestors before replacing any live data.
        for unit in m['units']:
            path = target / unit
            parts = PurePosixPath(unit).parts
            if any(target.joinpath(*parts[:i]).is_symlink() for i in range(1, len(parts) + 1)):
                raise ValueError('Symlinked catalogue destination: ' + str(path))
        changes = []
        try:
            for unit in m['units']:
                dest, source, backup = target / unit, stage / unit, temp / 'backup' / unit
                dest.parent.mkdir(parents=True, exist_ok=True)
                record = [dest, None, False]
                changes.append(record)
                if dest.exists():
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    replace(dest, backup)
                    record[1] = backup
                replace(source, dest)
                record[2] = True
            marker.parent.mkdir(parents=True, exist_ok=True)
            pending = marker.with_suffix('.tmp')
            pending.write_text(json.dumps({'revision': m['revision'], 'sha256': m['sha256']}) + '\n')
            replace(pending, marker)
        except BaseException:
            for dest, backup, installed in reversed(changes):
                if installed:
                    remove(dest)
                if backup is not None:
                    os.replace(backup, dest)
            raise
    print('Installed catalogue revision:', m['revision'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'install', 'check'])
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    parser.add_argument('--target', type=Path, default=REPO)
    parser.add_argument('--data-dir', type=Path, default=REPO / 'dist')
    parser.add_argument('--output-dir', type=Path, default=Path(tempfile.gettempdir()) / 'parus-catalog-artifacts')
    parser.add_argument('--archive', type=Path, help='Use a previously downloaded archive, without network access')
    parser.add_argument('--force', action='store_true', help='Reinstall even when the version marker matches')
    args = parser.parse_args()
    try:
        if args.command == 'build':
            build(args.data_dir, args.output_dir, args.manifest)
        elif args.command == 'check':
            if not check(load_manifest(args.manifest), args.target):
                raise ValueError('Catalogue files are missing or differ; run install --force')
            print('All catalogue checksums match')
        else:
            install(load_manifest(args.manifest), args.target, args.archive, force=args.force)
    except (OSError, ValueError, tarfile.TarError, KeyError, EOFError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
