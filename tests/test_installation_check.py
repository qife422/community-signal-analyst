import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installation_check", Path(__file__).parents[1] / "scripts/check_installation.py")
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


class InstallationInventoryTests(unittest.TestCase):
    def test_node_cache_does_not_trip_worktree_limit(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work); cache = root / "source-user/tmp/node-compile-cache/v22"
            cache.mkdir(parents=True)
            for index in range(501):
                (cache / str(index)).write_text("regenerable")
            (root / "source.ts").write_text("source")
            counts = check.inventory(root)
            self.assertEqual(counts["work"]["files"], 1)
            self.assertEqual(counts["node_compile_cache"]["files"], 501)
            check.check_limits(counts, 238695)

    def test_real_worktree_threshold_still_fails_and_preserves_files(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            for index in range(500):
                (root / str(index)).write_text("keep")
            with self.assertRaisesRegex(ValueError, "Capacity reached for work"):
                check.check_limits(check.inventory(root), 238695)
            self.assertEqual(len(list(root.iterdir())), 500)

    def test_registration_link_does_not_duplicate_dependency_tree(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work); modules = root / "source/node_modules/example"
            modules.mkdir(parents=True); (modules / "runtime.js").write_text("dependency")
            (root / "source/main.ts").write_text("source")
            (root / "registered").symlink_to(root / "source", target_is_directory=True)
            counts = check.inventory(root)
            self.assertEqual(counts["dependencies"]["files"], 1)
            self.assertEqual(counts["work"]["files"], 2)  # source plus link metadata

    def test_new_user_environment_has_no_credentials_and_distinct_empty_configs(self):
        with tempfile.TemporaryDirectory() as work, patch.dict(os.environ, {"GITHUB_TOKEN": "fixture-only", "X_API_ENABLED": "true"}):
            env = check.clean_env(Path(work))
            self.assertNotIn("GITHUB_TOKEN", env)
            self.assertNotIn("X_API_ENABLED", env)
            self.assertTrue(Path(env["CODEX_HOME"]).is_dir())
            self.assertNotEqual(env["npm_config_userconfig"], env["npm_config_globalconfig"])
            self.assertEqual(Path(env["npm_config_userconfig"]).read_text(), "")


if __name__ == "__main__":
    unittest.main()
