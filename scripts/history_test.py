"""Offline integrity tests for the public, verified history snapshot and its updater."""
import json
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from history import ROOT, complete_rows, publish


class HistoryTests(unittest.TestCase):
    def test_open_month_excluded_while_genesis_is_counted(self):
        rows = complete_rows([285, 500, 640], [1, 2, 3], date(2009, 3, 8))
        self.assertEqual(rows, [("2009-01", 285, 285, 1), ("2009-02", 500, 215, 1)])

    def test_source_lag_and_absence(self):
        # February has no evidence that the provider has completed its bucket.
        self.assertEqual(len(complete_rows([285, 500], [1, 2], date(2009, 4, 1))), 1)
        with self.assertRaises(ValueError):
            complete_rows([285, None, 720], [1, 2, 3], date(2009, 4, 1))

    def test_preceding_snapshot_survives_failed_promotion(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "history.json"
            valid = {"series": [{"points": [["2025-12", 20]]}]}
            publish(path, valid)
            publish(path, valid)
            with self.assertRaises(ValueError):
                publish(path, {"series": [{"points": [["2025-10", 10]]}]})
            self.assertEqual(json.loads(path.read_text()), valid)

    def test_shipped_data_conserve_integer_bytes(self):
        snapshot = json.loads((ROOT / "public/atlas/history.json").read_text())
        by_metric = {row["metric"]: dict(row["points"]) for row in snapshot["series"]}
        totals = by_metric["history_gb"]
        previous = 0
        for month, gb in totals.items():
            total = round(gb * 10**9)
            added = round(by_metric["added_gb"][month] * 10**9)
            count = by_metric["history_block_count"][month]
            mean = by_metric["mean_block_bytes"][month]
            self.assertEqual(total - previous, added)
            self.assertEqual(round(mean * count), added)
            previous = total
        self.assertEqual(snapshot["audit"]["independentBlockChecks"]["matches"], 1005)
        self.assertEqual(len(snapshot["audit"]["perHeightChecks"]), 3)


if __name__ == "__main__":
    unittest.main()
