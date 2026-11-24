#!/usr/bin/env python3
"""Prepare all monthly atlas inputs offline, then atomically promote one manifest."""
import argparse
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = {"history": "history.py", "community": "community.py", "holdings": "holdings.py",
           "distribution": "distribution.py", "stellar": "stellar_snapshot.py"}
MONTH = re.compile(r"^[0-9]{4}-(0[1-9]|1[0-2])$")


@contextmanager
def locked(directory):
    directory.mkdir(parents=True, exist_ok=True)
    fd = os.open(directory, os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def load(path):
    return json.loads(path.read_bytes())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_manifest(path, manifest):
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as file:
        tmp = Path(file.name)
        try:
            json.dump(manifest, file, sort_keys=True, separators=(",", ":"))
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
            os.chmod(tmp, 0o644)
            os.replace(tmp, path)
        finally:
            tmp.unlink(missing_ok=True)


def coverage(doc, source, through):
    """Reject missing observations masquerading as zero and duplicate period keys."""
    seen = {}
    def add(key, dates):
        dates = list(dates)
        if key in seen or len(set(dates)) != len(dates):
            raise ValueError(f"Repeated series or observation in {source}: {key}")
        seen[key] = set(dates)
    def check_month(month):
        if not MONTH.fullmatch(month) or month > through:
            raise ValueError(f"Invalid or open observation month in {source}: {month}")
    for series in doc["series"]:
        for key in ("asset", "metric", "unit", "scope", "source", "license"):
            if not series.get(key):
                raise ValueError(f"Missing series metadata: {source}/{key}")
        points = series["points"]
        if not points:
            raise ValueError(f"Empty published series in {source}")
        for month, value in points:
            check_month(month)
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"Missing or invalid observation in {source}/{month}")
        months = [p[0] for p in points]
        if months != sorted(months):
            raise ValueError(f"Unordered months in {source}")
        add(("series", series["asset"], series["metric"], series["unit"], series.get("kind")), months)
    if source == "distribution":
        profile = doc["distribution"]
        for month in profile["months"]:
            check_month(month)
        width = len(profile["bands"])
        if not width or any(len(row[key]) != width for row in profile["months"].values() for key in ("counts", "btc")):
            raise ValueError("Incomplete distribution bands")
        add(("distribution", json.dumps(profile["bands"], sort_keys=True)), profile["months"].keys())
    if source == "stellar":
        for row in doc["samples"] + doc["events"]:
            check_month(row["date"][:7])
        add(("sampled-ledgers", doc["stride"]), [s["ledger"] for s in doc["samples"]])
        add(("events",), [(e["ledger"], e["kind"], e["key"]) for e in doc["events"]])
        if not doc["samples"] and not doc["unavailable"]:
            raise ValueError("Empty Stellar extraction")
    if not seen and not doc["unavailable"]:
        raise ValueError(f"No validated data or coverage statement for {source}")
    return seen


def check_growth(previous, candidate, source, through):
    new = coverage(candidate, source, through)
    if previous is None:
        return
    for key, periods in coverage(previous, source, through).items():
        if key not in new or not periods.issubset(new[key]):
            raise ValueError(f"Coverage would shrink: {source} {key}")


def current_files(atlas, through):
    pointer = atlas / "current.json"
    if not pointer.exists():
        return {s: atlas / (s + ".json") for s in SCRIPTS}
    manifest = load(pointer)
    release = manifest["release"]
    if (manifest["schema"] != 1 or not re.fullmatch(r"[0-9a-f]{64}", release)
            or manifest["through"] > through or set(manifest["files"]) != set(SCRIPTS)):
        raise ValueError("Cannot replace newer or unrecognized release")
    files = {}
    for source in SCRIPTS:
        relative = f"releases/{release}/{source}.json"
        if manifest["files"][source] != "/atlas/" + relative:
            raise ValueError("Unexpected release path")
        files[source] = atlas / relative
        if not files[source].is_file():
            raise ValueError("Published release shard missing")
    return files


