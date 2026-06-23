# Lock All Editor Groups

Locks all open editor groups in VS Code with a single command — useful for freezing a carefully arranged layout and preventing files from opening in the wrong group.

## Usage

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

**Lock All Editor Groups**

Every group in your current layout is locked. Subsequent file opens will go to a new group rather than replacing tabs in your locked arrangement.

To unlock, right-click any group's tab bar and choose **Unlock Group**, or use the built-in **Unlock Editor Group** command.

## Notes

- Works correctly with grid (non-linear) layouts — groups are targeted by their exact position, not by column index
- Supports text editors, diff editors, notebooks, and custom editors
- Already-locked groups are safe to include; locking is idempotent
- If any group could not be locked, the **Lock All Groups** output channel opens automatically with details

## Requirements

VS Code 1.72 or later.
