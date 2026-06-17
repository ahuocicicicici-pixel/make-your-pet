import { addTasksFromText, completeTaskFromText } from "./tasks.js";
import { runDelivery } from "./deliver.js";
import { runHeartbeat } from "./heartbeat.js";
import { getXunjiTrainsForLlm } from "./xunji.js";

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

if (command === "add") {
  const created = await addTasksFromText({
    text: required(args.text, "--text"),
    creator: args.creator || "mark",
    now: args.now,
    workspace: args.workspace
  });
  console.log(JSON.stringify(created, null, 2));
} else if (command === "complete") {
  const result = await completeTaskFromText({
    text: required(args.text, "--text"),
    workspace: args.workspace
  });
  console.log(JSON.stringify(result.completed || { error: "TASK_NOT_FOUND" }, null, 2));
} else if (command === "heartbeat") {
  const result = await runHeartbeat({ now: args.now, workspace: args.workspace });
  console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
} else if (command === "deliver") {
  const result = await runDelivery({
    now: args.now,
    workspace: args.workspace,
    dryRun: args["dry-run"] === "true" || args["dry-run"] === "1",
    openclawBin: args.openclawBin,
    openclawArgsPrefix: args.openclawArgsPrefix ? args.openclawArgsPrefix.split(",") : [],
    account: args.account
  });
  console.log(JSON.stringify(result, null, 2));
} else if (command === "trains") {
  const result = await getXunjiTrainsForLlm({
    datestr: required(args.datestr, "--datestr"),
    owner: args.owner || "mark",
    workspace: args.workspace,
    apiKey: args.apiKey,
    forceRefresh: args.refresh === "true" || args.refresh === "1"
  });
  console.log(JSON.stringify(result, null, 2));
} else {
  console.error("Usage: node src/cli.js <add|complete|heartbeat|deliver|trains> [--text ...] [--creator mark] [--now ISO] [--workspace path]");
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    parsed[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function required(value, flag) {
  if (!value) throw new Error(`Missing ${flag}`);
  return value;
}
