"""Regression tests for holes, measured zeros, stocks and safe publication."""

import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from community import aggregate, save_snapshot


class SnapshotTests(unittest.TestCase):
    day = dt.date(2024, 2, 29)

    def rows(self):
        return [
            {"asset": "btc", "time": f"2024-02-{i:02}T00:00:00Z", "TxCnt": "0", "SplyCur": str(i)}
            for i in range(1, 30)
        ]

    def test_leap_month_flows_keep_zero_and_require_every_day(self):
        rows = self.rows()
        self.assertEqual(aggregate(rows, "btc", "TxCnt", self.day), [("2024-02", 0)])
        self.assertFalse(aggregate(rows[1:], "btc", "TxCnt", self.day))
        rows[14]["TxCnt"] = None
        self.assertFalse(aggregate(rows, "btc", "TxCnt", self.day))

    def test_stock_requires_last_observation(self):
        rows = self.rows()
        self.assertEqual(aggregate(rows[-1:], "btc", "SplyCur", self.day), [("2024-02", 29)])
        self.assertFalse(aggregate(rows[:-1], "btc", "SplyCur", self.day))

    def test_duplicate_date_rejected(self):
        rows = self.rows()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            aggregate(rows + rows[-1:], "btc", "TxCnt", self.day)

    def test_published_snapshot_survives_stale_or_incomplete_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            original = {
                "cutoff": "2024-02-29",
                "series": [{"asset": "btc", "metric": "TxCnt", "points": [["2024-02", 0]]}],
            }
            save_snapshot(path, original)
            before = path.read_bytes()
            for candidate in ({**original, "cutoff": "2024-01-31"}, {**original, "series": []}):
                with self.assertRaises(ValueError):
                    save_snapshot(path, candidate)
                self.assertEqual(path.read_bytes(), before)
            save_snapshot(path, original)
            self.assertEqual(json.loads(path.read_bytes()), original)


if __name__ == "__main__":
    unittest.main()
