#!/usr/bin/env python3
"""Pinned external test runtime, outside project dependencies; never installs globally."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import tarfile
import urllib.request

VERSION = "0.165.0"
BASE = "https://github.com/openai/codex/releases/download/rust-v" + VERSION + "/"
ASSETS = {
    "linux": [("codex-x86_64-unknown-linux-musl.tar.gz", 115837472, "be635d3486a5bd060d0fff582ae6d30160280c31344dd85719707fa920e187f0", "codex")],
    "win32": [
        ("codex-x86_64-pc-windows-msvc.exe.tar.gz", 117797965, "4953767aa3f279a2f8050ced8fddd832655e45ff114479c58e53576637ed211f", "codex.exe"),
        ("codex-command-runner-x86_64-pc-windows-msvc.exe", 8748848, "8f1a9d4217a34d6b44df81c25999ff9b98bb8d0e3c179aa070fcd84b3ce7a9d3", "codex-command-runner.exe"),
        ("codex-windows-sandbox-service-x86_64-pc-windows-msvc.exe", 59208496, "48b13eee521adada28083167f187b2df0fb6c2eab2f7e59ef36e0c12beae77b0", "codex-windows-sandbox-service.exe"),
        ("codex-windows-sandbox-setup-x86_64-pc-windows-msvc.exe", 18794288, "a39f42dc697919e650cd24f82daaecd6121e41e3f4d56373fef4f4177f8eee02", "codex-windows-sandbox-setup.exe"),
    ],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    if platform.machine().lower() not in ("x86_64", "amd64"):
        raise ValueError("This native CI runtime is pinned for x64 only")
    system = "win32" if os.name == "nt" else "linux"
    if platform.system() not in ("Windows", "Linux"):
        raise ValueError("Use an existing local Codex for macOS development")
    root = Path(args.out).absolute()
    if root.exists() or not root.parent.is_dir():
        raise ValueError("Choose a new runtime directory in an existing temporary parent")
    source = Path(__file__).resolve().parents[1] / "src"
    source_bytes = sum(p.stat().st_size for p in source.rglob("*.ts"))
    # Independent external Codex runtime, not the application's 200 MB dependencies.
    limit = min(600_000_000, source_bytes * 2500)
    root.mkdir()
    def check(extra=0):
        files = [p for p in root.iterdir() if p.is_file()]
        if len(files) >= 100 or sum(p.stat().st_size for p in files) + extra >= limit:
            raise ValueError("External Codex runtime capacity reached; preserve and inspect")
    records = []
    for name, size, digest, target_name in ASSETS[system]:
        check(size)
        archive = root / name
        with urllib.request.urlopen(BASE + name, timeout=60) as response, archive.open("xb") as output:
            count = 0
            hashed = hashlib.sha256()
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                count += len(chunk)
                if count > size:
                    raise ValueError("Release download exceeds pinned length")
                output.write(chunk)
                hashed.update(chunk)
        if count != size or hashed.hexdigest() != digest:
            raise ValueError("Release length or SHA-256 mismatch")
        if name.endswith(".tar.gz"):
            with tarfile.open(archive, "r:gz") as tar:
                entries = tar.getmembers()
                if len(entries) != 1 or not entries[0].isfile() or entries[0].size > 400_000_000:
                    raise ValueError("Unexpected standalone runtime archive")
                check(entries[0].size)
                target = root / target_name
                with tar.extractfile(entries[0]) as input_file, target.open("xb") as output:
                    while True:
                        chunk = input_file.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
        else:
            target = root / target_name
            archive.rename(target)
        target.chmod(0o755)
        records.append({"url": BASE + name, "downloadBytes": size, "sha256": digest, "target": target_name, "unpackedBytes": target.stat().st_size})
        check()
    report = {"status": "passed", "version": VERSION, "platform": system, "limits": {"bytes": limit, "files": 100, "sourceAmplification": 2500}, "sourceBytes": source_bytes, "assets": records}
    (root / "runtime.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    check()
    print(json.dumps(report))


if __name__ == "__main__":
    main()
