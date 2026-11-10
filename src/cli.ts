#!/usr/bin/env node
// the-a-company: The A Company's visa answers and applications, from your terminal or your agent.
// A thin client: every command, its description and its contract come from the API (GET /api/tour), so a new
// command on the server works here with no new release. JSON in (flags, or JSON on stdin), JSON out (stdout),
// errors as JSON on stderr. Exit codes: 0 success, 1 error, 2 rate limited.

type Row = { name: string; description: string; method: "GET" | "POST" | "DELETE"; endpoint: string };
type Flags = Record<string, string | true>;

const API = (process.env.THE_A_COMPANY_API ?? "https://api.theacompany.ai").replace(/\/+$/, "");
const VERSION = "1.0.0";

const out = (v: unknown) => process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
function fail(code: string, message: string, exit = 1): never {
  process.stderr.write(`${JSON.stringify({ error: { code, message } }, null, 2)}\n`);
  process.exit(exit);
}

function parse(argv: string[]) {
  const words: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s, 2);
      const next = argv[i + 1];
      if (v !== undefined) flags[k] = v;
      else if (["lang", "format", "key", "idempotency-key", "api"].includes(k) && next !== undefined) flags[k] = argv[++i];
      else flags[k] = true;
    } else words.push(a);
  }
  return { words, flags };
}

async function api(path: string, init: RequestInit = {}, base = API) {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { accept: "application/json", "user-agent": `the-a-company-cli/${VERSION}`, ...(init.headers ?? {}) },
    });
  } catch (e) {
    fail("UNAVAILABLE", `Could not reach ${base}: ${(e as Error).message}`);
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    fail("UNAVAILABLE", `${base}${path} did not answer with JSON (HTTP ${res.status}).`);
  }
  return { status: res.status, body: body as Record<string, any> };
}

/** JSON piped in, when there is any: {"answers": {...}} or {"text": "..."}. */
async function stdin(): Promise<Record<string, unknown>> {
  if (process.stdin.isTTY) return {};
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {}
  fail("INVALID_INPUT", "stdin must be one JSON object, for example {\"answers\": {...}}.");
}

const help = (rows: Row[]) => ({
  usage: "the-a-company <command> [path or id] [--lang sq] [--schema] [--dry-run]",
  input: "flags, or one JSON object on stdin: {\"answers\": {...}} or {\"text\": \"...\"}",
  api: API,
  commands: rows.map(({ name, description }) => ({ name, description })),
});

async function main() {
  const { words, flags } = parse(process.argv.slice(2));
  const base = typeof flags.api === "string" ? flags.api.replace(/\/+$/, "") : API;
  if (flags.version) return out({ version: VERSION, api: base });

  const tour = await api("/api/tour", {}, base);
  if (tour.status !== 200) fail("UNAVAILABLE", `The tour did not load (HTTP ${tour.status}).`);
  const rows = tour.body.commands as Row[];
  if (!words.length || flags.help) return out(help(rows));

  // The longest command the words begin with: "visa application get" before "visa".
  const said = words.join(" ");
  const cmd = [...rows].sort((a, b) => b.name.length - a.name.length).find((r) => said === r.name || said.startsWith(`${r.name} `));
  if (!cmd) fail("NOT_FOUND", `No command "${said}". Run the-a-company tour.`);
  const rest = words.slice(cmd.name.split(" ").length);

  if (flags.schema) {
    const s = await api(`/api/tour?command=${encodeURIComponent(cmd.name)}`, {}, base);
    return s.status === 200 ? out(s.body) : fail("NOT_FOUND", `No schema for ${cmd.name}.`);
  }
  if (cmd.name === "tour") return out(tour.body);

  const piped = await stdin();
  const arg = rest[0];
  const needsId = cmd.endpoint.includes("<id>");
  const needsPath = cmd.endpoint.includes("<path>");
  if (needsId && !arg) fail("INVALID_INPUT", `${cmd.name} needs the application id.`);
  const key = (flags.key as string | undefined) ?? (piped.key as string | undefined);
  if (needsId && !key) fail("INVALID_INPUT", `${cmd.name} needs --key, as visa apply returned it.`);
  if (cmd.method === "DELETE" && !flags.confirm) fail("INVALID_INPUT", `${cmd.name} deletes for good. Add --confirm.`);

  // The endpoint with its path or id filled, and the query and body it takes.
  const path = (arg ?? "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/?visa\/?/, "").replace(/^\/+|\/+$/g, "");
  let url = cmd.endpoint.replace("<id>", encodeURIComponent(arg ?? ""));
  url = needsPath ? (path ? url.replace("<path>", path) : url.replace("/<path>", "")) : url;
  const query = new URLSearchParams();
  if (flags.lang) query.set("lang", String(flags.lang));
  if (flags.format) query.set("format", String(flags.format));
  if (query.size) url += `?${query}`;
  const headers: Record<string, string> = {};
  if (key) headers["x-application-key"] = key;
  if (typeof flags["idempotency-key"] === "string") headers["idempotency-key"] = flags["idempotency-key"];
  const body =
    cmd.method === "POST"
      ? JSON.stringify({ ...piped, ...(flags.lang ? { lang: flags.lang } : {}) })
      : undefined;
  if (body) headers["content-type"] = "application/json";

  if (flags["dry-run"]) {
    return out({ dry_run: true, command: cmd.name, method: cmd.method, url: `${base}${url}`, ...(body ? { body: JSON.parse(body) } : {}) });
  }
  const r = await api(url, { method: cmd.method, headers, body }, base);
  if (r.status >= 400 || r.body?.error) {
    const e = r.body?.error ?? {};
    fail(e.code ?? "ERROR", e.message ?? `HTTP ${r.status}`, r.status === 429 ? 2 : 1);
  }
  out(r.body);
}

main().catch((e) => fail("ERROR", (e as Error).message));
