
            (Commit history)
         ┌─────────────────────┐
         │     main branch     │
         │ A --- B --- C       │
         └─────────────────────┘
                   │
                   │
         ┌─────────────────────┐
         │ feature branch      │
         │ A --- B --- C --- D │
         └─────────────────────┘
                   │
                   ↓
        (YOU ARE HERE POINTER)
              feature/edit

──────────────────────────────────

        🟡 WORKING DIRECTORY (YOUR FILES)

        .gitignore  ← modified ❗
        app.js
        etc...


1. Branch = history pointer = main, feature/edit-transaction

They only store committed snapshots

2. Working Directory = real files on your disk
this is where you are editing right now

👉  .gitignore changes live HERE first

3. Staging area = “ready to commit”
git add .gitignore

4. Commit = saved snapshot into branch
git commit

Now ONLY it becomes part of: main OR feature branch

## You switched branches WITHOUT committing
→ Git carried your edited file with us. So it appears everywhere, but actually it is just ONE local change floating in your workspace

```
---
** Branch stores history
** Working directory stores current edits
** Git moves edits with you until you commit or stash
---
```