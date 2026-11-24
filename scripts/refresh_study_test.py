"""Exercise releases with shipped observations and a staged bad definition."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

P = Path(__file__).with_name("refresh-study.py")
spec = importlib.util.spec_from_file_location("promotion", P)
promotion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promotion)

class StudyReleaseTest(unittest.TestCase):
    def test_retry_and_rejected_candidate_keep_one_valid_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / 'atlas'
            files = promotion.read_set(P.parents[1] / 'public/atlas')
            end = json.loads(files["current"].read_bytes())["cutoffUtc"]
            published = promotion.promote(destination,files,end)
            self.assertEqual(published,promotion.promote(destination,files,end))
            self.assertEqual(len(list((destination/"study-releases").iterdir())),1)
            path = Path(tmp) / 'candidate.json'
            value = json.loads(files["current"].read_bytes())
            value["catalogAudit"]["TxCnt"]["definitionSha256"] = 'changed'
            path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError,"definition|metadata"):
                promotion.promote(destination,{**files,"current":path},end)
            self.assertEqual(published,json.loads((destination/"study-release.json").read_bytes()))
