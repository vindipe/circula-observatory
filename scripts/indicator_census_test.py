"""Regression checks for the UTC units and coverage in the indicator catalogue."""

import unittest
from datetime import date

from indicator_census import Daily, evaluate, valid_span
from indicator_recipes import INDICATORS


SPECS = {spec.id: spec for spec in INDICATORS}


class IndicatorCensusTest(unittest.TestCase):
    def test_cumulative_series_stops_at_first_missing_day(self):
        span = ["2020-01-29", "2020-02-02"]
        ordinals = [date(2020, 1, 31).toordinal(), date(2020, 2, 2).toordinal()]
        rows = {"TxCnt": Daily({"2020-01-29": 3, "2020-01-30": 0, "2020-02-01": 8, "2020-02-02": 5})}
        self.assertEqual(evaluate(SPECS["recorded-transactions"], rows, span, ordinals, ordinals[-1]),
                         [span, [0, []], ["2020-01-30", 3]])

    def test_rolling_window_requires_each_day_and_accepts_zero(self):
        values = Daily({"2026-10-29": 5, "2026-10-30": 0, "2026-11-01": 2})
        day = date(2026, 10, 31).toordinal()
        self.assertIsNone(values.at(day, 3))
        self.assertEqual(values.at(day, 2, 1), 5)

    def test_supply_growth_bounds_require_date_and_lagged_input(self):
        spec = SPECS["supply-growth-365"]
        span = valid_span({"SplyCur": ("2020-01-01", "2021-02-01")}, spec)
        self.assertEqual(span, ["2020-12-31", "2021-02-01"])
        end = date(2020, 12, 31).toordinal()
        zero = {"SplyCur": Daily({"2020-01-01": 0, "2020-12-31": 25})}
        self.assertEqual(evaluate(spec, zero, span, [end], end), [span, [0, []], None])
        observed = {"SplyCur": Daily({"2020-01-01": 100, "2020-12-31": 70})}
        self.assertEqual(evaluate(spec, observed, span, [end], end), [span, [0, [-30.0]], ["2020-12-31", -30.0]])

    def test_native_exchange_flow_may_be_negative(self):
        spec = SPECS["exchange-net"]
        date_text = "2026-10-31"
        end = date.fromisoformat(date_text).toordinal()
        data = {"FlowInExNtv": Daily({date_text: 2}), "FlowOutExNtv": Daily({date_text: 12})}
        span = [date_text, date_text]
        self.assertEqual(evaluate(spec, data, span, [end], end), [span, [0, [-10]], [date_text, -10]])

    def test_numeric_suffix_without_series_has_empty_overlap(self):
        spec = SPECS["exchange-share"]
        self.assertIsNone(valid_span({"SplyExNtv": ("2021-01-01", "2021-11-30"),
                                      "SplyCur": ("2021-12-01", "2026-11-23")}, spec))


if __name__ == "__main__":
    unittest.main()
