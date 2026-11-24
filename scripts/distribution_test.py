"""Validate the real output and regressions in grouped Gini and rank support."""
import json
import unittest
from tempfile import TemporaryDirectory
from pathlib import Path

from distribution import boundary_share, grouped_floor, publish

class DistributionTest(unittest.TestCase):
    def test_grouped_gini(self):
        self.assertEqual(grouped_floor([3], [6]), 0)
        self.assertAlmostEqual(grouped_floor([1, 2], [1, 8]), 2 / 9)
        self.assertAlmostEqual(grouped_floor([0, 1, 0, 2], [0, 1, 0, 8]), 2 / 9)

    def test_exact_top_requires_supported_rank(self):
        self.assertIsNone(boundary_share([200, 4], [225, 75], 100))
        self.assertEqual(boundary_share([1000, 96, 4], [200, 60, 140], 100), 50)

    def test_failed_update_preserves_last_snapshot(self):
        with TemporaryDirectory() as directory:
            path = Path(directory, 'distribution.json')
            doc = {'series':[{'metric':'x','points':[['2026-01',0]]}],
                   'distribution':{'months':{'2026-01':{}}}}
            publish(path,doc)
            previous = path.read_bytes()
            with self.assertRaises(ValueError):
                publish(path,{'series':[],'distribution':{'months':{'2026-01':{}}}})
            self.assertEqual(path.read_bytes(),previous)

    def test_published_distribution(self):
        dataset = json.loads((Path(__file__).resolve().parents[1] / 'public/atlas/distribution.json').read_text())
        months = dataset['distribution']['months']
        series = {s['metric']:dict(s['points']) for s in dataset['series']}
        self.assertEqual(set(series['gini_grouped_floor']), set(months))
        for month,row in months.items():
            self.assertEqual(len(row['counts']),14)
            self.assertEqual(len(row['btc']),14)
            self.assertAlmostEqual(series['gini_grouped_floor'][month],grouped_floor(row['counts'],row['btc']))
            exact = boundary_share(row['counts'], row['btc'], 100)
            if exact is not None:
                self.assertAlmostEqual(exact, series['top100_share'][month])
        for month, gini in series['gini_address'].items():
            ranks = months[month]['balanceRanks']
            self.assertEqual(sum(n for value,n in ranks), sum(months[month]['counts']))
            self.assertAlmostEqual(grouped_floor([n for v,n in ranks], [v*n for v,n in ranks]), gini)
            self.assertLessEqual(series['gini_grouped_floor'][month], gini + 1e-12)
            for top in (10,100):
                left, amount = top, 0
                for value,n in reversed(ranks):
                    take = min(left,n)
                    amount += take*value
                    left -= take
                self.assertEqual(left, 0)
                self.assertAlmostEqual(amount*100/sum(v*n for v,n in ranks),series[f'top{top}_share'][month])
        self.assertGreater(len(months), 200)


if __name__ == '__main__':
    unittest.main()
