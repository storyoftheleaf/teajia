"""Exercise the private packet builder with synthetic three-view intake data."""
import hashlib
import json
from pathlib import Path
import runpy
import tempfile
import unittest

build = runpy.run_path(str(Path(__file__).with_name("build-yixing-photo-batch.py")))["build"]


class PhotoBatchTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.board = self.root / "board.json"
        self.manifest = self.root / "manifest.json"
        self.sources = self.root / "sources.json"
        self.holds = self.root / "holds.json"
        self.holds.write_text(json.dumps({"version": 1, "holds": []}))
        (self.root / "pots-01").mkdir()
        images = self.root / "work/images"
        images.mkdir(parents=True)
        photos, chosen, sources = [], [], []
        for i in range(3):
            data = b"\xff\xd8" + bytes([i]) + b"\xff\xd9"
            filename = f"pots-01/{i+1:02}.jpg"
            (self.root / filename).write_bytes(data)
            src = f"source-{i}"
            (images / (src + ".jpg")).write_bytes(data)
            sources.append({"uuid": src, "preview": "work/images/" + src + ".jpg"})
            photos.append({"role": "Before", "sha256": "a"*64, "originalSha256": "b"*64})
            chosen.append({"order": i+1, "filename": filename, "sha256": hashlib.sha256(data).hexdigest(),
                           "sourceId": src, "role": f"View {i+1}"})
        self.board.write_text(json.dumps({"pots": [{"id": "pots-01", "photos": photos}]}))
        self.sources.write_text(json.dumps(sources))
        self.manifest.write_text(json.dumps({"groups": {"pots-01": {"kind": "pots", "photos": chosen}}}))

    def packet(self, folder):
        path = self.root / folder
        build(self.board, self.manifest, self.sources, self.root, self.holds, path)
        return json.loads((path / "v1/photo-batches/proposal.json").read_text())

    def test_identity_binds_holds_and_baseline(self):
        routine = self.packet("routine")
        self.assertEqual(routine, self.packet("repeat"))
        self.assertFalse(any(c.get("needsReview") for c in routine["changes"]))
        self.assertEqual(routine["intakeSha256"], hashlib.sha256(self.manifest.read_bytes()).hexdigest())
        self.holds.write_text(json.dumps({"version": 1, "holds": [{"potId":"pots-01", "sourceId":"source-2"}]}))
        held = self.packet("held")
        self.assertEqual([2], [c["slot"] for c in held["changes"] if c.get("needsReview")])
        self.assertNotEqual(routine["id"], held["id"])
        board = json.loads(self.board.read_text())
        board["pots"][0]["photos"][0]["role"] = "Front"
        self.board.write_text(json.dumps(board))
        self.assertNotEqual(held["id"], self.packet("changed-baseline")["id"])

    def test_unmatched_hold_aborts(self):
        self.holds.write_text(json.dumps({"version": 1, "holds": [{"potId":"pots-02", "sourceId":"source-2"}]}))
        with self.assertRaisesRegex(ValueError, "held photo does not match"):
            self.packet("unmatched")
        self.assertFalse((self.root / "unmatched").exists())


if __name__ == "__main__":
    unittest.main()
