# AGENTS.md instructions for C:\code\ddxu2-tool

## Git workflow override (user preference)

1. 預設流程：完成變更後只做本地 git（`add` + `commit`），不要自動 push。
2. 只有在使用者明確要求「push / 推到雲端 / push 到 origin」時，才執行 `git push`。
3. 如果使用者只說 `git` 或 `/git`，視為只做本地提交，不含 push。
4. push 被拒時，只有在使用者已要求 push 的前提下，才執行 `git pull --rebase` 後再 push。
5. 不要把不相關的 untracked files 加入 commit，除非使用者明確要求。
