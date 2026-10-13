import { doctor } from "./profile/doctor.js";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--profile") { console.error("Use --profile <absolute profile.json>"); process.exitCode = 2; }
else { const result = doctor(args[1]); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.exitCode; }
