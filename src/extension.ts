import * as vscode from "vscode";

// Activates a group by its viewColumn — the only focus strategy that correctly
// targets stacked groups in a grid layout.
async function makeGroupActive(group: vscode.TabGroup): Promise<void> {
  const input = group.activeTab?.input;
  const col = group.viewColumn;

  if (input instanceof vscode.TabInputText) {
    await vscode.window.showTextDocument(input.uri, {
      viewColumn: col,
      preserveFocus: false,
    });
    return;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    await vscode.commands.executeCommand(
      "vscode.diff",
      input.original,
      input.modified,
      undefined,
      { viewColumn: col },
    );
    return;
  }
  if (input instanceof vscode.TabInputNotebook) {
    await vscode.commands.executeCommand("vscode.openWith", input.uri, input.notebookType, {
      viewColumn: col,
    });
    return;
  }
  if (input instanceof vscode.TabInputCustom) {
    await vscode.commands.executeCommand("vscode.openWith", input.uri, input.viewType, {
      viewColumn: col,
    });
    return;
  }
  throw new Error("unsupported tab type");
}

async function lockGroups(
  groups: readonly vscode.TabGroup[],
  out: vscode.OutputChannel,
): Promise<number> {
  out.clear();

  const originalGroup = vscode.window.tabGroups.activeTabGroup;
  const allGroups = vscode.window.tabGroups.all; // snapshot — tabGroups.all is live

  let locked = 0;
  let lastFullIndex = -1;

  for (const [i, group] of groups.entries()) {
    const fullIndex = allGroups.indexOf(group); // position in full list, not filtered
    let focused = false;

    try {
      await makeGroupActive(group);
      focused = true;
    } catch (e) {
      out.appendLine(`[${i}] col ${group.viewColumn}: ${String(e)}`);

      // Fallback 1: viewColumn-based
      try {
        await vscode.commands.executeCommand("workbench.action.focusEditorGroup", {
          viewColumn: group.viewColumn,
        });
        focused = true;
      } catch {
        /* ignore */
      }

      // Fallback 2: step forward from last known position (O(1) when the
      // previous full-list group was just processed) or cycle from group 0.
      if (!focused && fullIndex >= 0) {
        try {
          if (fullIndex > 0 && lastFullIndex === fullIndex - 1) {
            await vscode.commands.executeCommand("workbench.action.focusNextGroup");
          } else {
            await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
            for (let step = 0; step < fullIndex; step++) {
              await vscode.commands.executeCommand("workbench.action.focusNextGroup");
            }
          }
          focused = true;
        } catch (e2) {
          out.appendLine(`[${i}] all focus strategies failed: ${String(e2)}`);
        }
      }
    }

    if (!focused) continue;

    try {
      await vscode.commands.executeCommand("workbench.action.lockEditorGroup");
      locked++;
    } catch (e) {
      out.appendLine(`[${i}] lock failed: ${String(e)}`);
    }

    lastFullIndex = fullIndex;
  }

  if (locked < groups.length) {
    out.appendLine(`locked ${locked} of ${groups.length} — see above for skipped groups`);
    out.show(true);
  }

  try { await makeGroupActive(originalGroup); } catch { /* ignore */ }

  return locked;
}

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel("Lock All Groups");
  context.subscriptions.push(
    out,
    vscode.commands.registerCommand("lockAllGroups.lockAll", () =>
      lockGroups(vscode.window.tabGroups.all, out),
    ),
    vscode.commands.registerCommand("lockAllGroups.lockOccupied", () =>
      lockGroups(
        vscode.window.tabGroups.all.filter((g) => g.tabs.length > 0),
        out,
      ),
    ),
  );
}

export function deactivate(): void {}