def promote(atlas, candidates, through):
    if set(candidates) != set(SCRIPTS):
        raise ValueError("Release does not contain every source")
    with locked(atlas):
        baseline = current_files(atlas, through)
        checksums = {}
        for source, candidate in candidates.items():
            old = baseline[source]
            check_growth(load(old) if old.exists() else None, load(candidate), source, through)
            checksums[source] = digest(candidate)
        release = hashlib.sha256(json.dumps(checksums, sort_keys=True).encode()).hexdigest()
        releases = atlas / "releases"
        releases.mkdir(exist_ok=True)
        target = releases / release
        if not target.exists():
            temp = Path(tempfile.mkdtemp(dir=releases, prefix=".incoming-"))
            try:
                for name, candidate in candidates.items():
                    shard = temp / (name + ".json")
                    shutil.copyfile(candidate, shard)
                    if digest(shard) != checksums[name]:
                        raise ValueError(f"Source changed while copying: {name}")
                temp.chmod(0o755)
                temp.rename(target)
            finally:
                if temp.exists():
                    shutil.rmtree(temp)
        elif any(digest(target / (s + ".json")) != expected for s, expected in checksums.items()):
            raise ValueError("Immutable release failed its integrity check")
        urls = {s: f"/atlas/releases/{release}/{s}.json" for s in SCRIPTS}
        manifest = {"schema": 1, "through": through, "release": release, "files": urls}
        write_manifest(atlas / "current.json", manifest)
        return manifest


def collect(source, work, end, retry, baseline):
    script = ROOT / "scripts" / SCRIPTS[source]
    cache = work / source
    cache.mkdir(parents=True, exist_ok=True)
    fingerprints = [digest(script)]
    inputs = {
        "stellar": [ROOT / "scripts/stellar_decode.cjs"],
        "distribution": [ROOT / "scripts/distribution_early.py", ROOT / "scripts/distribution_i18n.py"],
        "community": [ROOT / "scripts/community_i18n.py"],
        "history": [ROOT / "public/research-data/bitcoin-bytes.v1.json"],
    }
    fingerprints.extend(digest(dependency) for dependency in inputs.get(source, []))
    key = hashlib.sha256("".join(fingerprints).encode()).hexdigest()
    output = cache / (key + ".json")
    through = end[:7]
    if output.is_file() and not retry:
        try:
            check_growth(baseline, load(output), source, through)
            return output
        except (ValueError, TypeError, KeyError):
            retry = True
    with tempfile.TemporaryDirectory(dir=cache) as stage:
        candidate = Path(stage) / (source + ".json")
        command = [sys.executable, "-B", str(script), "--output", str(candidate)]
        raw_cache = str(Path(tempfile.mkdtemp(dir=cache, prefix="retry-inputs-")) if retry else cache / "inputs")
        if source == "community":
            command += ["--end", end, "--cache", raw_cache]
        elif source == "stellar":
            command += ["--through", through, "--cache", raw_cache]
        elif source == "distribution":
            next_day = datetime.strptime(end, "%Y-%m-%d").date() + timedelta(days=1)
            command += ["--as-of", str(next_day), "--cache", raw_cache]
        subprocess.run(command, check=True, cwd=ROOT)
        check_growth(baseline, load(candidate), source, through)
        os.replace(candidate, output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, default=ROOT / "public/atlas")
    parser.add_argument("--work-dir", type=Path, default=ROOT / ".cache/atlas-refresh")
    parser.add_argument("--retry-source", action="append", choices=SCRIPTS, default=[],
                        help="Repeat a completed producer for this month")
    parser.add_argument("--from-verified", type=Path,
                        help="Promote precomputed SOURCE.json snapshots after the same checks")
    args = parser.parse_args()
    end = datetime.now(UTC).date().replace(day=1) - timedelta(days=1)
    through = end.strftime("%Y-%m")
    if args.from_verified:
        inputs = {s: args.from_verified / (s + ".json") for s in SCRIPTS}
        manifest = promote(args.destination, inputs, through)
    else:
        work = args.work_dir.resolve() / through
        with locked(work):
            sources = current_files(args.destination, through)
            inputs = {s: collect(s, work, str(end), s in args.retry_source,
                                 load(path) if path.exists() else None) for s, path in sources.items()}
            manifest = promote(args.destination, inputs, through)
    print(f"Verified monthly release {manifest['release']} ready in {args.destination}", flush=True)


if __name__ == "__main__":
    main()
