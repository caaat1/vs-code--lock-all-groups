# Lock All Editor Groups

Lock your entire editor layout with a single command — prevents files from opening in the wrong group when you have a carefully arranged workspace.

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run one of:

| Command | What it does |
|---|---|
| **Lock All Editor Groups** | Locks every group, including empty ones |
| **Lock Occupied Editor Groups** | Locks only groups that currently have tabs |

To unlock, right-click any group's tab bar and choose **Unlock Group**, or use the built-in **Unlock Editor Group** command.

## Notes

- Works correctly with grid (non-linear) layouts — groups are targeted by their exact position, not by column index
- Supports text editors, diff editors, notebooks, and custom editors
- Already-locked groups are safe to include; locking is idempotent
- If any group could not be locked, the **Lock All Groups** output channel opens automatically with details

## Requirements

VS Code 1.72 or later.
