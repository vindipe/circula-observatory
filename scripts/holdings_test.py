"""Offline regression checks for the closed-month publication and its promotion."""
import json
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import holdings


class PublishedHoldings(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads(holdings.DEFAULT_OUTPUT.read_text(), parse_float=Decimal)
        self.series = {row["metric"]: row for row in self.snapshot["series"]}

    def test_monthly_values_and_daily_audit(self):
        for check in self.snapshot["verification"]:
            suffix = f'{check["thresholdDays"]}d'
            for key, kind, unit, value in [
                ("inactive", "stock", "BTC", check["stockBTC"]),
                ("revived", "flow", "BTC", check["flowBTC"]),
                ("inactive_pct", "ratio", "%", (100 * check["stockBTC"] / check["unspentSupplyBTC"]).quantize(holdings.SAT))
            ]:
                row = self.series[f"{key}_{suffix}"]
                self.assertEqual((row["kind"], row["unit"]), (kind, unit))
                self.assertEqual(row["points"][-1], [check["month"], value])
                self.assertEqual(len(row["points"]), len({point[0] for point in row["points"]}))
                self.assertEqual(row["points"][0], ["2009-01", 0])

    def test_gross_input_flow_matches_independent_block_sum(self):
        series = self.series["gross_input_volume_btc"]
        audit = self.snapshot["grossInputVolumeCheck"]
        self.assertEqual((series["dashboard"],series["kind"],series["unit"]), ("circulation","flow","BTC"))
        self.assertEqual(audit["endHeightInclusive"] - audit["startHeight"] + 1, audit["blocksSummed"])
        self.assertEqual(Decimal(audit["rawBlockSumBTC"]).quantize(Decimal(audit["unitPrecisionBTC"])),
                         dict(series["points"])[audit["month"]])
        for month,value in self.series["revived_90d"]["points"]:
            self.assertGreaterEqual(dict(series["points"])[month]+Decimal("0.0001"), value)

    def test_missing_observation_stops_extraction(self):
        response = [{"index": "month1", "type": "Bitcoin", "start": 0, "end": 1, "data": [None]}]
        with patch.object(holdings, "read", return_value=response), self.assertRaises(ValueError):
            holdings.load("month1", 0, 1, ["circulating_supply"])

    def test_last_valid_snapshot_survives_interruption_or_shorter_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "holdings.json"
            previous = holdings.DEFAULT_OUTPUT.read_bytes()
            out.write_bytes(previous)
            with patch.object(holdings, "build", side_effect=TimeoutError), self.assertRaises(TimeoutError):
                holdings.publish(out)
            self.assertEqual(out.read_bytes(), previous)
            short = {"series": [{"points": [["2009-01", 0]]}]}
            with patch.object(holdings, "build", return_value=short), self.assertRaises(ValueError):
                holdings.publish(out)
            self.assertEqual(out.read_bytes(), previous)


if __name__ == "__main__":
    unittest.main()
