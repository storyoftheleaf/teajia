# Launch 1 worker messages, as sent

The messages from [../guests-and-tea-masters-launch-1-run.md](../guests-and-tea-masters-launch-1-run.md), with the names S1 settled on `build/launch-1`. Each file is sent as written to one worker through Codex on Adrian's Mac (`codex exec -C <worktree> -m <model> -s workspace-write -o last.md - < prompt.md`). Opus reads `last.md` and the diff, runs the acceptance check itself, then pushes and opens the pull request into `build/launch-1`.

| File | Slice | Model |
|---|---|---|
| s3-thanks.md | The thank-you page | gpt-6.2-sol |
| s4-reading.md | A session carries one reading | gpt-6.2-sol |
| s5-keep.md | Keep this tea | gpt-6.2-sol |
| s7-chest.md | Where a chest tea came from, and "taste this" | gpt-6.2-sol |
| s6-bought.md | A bought tea arrives in the chest | 6.2 Astra (after S5 merges) |
| s9-audit.md | Audit, findings only | 6.2 Astra (after S3, S5, S8) |
