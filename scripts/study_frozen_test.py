import unittest
from decimal import Decimal
from study_frozen import CORE, OUTPUT, read_json
from study_frozen_check import calendar_total, distinct


class FrozenTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = read_json(OUTPUT)
        cls.assets = cls.snapshot["assets"]

    def ids(self, keys):
        return {asset for asset, obs in self.assets.items()
                if all(obs[s][k]["value"] is not None for s in ("baseline", "latest") for k in keys)}

    def test_original_sample_restrictions(self):
        self.assertEqual(len(self.assets), 142)
        self.assertEqual(len(self.ids(CORE)), 75)
        self.assertEqual(len(self.ids((*CORE, "blocks"))), 17)
        self.assertEqual(self.ids((*CORE, "exchangeShare", "exchangeValue")), {"btc", "eth"})
        self.assertFalse(self.ids(("ledgerBytes",)))

    def test_bitcoin_lower_bound_and_custody(self):
        btc = self.assets["btc"]
        for side, f, active, floor, exchange, exchange_value in (
            ("baseline", 28216555, 21017962, 25.5, 16.3, 21236032614.5765),
            ("latest", 55225893, 19776101, 64.2, 13.4, 234085739233.2251),
        ):
            point = btc[side]
            operands = point["inactiveFloor"]["inputs"]
            self.assertEqual((operands["AdrBalCnt"], operands["AdrActCntSum30d"]), (f, active))
            self.assertAlmostEqual(point["inactiveFloor"]["value"], 100 * max(0, f - active) / f)
            self.assertEqual(round(point["inactiveFloor"]["value"], 1), floor)
            self.assertEqual(round(point["exchangeShare"]["value"], 1), exchange)
            self.assertAlmostEqual(point["exchangeValue"]["value"], exchange_value, places=3)
            self.assertEqual(point["exchangeValue"]["inputs"]["priceUtc"], point["exchangeValue"]["observedUtc"])

    def test_gaps_and_host(self):
        self.assertEqual(self.assets["hedg"]["latest"]["transactions"]["inputs"]["firstMissingUtc"], "2022-07-29")
        self.assertEqual(self.assets["lpt"]["baseline"]["transactions"]["inputs"]["missingDays"], 6)
        self.assertEqual(self.assets["lpt"]["latest"]["transactions"]["status"], "incomplete")
        self.assertEqual(self.assets["usdc"]["scope"], "aggregate")
        self.assertEqual(self.assets["usdc_eth"]["host"], "eth")
        self.assertEqual(self.assets["usdc_eth"]["latest"]["blocks"]["status"], "not_applicable")

    def test_zero_and_division(self):
        self.assertEqual(self.assets["hedg"]["baseline"]["inactiveFloor"]["status"], "zero_observed")
        self.assertEqual(self.assets["tusd"]["baseline"]["fundedAddresses"]["status"], "zero_observed")
        self.assertEqual(self.assets["tusd"]["baseline"]["inactiveFloor"]["status"], "undefined")

    def test_one_missing_day_prevents_sum(self):
        rows = {"2019-12-29": {"TxCnt": "7"}, "2019-12-31": {"TxCnt": "2"}}
        self.assertIsNone(calendar_total(rows, "TxCnt", "2019-12-29", "2019-12-31"))
        rows["2019-12-30"] = {"TxCnt": "0"}
        self.assertEqual(calendar_total(rows, "TxCnt", "2019-12-29", "2019-12-31"), Decimal(9))

    def test_duplicate_daily_record_fails(self):
        day = {"asset": "btc", "time": "2019-12-31", "TxCnt": "0"}
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            distinct([day, day])


if __name__ == "__main__":
    unittest.main()
