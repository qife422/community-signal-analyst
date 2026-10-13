#!/usr/bin/env python3
"""Acceptance checks against the actual ZIP, in an isolated, bounded temporary tree."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument("--zip",required=True);args=parser.parse_args()
    archive=Path(args.zip);checks=[]
    with zipfile.ZipFile(archive) as zipped:
        infos=zipped.infolist();assert len(infos)<=200 and sum(i.file_size for i in infos)<=2_044_210
        names=zipped.namelist();assert len(set(names))==len(names)
        prefix="community-signal-analyst/"
        assert all(n.startswith(prefix) and ".." not in Path(n).parts and not Path(n).is_absolute() for n in names)
        assert not any(set(Path(n).parts)&{"state","runs","artifacts",".history","node_modules","output","profiles"} for n in names)
        manifest=json.loads(zipped.read(prefix+"manifest.json"))
        assert set(names)=={prefix+i["path"] for i in manifest["payload"]}|{prefix+"manifest.json"}
        for item in manifest["payload"]:
            data=zipped.read(prefix+item["path"]);assert len(data)==item["bytes"] and sha(data)==item["sha256"]
            assert b"/Users/ffq" not in data and b"exp_JG1I58S5zTHbxs" not in data and b"exp_sEw1wojWTWWS5C" not in data
        checks.append("zip_whitelist_manifest_hashes_and_personal_exclusions")
        with tempfile.TemporaryDirectory(prefix="community distribution acceptance ",dir="/private/tmp") as work:
            base=Path(work);zipped.extractall(base);project=base/"community-signal-analyst"
            assert not (project/"node_modules").exists()
            package=json.loads((project/"package.json").read_text())
            for name in ("profile","doctor","preferences:preview","whop:digest"):
                assert package["scripts"][name].startswith("node dist/") and "build" not in package["scripts"][name]
            guard=base/"network guard.mjs";guard.write_text('globalThis.fetch=()=>{throw new Error("network forbidden")};')
            node=shutil.which("node");assert node
            def run(cli,argv,cwd=project):
                result=subprocess.run([node,"--import",str(guard),str(project/"dist/src"/cli),*map(str,argv)],cwd=cwd,capture_output=True,text=True,timeout=15)
                assert result.returncode==0,(cli,result.stderr)
                return json.loads(result.stdout)
            users=[]
            for name in ("user one","user two"):
                directory=base/name;directory.mkdir();file=directory/"profile.json";users.append((directory,file))
                initialized=run("profileCli.js",["init","--file",file]);assert initialized["networkRequests"]==0
                assert json.loads((directory/"scope.json").read_text())["channels"]==[]
                assert not (directory/"whop-state.json").exists()
                assert run("doctorCli.js",["--profile",file])["status"]=="ready"
            checks.append("compiled_init_doctor_two_zero_bound_users_no_network_or_dependencies")
            directory,file=users[0]
            scope=json.loads((ROOT/"tests/fixtures/whop-scope.json").read_text())
            sample=ROOT/"tests/fixtures/whop-snapshot.json"
            snapshot=directory/"capture.json";snapshot.write_bytes(sample.read_bytes())
            (directory/"scope.json").write_text(json.dumps(scope))
            shown=run("profileCli.js",["show","--file",file]);profile=shown["profile"]
            profile["defaults"]["platforms"]=["whop"];profile["defaults"]["maxItems"]=10
            candidate=directory/"candidate.json";candidate.write_text(json.dumps(profile))
            run("profileCli.js",["set","--file",file,"--input",candidate])
            assert run("doctorCli.js",["--profile",file],cwd=users[1][0])["status"]=="unverified_access"
            assert json.loads((users[1][0]/"scope.json").read_text())["channels"]==[]
            report=directory/"reports/digest.json"
            result=run("whopDigestCli.js",["--profile",file,"--snapshot",snapshot,"--out",report,"--json"])
            assert result["records"]==47 and result["networkRequests"]==0
            assert json.loads(report.read_text())["fullRecordCount"]==47
            delta=Path(str(report)+".delta.json");assert len(json.loads(delta.read_text())["records"])==47
            repeat=directory/"reports/repeat.md"
            repeated=run("whopDigestCli.js",["--profile",file,"--snapshot",snapshot,"--out",repeat],cwd=users[1][0])
            assert repeated["records"]==0 and repeated["unchanged"]==47
            checks.append("compiled_whop_full_delta_47_repeat_0_and_47_cross_cwd_paths")
            state=directory/"whop-state.json";before=sha(state.read_bytes());sample_before=sha(snapshot.read_bytes())
            for name,input_file in (("snapshot",snapshot),("delta",delta)):
                out=directory/("reports/"+name+"-replay.json")
                run("preferencesPreviewCli.js",["--profile",file,"--input",input_file,"--out",out,"--json"])
                replay=json.loads(out.read_text());assert replay["replay"] and "已有样本重筛" in replay["markdown"]
                assert all(r["change"]=="saved_sample" for r in replay["selected"])
            assert sha(state.read_bytes())==before and sha(snapshot.read_bytes())==sample_before
            checks.append("compiled_snapshot_delta_replay_no_state_or_input_change")
            profile["defaults"]["platforms"]=["hacker_news","github","devto","product_hunt","x"]
            candidate.write_text(json.dumps(profile));run("profileCli.js",["set","--file",file,"--input",candidate])
            public=directory/"public.json";public.write_bytes((ROOT/"tests/fixtures/public-brief.json").read_bytes())
            run("preferencesPreviewCli.js",["--profile",file,"--input",public,"--out",directory/"reports/public-replay.md"])
            assert "已有样本重筛" in (directory/"reports/public-replay.md").read_text()
            checks.append("compiled_saved_public_brief_replay_without_network")
            files=[p for p in base.rglob("*") if p.is_file()];size=sum(p.stat().st_size for p in files)
            assert len(files)<500 and size<204421*50
            temporary_inventory={"files":len(files),"bytes":size,"disposition":"owned temporary directory removed by context manager"}
    print(json.dumps({"status":"passed","zipSha256":sha(archive.read_bytes()),"entries":len(infos),"uncompressedBytes":sum(i.file_size for i in infos),"checks":checks,"temporaryInventory":temporary_inventory,"externalCodexInstallation":"not_tested","networkRequests":0},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
