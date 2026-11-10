# the-a-company

The A Company's visa answers and applications, as commands. Every answer is the one on its page at [theacompany.ai](https://theacompany.ai), verified, with its quote and source.

JSON in, JSON out. Runs in your terminal, in Claude Code, in Codex, in any agent with a shell.

```bash
npx the-a-company tour
```

## Every command

| Command | Does |
|---|---|
| `tour` | every command, its name and description |
| `visa list [path]` | every visa we cover, by destination, type, subtype and the country applied from, each live or coming |
| `visa get <path>` | one visa page in full |
| `visa screening <path>` | which visa fits: the questions, then with the answers the visa and its path |
| `visa eligibility <path>` | whether the user can apply: the questions, then with the answers the verdict |
| `visa steps <path>` | the steps in order, verified, with their quote and source |
| `visa price <path>` | the government fee and our price, and the link to pay |
| `visa wait <path>` | today's wait for an interview appointment |
| `visa documents <path>` | the documents, required, optional or conditional |
| `visa photo <path>` | the photo rules |
| `visa validity <path>` | how long the visa is valid, and its entries |
| `visa sources <path>` | every official page the path quotes |
| `visa apply <path>` | The A Company completes the application from the user's answers, and asks the user before submitting it |
| `visa application get <id>` | an application and its status |
| `visa application delete <id>` | deletes an application and everything in it |
| `visa chat` | one question in any language, answered with citations |

A path is the page's address after `/visa/`: `usa/b1-b2/kosovo` is [theacompany.ai/visa/usa/b1-b2/kosovo](https://theacompany.ai/visa/usa/b1-b2/kosovo).

## Examples

```bash
npx the-a-company visa list usa/j-1
npx the-a-company visa price usa/b1-b2/kosovo
npx the-a-company visa steps usa/j-1/work-and-travel/kosovo --lang sq
echo '{"answers": {"visa": "B1/B2", "residence": "Kosovo"}}' | npx the-a-company visa screening usa
echo '{"text": "Sa kushton viza B1/B2?"}' | npx the-a-company visa chat
```

## Understand a command

```bash
npx the-a-company <command> --schema    # its full input, output and an example
npx the-a-company <command> --dry-run   # what it would send, without sending it
```

## The rules

- Input as flags, or one JSON object on stdin. The result on stdout; an error on stderr as `{"error": {"code", "message"}}`.
- Exit codes: `0` success, `1` error, `2` rate limited.
- `visa application delete` needs `--confirm`.
- `visa apply` takes `--idempotency-key`, so a retry never makes a second application. Keep the `key` it returns: it is the only way back into the application.
- Daily limits per caller: `visa chat` 20 questions, `visa apply` 5 applications.
- A path that is not built yet answers `{"status": "coming", "nearest": "..."}`.

## Not a terminal?

The same commands are an API at `https://api.theacompany.ai` and an MCP server at `https://theacompany.ai/mcp`, for Claude, ChatGPT and any agent that speaks MCP. Docs: [theacompany.ai/developers](https://theacompany.ai/developers).

The A Company is not the U.S. government and does not decide visas.

MIT · The-A-Company Global, Inc.
