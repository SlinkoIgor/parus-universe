import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('catalog_artifacts', Path(__file__).with_name('catalog-artifacts.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)


class CatalogueArtifacts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.original_repo = art.REPO
        art.REPO = self.root / 'source'
        self.addCleanup(setattr, art, 'REPO', self.original_repo)
        self.dist = art.REPO / 'dist'
        for layer in art.LAYERS:
            folder = self.dist / layer / '012345abcdef'
            folder.mkdir(parents=True)
            (folder / '0.json').write_text('[1,2,3]\n')
            (folder.parent / 'current.json').write_text(json.dumps({'dataRoot': layer + '/012345abcdef'}))
        sky = self.dist / 'sky-dss-data/012345abcdef'
        sky.mkdir(parents=True)
        (sky / '0.json').write_text('{"star":"test"}\n')
        (self.dist / 'sky-dss-data.js').write_text('const data={"dataRoot":"sky-dss-data/012345abcdef"};')
        hierarchy = self.dist / 'hierarchy-data'
        hierarchy.mkdir()
        (hierarchy / 'tree.json.gz').write_bytes(b'test tree')
        (art.REPO / 'THIRD_PARTY_NOTICES.md').write_text('Source attribution\n')
        self.manifest_path = self.root / 'artifact.json'
        self.m = art.build(self.dist, self.root / 'out', self.manifest_path)
        self.archive = self.root / 'out' / self.m['filename']
        self.target = self.root / 'installed'

    def test_roundtrip_idempotency_and_old_local_versions(self):
        old = self.target / 'dist/catalog-data/old-local/data.json'
        old.parent.mkdir(parents=True)
        old.write_text('keep old local data')
        art.install(art.load_manifest(self.manifest_path), self.target, self.archive)
        self.assertTrue(art.check(self.m, self.target))
        marker = self.target / 'dist/.catalog-artifact.json'
        before = marker.stat().st_mtime_ns
        art.install(self.m, self.target, self.archive)
        self.assertEqual(before, marker.stat().st_mtime_ns)
        self.assertEqual(old.read_text(), 'keep old local data')
        data = self.target / self.m['files'][0]['path']
        data.write_bytes(b'X' * data.stat().st_size)
        self.assertFalse(art.check(self.m, self.target))
        art.install(self.m, self.target, self.archive, force=True)
        self.assertTrue(art.check(self.m, self.target))

    def test_bad_archive_and_unsafe_manifest_leave_existing_data(self):
        sentinel = self.target / 'dist/catalog-data/012345abcdef/0.json'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_text('original')
        broken = self.root / 'broken.tar.gz'
        broken.write_bytes(self.archive.read_bytes()[:-1])
        with self.assertRaises(ValueError):
            art.install(self.m, self.target, broken)
        self.assertEqual(sentinel.read_text(), 'original')
        self.m['files'][0]['path'] = 'dist/catalog-data/../../escape'
        self.manifest_path.write_text(json.dumps(self.m))
        with self.assertRaises(ValueError):
            art.load_manifest(self.manifest_path)

    def test_failed_publication_rolls_back_directories_and_pointers(self):
        self.target.mkdir()
        originals = {}
        for unit in self.m['units']:
            file = self.target / unit
            if not (unit.endswith('/current.json') or unit.endswith('.gz') or unit.endswith('.md')):
                file = file / 'old.json'
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('old ' + unit)
            originals[file] = file.read_bytes()
        def fail_last_pointer(src, dst):
            if Path(dst).resolve() == (self.target / self.m['units'][-1]).resolve() and 'new' in Path(src).parts:
                raise OSError('simulated interrupted publication')
            os.replace(src, dst)

        with self.assertRaises(OSError):
            art.install(self.m, self.target, self.archive, replace=fail_last_pointer)
        for path, data in originals.items():
            self.assertEqual(path.read_bytes(), data)
        self.assertFalse((self.target / 'dist/.catalog-artifact.json').exists())

    def test_archive_reproducibility(self):
        again = art.build(self.dist, self.root / 'again', self.root / 'again.json')
        self.assertEqual(again, self.m)
        self.assertEqual(self.archive.read_bytes(), (self.root / 'again' / again['filename']).read_bytes())


if __name__ == '__main__':
    unittest.main()
