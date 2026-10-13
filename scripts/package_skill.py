#!/usr/bin/env python3
"""Build the reviewed, portable distribution; never include operational user data."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
# Exact paths: adding a module requires deliberately reviewing this list.
SOURCES = """
adapters/authorized adapters/discord adapters/live adapters/mockDevToAdapter
adapters/mockGitHubAdapter adapters/mockHackerNewsAdapter adapters/types adapters/whop
adapters/x adapters/xReplies cli cliArgs comments/groupThemes corroboration/matchSources
doctorCli history index normalizer/normalizeItems preferences preferencesPreviewCli
profile/doctor profile/output profile/schema profile/store profileCli
query-parser/keywordConcepts query-parser/parseQuery query-parser/platformSelector
report/generateBrief report/generateLiveBrief scoring/scoreItem scoring/selectTopItems
types/communitySignal verification whop/bindings whop/browserDigest whop/http whop/oauth
whop/preferences whopAuthCli whopDigestCli whopScopeCli
""".split()
REFERENCES = ["onboarding", "report-template", "scoring-and-prompts", "claim-verification", "platform-fields"]
MOCKS = ["devto", "github", "hacker-news"]
LIMIT = min(5_000_000, 204421 * 10)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def payload():
    files = {}
    def add(name, data=None):
        path = ROOT / name
        if data is None:
            if path.is_symlink() or not path.is_file():
                raise ValueError("Whitelist input missing or not regular: " + name)
            data = path.read_bytes()
        files[name] = data
    for source in SOURCES:
        src, compiled = ROOT / ("src/"+source+".ts"), ROOT / ("dist/src/"+source+".js")
        if not compiled.is_file() or compiled.stat().st_mtime_ns < src.stat().st_mtime_ns:
            raise ValueError("Build required before packaging: " + source)
        add("src/"+source+".ts")
        add("dist/src/"+source+".js")
    for name in MOCKS:
        add("mock-data/"+name+".mock.json")
        add("dist/mock-data/"+name+".mock.json")
    for name in REFERENCES:
        add("references/"+name+".md")
    add("agents/openai.yaml")
    add("tsconfig.json")
    add("package-lock.json")
    package = json.loads((ROOT/"package.json").read_text())
    package["engines"] = {"node": ">=22"}
    package["scripts"] = {
        "build":"tsc", "typecheck":"tsc --noEmit",
        "demo":"node dist/src/cli.js --demo \"AI coding discussions\"",
        "live":"node dist/src/cli.js", "whop:bind":"node dist/src/whopScopeCli.js",
        "whop:digest":"node dist/src/whopDigestCli.js", "profile":"node dist/src/profileCli.js",
        "doctor":"node dist/src/doctorCli.js", "preferences:preview":"node dist/src/preferencesPreviewCli.js"
    }
    add("package.json", (json.dumps(package,ensure_ascii=False,indent=2)+"\n").encode())
    skill = (ROOT/"SKILL.md").read_text().split("---",2)[1]
    add("SKILL.md", ("---"+skill+"---\n\n"+(ROOT/"references/distribution-entry.md").read_text()).encode())
    add("README.md", ("# Community Signal Analyst\n\n版本 "+package["version"]+"。需要 Node.js22+；已编译本地命令无需安装依赖。自然语言需 Codex，Whop 捕获需自己的授权浏览器/会员访问。\n\n从 [首次配置说明](references/onboarding.md) 开始，创建包外独立 profile，零绑定。doctor 不验证在线权限；个人文件不属于分发内容。\n\nmanifest.json 保存全部负载文件字节数与 SHA-256，不含清单自身。开发者重建需 npm ci，再 npm run build。\n").encode())
    forbidden = [str(ROOT).encode(), b"/Users/ffq", b"exp_JG1I58S5zTHbxs", b"exp_sEw1wojWTWWS5C", b"stock-and-option", b"vision-reimagine", b"AI for PROs"]
    for name, data in files.items():
        if any(value in data for value in forbidden):
            raise ValueError("Personal marker found in reviewed payload: " + name)
    manifest = {"schemaVersion":1,"name":package["name"],"version":package["version"],"minimumNode":"22",
                "payload":[{"path":name,"bytes":len(data),"sha256":sha(data)} for name,data in sorted(files.items())]}
    add("manifest.json", (json.dumps(manifest,ensure_ascii=False,indent=2)+"\n").encode())
    if len(files)>200 or sum(map(len,files.values()))>LIMIT:
        raise ValueError("Distribution threshold reached; inspect before further growth")
    return files

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--out",required=True);args=parser.parse_args()
    out=Path(args.out)
    if not out.is_absolute() or not out.parent.is_dir() or out.exists() or out.is_symlink():
        raise ValueError("Choose a new absolute ZIP path in an existing directory")
    files=payload()
    archive=io.BytesIO()
    with zipfile.ZipFile(archive,"w",compression=zipfile.ZIP_DEFLATED) as zipped:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo("community-signal-analyst/"+name,(2026,10,8,0,0,0))
            info.create_system=3;info.external_attr=(stat.S_IFREG|0o644)<<16;info.compress_type=zipfile.ZIP_DEFLATED
            zipped.writestr(info,data)
    data=archive.getvalue()
    if len(data)>LIMIT:raise ValueError("ZIP threshold exceeded")
    with out.open("xb") as file:file.write(data)
    print(json.dumps({"file":str(out),"version":json.loads(files["package.json"])["version"],"entries":len(files),"uncompressedBytes":sum(map(len,files.values())),"zipBytes":len(data),"sha256":sha(data)},ensure_ascii=False))

if __name__=="__main__":
    main()
