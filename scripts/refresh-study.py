#!/usr/bin/env python3
"""Prepare the two research periods and all monthly points before publishing one pointer."""
import argparse
import hashlib
import importlib.util
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from study_current import validate_editions

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts"
spec = importlib.util.spec_from_file_location("refresh_atlas", SCRIPT / "refresh-atlas.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
FILES = ("frozen", "current", "series")


def read_set(directory):
    return {name: directory / f"study-{name}.json" for name in FILES}


def check(files, end):
    frozen, current, months = (release.load(files[key]) for key in FILES)
    if (frozen["baselineUtc"], frozen["cutoffUtc"]) != ("2019-12-31", "2025-12-31"):
        raise ValueError("Paper cutoffs changed")
    if current["baselineUtc"] != frozen["baselineUtc"] or current["cutoffUtc"] != end:
        raise ValueError("Updated study has the wrong comparison period")
    if months["dates"] != sorted(set(months["dates"])) or months["dates"][-1] != end:
        raise ValueError("Invalid monthly calendar")
    if current["retrievedUtc"] != months["retrievedUtc"] or months["cutoffUtc"] != end:
        raise ValueError("Monthly history and current pair come from different releases")
    if set(months["assets"]) != set(current["assets"]) or "btc" not in current["assets"]:
        raise ValueError("Research files disagree on the provider IDs")


def promote(destination, files, end):
    check(files, end)
    checksums = {name: release.digest(file) for name, file in files.items()}
    revision = hashlib.sha256(json.dumps(checksums,sort_keys=True).encode()).hexdigest()
    with release.locked(destination):
        pointer = destination / "study-release.json"
        paths = {name: f"/atlas/study-releases/{revision}/study-{name}.json" for name in FILES}
        previous_files = read_set(destination)
        if pointer.exists():
            previous = release.load(pointer)
            if previous["cutoffUtc"] > end or not re.fullmatch("[a-f0-9]{64}",previous["release"]):
                raise ValueError("Refusing a stale release or invalid pointer")
            previous_directory = destination / "study-releases" / previous["release"]
            previous_files = read_set(previous_directory)
        if previous_files["frozen"].is_file() and release.digest(previous_files["frozen"]) != checksums["frozen"]:
            raise ValueError("The frozen edition cannot change in a monthly update")
        old_study = release.load(previous_files["current"]) if previous_files["current"].is_file() else None
        validate_editions(old_study,release.load(files["current"]))
        directory = destination / "study-releases"
        directory.mkdir(exist_ok=True)
        target = directory / revision
        if not target.exists():
            with tempfile.TemporaryDirectory(dir=directory) as tmp:
                staged = Path(tmp) / "release"
                staged.mkdir()
                for name, file in files.items():
                    shutil.copyfile(file, read_set(staged)[name])
                if any(release.digest(f) != checksums[k] for k,f in read_set(staged).items()):
                    raise ValueError("Study files changed while preparing release")
                staged.rename(target)
        elif any(release.digest(f) != checksums[k] for k,f in read_set(target).items()):
            raise ValueError("Immutable research release is corrupt")
        manifest = {"schema":1, "release":revision,"cutoffUtc":end,"files":paths}
        release.write_manifest(pointer,manifest)
        return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination",type=Path,default=ROOT / "public/atlas")
    parser.add_argument("--cache",type=Path,default=ROOT / ".cache/atlas-refresh/study")
    parser.add_argument("--from-verified",type=Path,help="Promote previously prepared study files")
    args = parser.parse_args()
    end = str(datetime.now(UTC).date().replace(day=1) - timedelta(days=1))
    if args.from_verified:
        result = promote(args.destination, read_set(args.from_verified), end)
    else:
        dependencies = [SCRIPT / f for f in ("study_current.py","study_series.py","community.py")]
        key = hashlib.sha256("".join(release.digest(p) for p in dependencies).encode()).hexdigest()
        build = args.cache / end / key
        with release.locked(build):
            files = read_set(build)
            files["frozen"] = ROOT / "public/atlas/study-frozen.json"
            for name, script in (("current","study_current.py"),("series","study_series.py")):
                if files[name].exists():
                    cached=release.load(files[name])
                    if cached.get("cutoffUtc") == end:
                        continue
                command = [sys.executable, "-B", str(SCRIPT / script), "--end",end,"--cache",str(args.cache),
                           "--output",str(files[name])]
                if name=="series":
                    command += ["--pair",str(files["current"])]
                subprocess.run(command, check=True, cwd=ROOT)
            result = promote(args.destination,files,end)
    print(f"Study through {end}: {result['release']}")


if __name__ == "__main__":
    main()
