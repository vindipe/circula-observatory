"""Offline transaction tests. Synthetic observations stay in temporary directories."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

PATH = Path(__file__).with_name("refresh-atlas.py")
SPEC = importlib.util.spec_from_file_location("refresh", PATH)
refresh = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(refresh)


class PromotionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.atlas = self.root / "public" / "atlas"
        self.candidates = {}
        for source in refresh.SCRIPTS:
            data = {"unavailable": [], "series": [{
                "asset": "test", "metric": "test", "unit": "blocks", "scope": "test",
                "source": source, "license": "test", "kind": "flow", "points": [["2026-09", 0], ["2026-10", 1]]
            }]}
            if source == "distribution":
                data["distribution"] = {"bands": ["one"], "months": {"2026-09": {"counts": [1], "btc": [1]}}}
            if source == "stellar":
                data.update(samples=[{"date": "2026-09-10", "ledger": 1}],
                            events=[{"date": "2026-09-10", "ledger": 1, "kind": "extension", "key": "k"}], stride=65536)
            path = self.root / (source + ".json")
            path.write_text(json.dumps(data))
            self.candidates[source] = path

    def promote(self):
        return refresh.promote(self.atlas, self.candidates, "2026-10")

    def test_atomic_manifest_and_identical_retry(self):
        first = self.promote()
        self.assertEqual(first, self.promote())
        self.assertEqual(len(list((self.atlas / "releases").iterdir())), 1)
        paths = refresh.current_files(self.atlas, "2026-10")
        for s, path in paths.items():
            self.assertEqual(path.read_bytes(), self.candidates[s].read_bytes())

    def test_invalid_or_truncated_metrics_keep_last_pointer(self):
        self.promote()
        path = self.candidates["history"]
        initial = path.read_text()
        pointer = (self.atlas / "current.json").read_bytes()
        for points in ([["2026-10", 1]], [["2026-09", None], ["2026-10", 1]],
                       [["2026-09", 0], ["2026-09", 1]], [["2026-11", 0]]):
            candidate = json.loads(initial)
            candidate["series"][0]["points"] = points
            path.write_text(json.dumps(candidate))
            with self.assertRaises(ValueError):
                self.promote()
            self.assertEqual(pointer, (self.atlas / "current.json").read_bytes())

    def test_stellar_event_and_distribution_months_preserved(self):
        self.promote()
        for name, field in (("stellar", "events"), ("distribution", "distribution")):
            file = self.candidates[name]
            original = file.read_text()
            candidate = json.loads(original)
            if name == "stellar":
                candidate[field] = []
            else:
                candidate[field]["months"] = {}
            file.write_text(json.dumps(candidate))
            with self.assertRaises(ValueError):
                self.promote()
            file.write_text(original)

    def test_commit_failure_and_restart(self):
        before = self.promote()
        path = self.candidates["history"]
        new = refresh.load(path)
        new["audit"] = {"revision": 2}
        path.write_text(json.dumps(new))
        with patch.object(refresh, "write_manifest", side_effect=OSError("write fault")):
            with self.assertRaises(OSError):
                self.promote()
        self.assertEqual(refresh.load(self.atlas / "current.json"), before)
        self.assertNotEqual(before["release"], self.promote()["release"])
        self.assertEqual(len(list((self.atlas / "releases").iterdir())), 2)

    def test_resume_completed_source_without_second_extraction(self):
        result = self.candidates["history"].read_bytes()
        def produce(command, **kwargs):
            Path(command[command.index("--output") + 1]).write_bytes(result)
        with patch.object(refresh.subprocess, "run", side_effect=produce) as mocked:
            for i in range(2):
                refresh.collect("history", self.root / "work", "2026-10-31", False, None)
            self.assertEqual(mocked.call_count, 1)


if __name__ == "__main__":
    unittest.main()
