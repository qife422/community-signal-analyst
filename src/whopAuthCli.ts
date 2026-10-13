import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { beginWhopOAuth, finishWhopOAuth, writeWhopTokens } from "./whop/oauth.js";

async function main(): Promise<void> {
  const args=process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log("Whop read-only OAuth setup\nUsage: node dist/src/whopAuthCli.js --app-id app_... --out /absolute/private/whop.json\nOptional: --port 4387\nRegister http://127.0.0.1:4387/whop/callback in the app's OAuth settings. Only chat:read is requested. No chat collection starts here.");return;
  }
  const values=new Map<string,string>();
  for (let i=0;i<args.length;i+=2) {
    if (!["--app-id","--out","--port"].includes(args[i]) || !args[i+1] || args[i+1].startsWith("--") || values.has(args[i])) throw new Error("Invalid Whop OAuth arguments; see --help");
    values.set(args[i],args[i+1]);
  }
  const path=values.get("--out") ?? "", port=Number(values.get("--port") ?? "4387");
  if (!isAbsolute(path) || existsSync(path)) throw new Error("Choose a new absolute private credential-file path; existing files are never overwritten");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid callback port");
  const session=beginWhopOAuth(values.get("--app-id") ?? "",`http://127.0.0.1:${port}/whop/callback`);
  await new Promise<void>((resolve,reject) => {
    let processing=false;
    const server=createServer(async (req,res) => {
      res.setHeader("Content-Type","text/plain; charset=utf-8");res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","no-referrer");
      if (req.method !== "GET" || req.headers.host !== `127.0.0.1:${port}` || !req.url || req.url.length > 10_000) {res.writeHead(400);res.end("Invalid callback");return;}
      const callback=new URL(req.url,session.redirectUri);
      if (callback.pathname !== "/whop/callback") {res.writeHead(404);res.end("Not found");return;}
      if (processing) {res.writeHead(409);res.end("Authorization callback already processing");return;}
      if (callback.searchParams.get("state") !== session.state) {res.writeHead(400);res.end("Invalid OAuth state");return;}
      processing=true;
      try {
        const tokens=await finishWhopOAuth(session,callback.href);
        writeWhopTokens(path,tokens);
        res.end("Whop read-only authorization saved locally. You can close this page. Chat access still needs verification.");
        console.log("OAuth credentials saved privately (0600). No token printed; no chat messages collected.");
        finish();resolve();
      } catch {
        res.writeHead(400);res.end("Authorization failed. No credential saved. Return to Codex to check app settings and permissions.");finish();reject(new Error("Whop authorization failed; no token printed"));
      }
    });
    const timeout=setTimeout(()=>{finish();reject(new Error("Whop OAuth timed out after 10 minutes"));},600_000);
    const onInterrupt=()=>{finish();reject(new Error("Whop OAuth cancelled"));};
    const finish=()=>{clearTimeout(timeout);process.removeListener("SIGINT",onInterrupt);server.close();};
    process.once("SIGINT",onInterrupt);
    server.on("error",()=>{finish();reject(new Error("Whop callback listener could not start"));});
    server.listen(port,"127.0.0.1",()=>console.log(`Open this Whop consent URL in your browser:\n${session.authorizationUrl}\nWaiting for the registered local callback; press Ctrl-C to cancel.`));
  });
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "Whop OAuth setup failed");process.exitCode=1;});
