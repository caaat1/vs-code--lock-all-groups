import * as vscode from 'vscode';

// Column-index focus commands are a last resort: they navigate by column only
// and miss groups stacked vertically in the same grid column.
const FOCUS_CMDS = [
  'workbench.action.focusFirstEditorGroup',
  'workbench.action.focusSecondEditorGroup',
  'workbench.action.focusThirdEditorGroup',
  'workbench.action.focusFourthEditorGroup',
  'workbench.action.focusFifthEditorGroup',
  'workbench.action.focusSixthEditorGroup',
  'workbench.action.focusSeventhEditorGroup',
  'workbench.action.focusEighthEditorGroup',
];

// Make a group active using its viewColumn, which works correctly in grid
// layouts. Each branch uses the most direct API for the tab's content type.
// Returns a cleanup function when a temporary document was opened so the
// caller can close it after locking.
async function makeGroupActive(group: vscode.TabGroup): Promise<(() => Promise<void>) | undefined> {
  const input = group.activeTab?.input;
  const col = group.viewColumn;

  if (input instanceof vscode.TabInputText) {
    await vscode.window.showTextDocument(input.uri, { viewColumn: col, preserveFocus: false });
    return undefined;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    await vscode.commands.executeCommand('vscode.diff', input.original, input.modified, undefined, { viewColumn: col });
    return undefined;
  }
  if (input instanceof vscode.TabInputNotebook) {
    await vscode.commands.executeCommand('vscode.openWith', input.uri, input.notebookType, { viewColumn: col });
    return undefined;
  }
  if (input instanceof vscode.TabInputCustom) {
    await vscode.commands.executeCommand('vscode.openWith', input.uri, input.viewType, { viewColumn: col });
    return undefined;
  }

  // Empty group or unsupported tab type: open a throwaway untitled document
  // to activate the group, verify we landed in the right place, then return
  // a cleanup that closes it after locking.
  const doc = await vscode.workspace.openTextDocument({ content: '' });
  await vscode.window.showTextDocument(doc, { viewColumn: col, preserveFocus: false, preview: true });

  if (vscode.window.tabGroups.activeTabGroup.viewColumn !== col) {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    throw new Error(`showTextDocument landed on col ${vscode.window.tabGroups.activeTabGroup.viewColumn.toString()}, expected ${col.toString()}`);
  }

  return async (): Promise<void> => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  };
}

async function lockGroups(
  groups: readonly vscode.TabGroup[],
  out: vscode.OutputChannel,
): Promise<number> {
  out.clear();

  let locked = 0;
  let lastFocusedIndex = -1;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    let focused = false;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      cleanup = await makeGroupActive(group);
      focused = true;
    } catch (e) {
      out.appendLine(`[${i}] col ${group.viewColumn.toString()}: ${String(e)}`);

      // Fallback 1: named index commands (positions 0–7)
      if (i < FOCUS_CMDS.length) {
        try {
          await vscode.commands.executeCommand(FOCUS_CMDS[i]);
          focused = true;
        } catch { /* silent */ }
      }
      // Fallback 2: viewColumn-based
      if (!focused) {
        try {
          await vscode.commands.executeCommand('workbench.action.focusEditorGroup', { viewColumn: group.viewColumn });
          focused = true;
        } catch { /* silent */ }
      }
      // Fallback 3: step forward from the last known position (O(1) when the
      // previous group was just processed) or cycle from group 0 as a last resort.
      if (!focused) {
        try {
          if (lastFocusedIndex === i - 1) {
            await vscode.commands.executeCommand('workbench.action.focusNextGroup');
          } else {
            await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
            for (let step = 0; step < i; step++) {
              await vscode.commands.executeCommand('workbench.action.focusNextGroup');
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
      await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
      locked++;
    } catch (e) {
      out.appendLine(`[${i}] lock failed: ${String(e)}`);
    }

    lastFocusedIndex = i;

    if (cleanup !== undefined) {
      try { await cleanup(); } catch { /* ignore */ }
    }
  }

  if (locked < groups.length) {
    out.appendLine(`locked ${locked.toString()} of ${groups.length.toString()} — see above for skipped groups`);
    out.show(true);
  }

  return locked;
}

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel('Lock All Groups');
  context.subscriptions.push(
    out,
    vscode.commands.registerCommand('lockAllGroups.lockAll', () =>
      lockGroups(vscode.window.tabGroups.all, out),
    ),
    vscode.commands.registerCommand('lockAllGroups.lockOccupied', () =>
      lockGroups(vscode.window.tabGroups.all.filter(g => g.tabs.length > 0), out),
    ),
  );
}

export function deactivate(): void {}
