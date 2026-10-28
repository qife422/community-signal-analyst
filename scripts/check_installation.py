#!/usr/bin/env python3
"""Check README installation in clean temporary users; never use existing auth.

Use --source/--bundle for an unpublished candidate, or --ref for public GitHub.
All disposable files belong to one context. Runtime state/history are excluded.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import tempfile
import time
import sys
import platform
import urllib.request
import zipfile

REPO = "qife422/community-signal-analyst"
# Separate regenerable caches from work files; do not raise the worktree limit.
LIMITS = {
    "work": (500, 10_000_000, 50),
    "dependencies": (2000, 200_000_000, 1000),
    "npm_cache": (2000, 100_000_000, 500),
    "node_compile_cache": (1500, 20_000_000, 100),
    "git_metadata": (500, 5_000_000, 25),
}


def inventory(root):
    """Measure lstat bytes once, without traversing source-registration links."""
    root = Path(root)
    groups = {name: {"files": 0, "bytes": 0, "examples": []} for name in LIMITS}
    for directory, dirs, files in os.walk(root, followlinks=False):
        # Directory links are metadata, never another source/dependency tree.
        links = [name for name in dirs if is_link(Path(directory) / name)]
        dirs[:] = [name for name in dirs if name not in links]
        for name in files + links:
            path = Path(directory) / name
            parts = path.relative_to(root).parts
            kind = ("dependencies" if "node_modules" in parts else
                    "npm_cache" if ".npm" in parts else
                    "node_compile_cache" if "node-compile-cache" in parts and "tmp" in parts else
                    "git_metadata" if ".git" in parts else "work")
            info = path.lstat()
            if not (stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or is_link(path)):
                raise ValueError("Unexpected non-file input")
            group = groups[kind]
            group["files"] += 1
            group["bytes"] += info.st_size
            if len(group["examples"]) < 4:
                group["examples"].append(str(path.relative_to(root)))
    return groups


def check_limits(groups, source_bytes):
    for name, group in groups.items():
        files, absolute_bytes, amplification = LIMITS[name]
        if group["files"] >= files or group["bytes"] >= min(absolute_bytes, source_bytes * amplification):
            raise ValueError("Capacity reached for " + name + ": " + json.dumps(group))


def is_link(path):
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))


def clean_env(home):
    home = Path(home)
    for name in ("tmp", ".codex", "AppData/Roaming", "AppData/Local"):
        (home / name).mkdir(mode=0o700, parents=True, exist_ok=True)
    for name in ("user.npmrc", "global.npmrc", "empty.gitconfig"):
        (home / name).write_text("", encoding="utf-8")
    tool_dirs = [str(Path(sys.executable).parent)]
    for name in ("node", "npm", "git", "bash", "pwsh", "powershell", "python3", "python", "py"):
        found = shutil.which(name)
        if found:
            tool_dirs.append(str(Path(found).parent))
    if os.name != "nt":
        tool_dirs.extend(["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"])
    else:
        tool_dirs.extend([str(Path(os.environ["SystemRoot"]) / "System32"), os.environ["SystemRoot"]])
    env = {
        "PATH": os.pathsep.join(dict.fromkeys(tool_dirs)),
        "HOME": str(home), "USERPROFILE": str(home), "CODEX_HOME": str(home / ".codex"),
        "APPDATA": str(home / "AppData/Roaming"), "LOCALAPPDATA": str(home / "AppData/Local"),
        "TMPDIR": str(home / "tmp"), "TEMP": str(home / "tmp"), "TMP": str(home / "tmp"),
        "LANG": "en_US.UTF-8", "PYTHONUTF8": "1",
        "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(home / "empty.gitconfig"), "GIT_TERMINAL_PROMPT": "0",
        "npm_config_cache": str(home / ".npm"),
        "npm_config_userconfig": str(home / "user.npmrc"),
        "npm_config_globalconfig": str(home / "global.npmrc"),
    }
    if os.name == "nt":
        for key in ("SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "OS"):
            if key in os.environ:
                env[key] = os.environ[key]
    return env


def executable(command):
    # npm.cmd cannot reliably be launched with shell=False on Windows.
    if os.name == "nt" and command[0] == "npm":
        npm = shutil.which("npm")
        cli = Path(npm).parent / "node_modules/npm/bin/npm-cli.js" if npm else Path("")
        if not cli.is_file():
            raise ValueError("Cannot locate npm-cli.js beside the Node.js installation")
        return [shutil.which("node"), str(cli), *command[1:]]
    return command


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "community-signal-installation-check"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def local_snapshot(source, destination):
    destination.mkdir()
    for folder in ("src", "tests", "scripts", "agents", "mock-data", "references"):
        for path in (source / folder).rglob("*"):
            if not path.is_file() or "__pycache__" in path.parts:
                continue
            if path.is_symlink():
                raise ValueError("Local source whitelist cannot contain links")
            target = destination / path.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    for name in ("README.md", "SKILL.md", "package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts"):
        shutil.copyfile(source / name, destination / name)


def execute(args):
    out = Path(args.out).absolute()
    if not out.parent.is_dir() or out.exists() or out.is_symlink():
        raise ValueError("Choose a new report path in an existing directory")
    result = {"schemaVersion": 1, "status": "running", "steps": [], "limits": LIMITS,
              "notVerified": ["authenticated Codex model execution", "Whop member/browser capture", "paid sources", "other operating systems"], "platform": {"system": platform.system(), "release": platform.release(), "python": platform.python_version()}}
    def save():
        data = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        if len(data.encode()) > 500_000:
            raise ValueError("Report too large")
        out.write_text(data, encoding="utf-8")
    try:
        with tempfile.TemporaryDirectory(prefix="community-installation-", dir="/private/tmp" if Path("/private/tmp").is_dir() else None) as work:
            base = Path(work)
            source_home = base / "source-user"; source_home.mkdir()
            source_env = clean_env(source_home)
            source = source_home / "community-signal-analyst"
            # Bound against the established initial source baseline until the snapshot exists.
            source_bytes = 238_695
            def run(name, command, cwd, env, expected=0, timeout=150):
                before = time.monotonic()
                process = subprocess.Popen(executable(command), cwd=cwd, env=env, stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", start_new_session=os.name != "nt")
                try:
                    stdout, stderr = process.communicate(timeout=timeout)
                except subprocess.TimeoutExpired:
                    if process.poll() is None:
                        process.kill() if os.name == "nt" else os.killpg(process.pid, signal.SIGTERM)
                    process.communicate()
                    raise RuntimeError(name + " timed out")
                redacted = lambda value: value.replace(str(base), "<isolated-root>")
                entry = {"name": name, "command": [redacted(s) for s in command], "exitCode": process.returncode,
                         "seconds": round(time.monotonic() - before, 2), "stdout": redacted(stdout[-6500:]),
                         "stderr": redacted(stderr[-2000:])}
                result["steps"].append(entry)
                result["inventory"] = inventory(base)
                save()
                check_limits(result["inventory"], source_bytes)
                print(name + ": exit " + str(process.returncode), flush=True)
                if process.returncode != expected:
                    raise RuntimeError(name + " exited " + str(process.returncode))
                return stdout

            if args.source:
                local_snapshot(Path(args.source).resolve(), source)
                result["sourceKind"] = "local_candidate_whitelist_no_dependencies"
            else:
                metadata = json.loads(get("https://api.github.com/repos/" + REPO + "/commits/" + args.ref))
                result["downloadedCommit"] = metadata["sha"]
                run("git_clone", ["git", "clone", "https://github.com/" + REPO + ".git", str(source)], source_home, source_env)
                run("git_checkout_snapshot", ["git", "checkout", "--detach", metadata["sha"]], source, source_env)
                result["sourceKind"] = "public_github"
            source_bytes = sum(p.stat().st_size for p in (source / "src").rglob("*.ts"))
            result["sourceBytes"] = source_bytes
            result["lockSha256"] = hashlib.sha256((source / "package-lock.json").read_bytes()).hexdigest()
            result["version"] = json.loads((source / "package.json").read_text(encoding="utf-8"))["version"]
            readme = (source / "README.md").read_text(encoding="utf-8")
            language = "powershell" if os.name == "nt" else "bash"
            blocks = re.findall(r"```" + language + r"\n(.*?)```", readme, re.S)
            shell = [shutil.which("pwsh") or shutil.which("powershell"), "-NoProfile", "-NonInteractive", "-Command"] if os.name == "nt" else ["/bin/bash", "-c"]
            def block(text):
                return next(b for b in blocks if text in b)
            for snippet in ([] if os.name == "nt" else blocks):
                syntax = subprocess.run(["/bin/bash", "-n"], input=snippet, capture_output=True, text=True)
                if syntax.returncode:
                    raise ValueError("README shell syntax failed")
            result["readmeShellBlocks"] = len(blocks)
            if args.bundle:
                bundle = Path(args.bundle).read_bytes()
            elif args.source:
                bundle = (Path(args.source) / "distribution/community-signal-analyst.zip").read_bytes()
            else:
                bundle = get("https://raw.githubusercontent.com/" + REPO + "/" + result["downloadedCommit"] + "/distribution/community-signal-analyst.zip")
            digest = hashlib.sha256(bundle).hexdigest(); result["zipSha256"] = digest
            if digest not in readme:
                raise ValueError("README ZIP fingerprint does not match")
            compiled_home = base / "compiled-user"; compiled_home.mkdir()
            compiled_env = clean_env(compiled_home)
            skills = compiled_home / ".agents/skills"; skills.mkdir(parents=True)
            with zipfile.ZipFile(io.BytesIO(bundle)) as zipped:
                infos = zipped.infolist()
                if len(infos) >= 200 or sum(i.file_size for i in infos) >= 2_044_210:
                    raise ValueError("ZIP capacity exceeded")
                if any(Path(i.filename).is_absolute() or ".." in Path(i.filename).parts for i in infos):
                    raise ValueError("Unsafe archive path")
                zipped.extractall(skills)
            compiled = skills / "community-signal-analyst"
            if (compiled / "node_modules").exists():
                raise ValueError("Compiled bundle unexpectedly has dependencies")
            if json.loads((compiled / "package.json").read_text(encoding="utf-8"))["version"] != result["version"]:
                raise ValueError("Source and bundle versions differ")
            for name, snippet in [("compiled_init_doctor", block("profile -- init")),
                                  ("compiled_show", block("profile -- show")),
                                  ("compiled_demo", next(b for b in blocks if b.strip().startswith("npm.cmd run demo" if os.name == "nt" else "npm run demo"))),
                                  ("compiled_empty_bindings", block("whop:bind -- list"))]:
                run(name, [*shell, snippet], compiled, compiled_env)
            if args.public_read:
                run("compiled_public_research", [*shell, block("npm.cmd run live" if os.name == "nt" else "npm run live")], compiled, compiled_env)
                report = compiled_home / ".community-signal-analyst/reports/first-research.json"
                brief = json.loads(report.read_text(encoding="utf-8"))
                result["publicResearch"] = {"selected": len(brief["selectedItems"]), "queriedPlatforms": brief.get("queriedPlatforms")}
            else:
                result["publicResearch"] = "not rerun; runtime/source fields unchanged and no new live gate required"
            if (source / "node_modules").exists() or (source_home / ".npm").exists():
                raise ValueError("Source installation is not clean")
            run("source_npm_ci", ["npm", "ci"], source, source_env)
            audit = json.loads(run("source_npm_audit", ["npm", "audit", "--json"], source, source_env))
            result["audit"] = audit["metadata"]["vulnerabilities"]
            if result["audit"]["total"] != 0:
                raise ValueError("Dependency advisories remain")
            for name, command in [("source_build", ["npm", "run", "build"]),
                                  ("source_registration", [*shell, block("New-Item -ItemType Junction" if os.name == "nt" else "ln -s")]),
                                  ("source_init_doctor", [*shell, block("profile -- init")]),
                                  ("source_typecheck", ["npm", "run", "typecheck"]),
                                  ("source_tests", ["npm", "test"]),
                                  ("inventory_unit_tests", ["npm", "run", "test:installation-unit"]),
                                  ("source_packaging", ["npm", "run", "package", "--", "--out", str(source_home / "candidate.zip")]),
                                  ("source_bundle_acceptance", ["node", "scripts/run-python.mjs", "scripts/verify_distribution.py", "--zip", str(source_home / "candidate.zip")])]:
                run(name, command, source, source_env)
            if (source_home / ".agents/skills/community-signal-analyst").resolve() != source:
                raise ValueError("Source registration points elsewhere")
            result["inventory"] = inventory(base); check_limits(result["inventory"], source_bytes)
            result["temporaryDisposition"] = "only this context-owned tree removed; old state/evidence untouched"
        result["status"] = "passed"; save()
    except Exception as exc:
        result["status"] = "failed"; result["error"] = str(exc); save(); raise
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="Local candidate source, copied by whitelist without dependencies")
    parser.add_argument("--bundle", help="Explicit local candidate ZIP")
    parser.add_argument("--ref", default="main", help="Public GitHub branch or commit when --source is absent")
    parser.add_argument("--out", required=True, help="New JSON result path")
    parser.add_argument("--public-read", action="store_true", help="Explicitly run the README's bounded public HN query")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9._/-]+", args.ref):
        parser.error("Invalid ref")
    result = execute(args)
    print(json.dumps({k: v for k, v in result.items() if k != "steps"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
