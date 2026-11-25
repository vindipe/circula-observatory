import tempfile
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from study_current import (CORE, StudyAsset, asset_identity, fetch_group, layer_for,
                           validate_editions)

D = Decimal
START = date(2020, 2, 1)
END = START + timedelta(days=29)
DAYS = [START + timedelta(days=i) for i in range(30)]


class ObservationTests(unittest.TestCase):
    def test_missing_day_affects_cumulative_and_mean_but_not_stock(self):
        metrics = ('TxCnt','TxTfrCnt','AdrBalCnt','AdrActCnt')
        rows = {day:dict.fromkeys(metrics,D(2)) for day in DAYS if day != DAYS[9]}
        obs = StudyAsset(rows, dict.fromkeys(metrics,(START,END)), 'network').observe(END)
        for key in ('transactions','transfers30d','inactiveFloor','activeAddresses30d'):
            self.assertEqual(obs[key]['status'],'incomplete')
            self.assertEqual(obs[key]['inputs']['firstMissingUtc'],str(DAYS[9]))
            self.assertEqual(obs[key]['inputs']['daysExpected'],30)
        self.assertEqual(obs['fundedAddresses']['value'],2)

    def test_zero_bound_denominator_and_missing_period(self):
        metrics = ('AdrActCnt','AdrBalCnt','SplyCur','SplyExNtv','PriceUSD')
        rows = {day:dict.fromkeys(metrics,D(0)) for day in DAYS}
        spans = dict.fromkeys(metrics,(START,END))
        data = StudyAsset(rows,spans,'network')
        obs = data.observe(END)
        self.assertEqual(obs['fundedAddresses']['status'],'zero_observed')
        self.assertIsNone(obs['inactiveFloor']['value'])
        self.assertEqual(obs['exchangeShare']['status'],'undefined')
        self.assertEqual(obs['exchangeValue']['status'],'zero_observed')
        self.assertEqual(data.observe(START-timedelta(days=1))['supply']['status'],'missing')
        rows[END]['AdrBalCnt'] = D(2)
        rows[END]['AdrActCnt'] = D(3)
        clipped = StudyAsset(rows,spans,'network').observe(END)['inactiveFloor']
        self.assertEqual(clipped['value'],0)
        self.assertEqual(clipped['inputs']['AdrActCntSum30d'],3)

    def test_token_host_scope_and_aggregates(self):
        spans = {'BlkCnt':(START,END)}
        self.assertEqual(asset_identity('usdc',{}),('aggregate',None))
        self.assertEqual(asset_identity('usdc_eth',{}),('token_deployment','eth'))
        self.assertEqual(asset_identity('eth',spans),('network','eth'))
        self.assertEqual(asset_identity('link',{}),('provider_asset',None))
        self.assertIn('Application',layer_for('usdc_eth','token_deployment','eth'))
        actual = StudyAsset({}, {}, 'token_deployment', 'usdc_eth').observe(END,extensions=True)
        for key in ('blocks','ledgerBytes','unspentOutputs','contractCount'):
            self.assertEqual(actual[key]['status'],'not_applicable')
        self.assertEqual(StudyAsset({}, {}, 'network', 'eth').observe(END,True)['unspentOutputs']['status'],
                         'not_applicable')
        self.assertEqual(StudyAsset({}, {}, 'network', 'btc').observe(END,True)['unspentOutputs']['status'],
                         'not_public')

    def test_two_valid_gb_methods_and_byte_gap(self):
        metrics = ('BlkCnt','BlkSizeMeanByte','BlkSizeByte')
        rows = {d:{'BlkCnt':D(2),'BlkSizeMeanByte':D(5_000_000),'BlkSizeByte':D(10_000_000)}
                for d in DAYS}
        spans = dict.fromkeys(metrics,(START,END))
        self.assertEqual(StudyAsset(rows,spans,'network').observe(END)['ledgerBytes']['value'],0.3)
        del rows[DAYS[3]]['BlkSizeByte']
        self.assertEqual(StudyAsset(rows,spans,'network').observe(END)['ledgerBytes']['value'],0.3)
        del rows[DAYS[3]]['BlkSizeMeanByte']
        gap = StudyAsset(rows,spans,'network').observe(END)['ledgerBytes']
        self.assertEqual(gap['status'],'incomplete')
        self.assertIsNone(gap['value'])

    def test_top_decile_input_is_a_quantity(self):
        rows={END:{'SplyCur':D(50),'SplyAdrTop10Pct':D(15)}}
        obs=StudyAsset(rows,{'SplyCur':(END,END),'SplyAdrTop10Pct':(END,END)},'network').observe(END,True)
        self.assertEqual(obs['topDecileShare']['value'],30)

    def test_duplicate_api_row_rejected(self):
        same={'asset':'btc','time':str(END)+'T00:00:00Z','TxCnt':'0'}
        with tempfile.TemporaryDirectory() as cache, patch('study_current.pages',return_value=[same,same]):
            with self.assertRaisesRegex(ValueError,'duplicate'):
                fetch_group('btc',['TxCnt'],START,END,Path(cache))

    def test_changed_definitions_block_publication(self):
        asset={'latest':{key:{'value':0} for key in CORE}}
        old={'cutoffUtc':'2025-12-31','catalogAudit':{'TxCnt':{'definitionSha256':'old'}},'assets':{'btc':asset}}
        new={**old,'cutoffUtc':'2026-10-31','catalogAudit':{'TxCnt':{'definitionSha256':'new'}}}
        with self.assertRaisesRegex(ValueError,'Provider metadata changed'):
            validate_editions(old,new)
        validate_editions(old,{**old,'cutoffUtc':'2026-10-31'})


if __name__ == '__main__':
    unittest.main()
