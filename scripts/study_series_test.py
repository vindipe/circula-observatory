import unittest
from datetime import date
from decimal import Decimal
from study_series import dense_columns, month_ends, record_gap, verify_pair


class StudySeriesTests(unittest.TestCase):
    def test_calendar(self):
        self.assertEqual(list(month_ends(date(2024, 1, 17), date(2024, 3, 30))),
                         [date(2024, 1, 31), date(2024, 2, 29)])

    def test_gaps_do_not_turn_into_zeros(self):
        columns = dense_columns({"supply": {2: Decimal(0), 4: Decimal("6.2")}}, 2)
        self.assertEqual(columns, {"supply": [0, None, 6.2]})
        gaps = []
        for i, status in enumerate(["not_public", "incomplete", "incomplete", "undefined"]):
            record_gap(gaps,i,{"status": status})
        self.assertEqual(gaps, [[0,0,"not_public"],[1,2,"incomplete"],[3,3,"undefined"]])

    def test_paired_equality(self):
        days = [date(2024, 1, 31), date(2024, 2, 29)]
        packed = {"offset":1,"columns":{"supply":[0]}}
        pair = {"baselineUtc":"2024-01-31","cutoffUtc":"2024-02-29",
                "assets":{"btc":{"baseline":{"supply":{"value":None}},"latest":{"supply":{"value":0}}}}}
        verify_pair(packed, days, "btc", pair)
        pair["assets"]["btc"]["latest"]["supply"]["value"] = None
        with self.assertRaises(ValueError):
            verify_pair(packed, days, "btc", pair)
