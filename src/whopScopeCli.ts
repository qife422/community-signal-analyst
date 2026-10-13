import { bindingHelp, runBindingCommand } from "./whop/bindings.js";

const args = process.argv.slice(2);
if (args.length===0 || (args.length===1 && args[0]==="--help")) console.log(bindingHelp);
else {
  try { console.log(JSON.stringify(runBindingCommand(args),null,2)); }
  catch (error) {
    console.error(error instanceof Error && !("code" in error) ? error.message : "绑定失败：检查配置文件、现有锁与目录权限；已有绑定不变。");
    process.exitCode=1;
  }
}
