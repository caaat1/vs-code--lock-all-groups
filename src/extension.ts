import * as vscode from 'vscode';

// Named focus commands keyed by position in tabGroups.all (0-based). Limited
// to 8 and navigate by grid column, so used only as a fallback.
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

  // Snapshot once so indexOf is consistent across the loop even if the live
  // tabGroups.all reference updates mid-run.
  const allGroups = vscode.window.tabGroups.all;

  let locked = 0;
  let lastFullIndex = -1;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    // fullIndex is the position in the complete group list, which is what the
    // focus commands and cycling logic need — i is just the position in the
    // (possibly filtered) groups parameter.
    const fullIndex = allGroups.indexOf(group);
    let focused = false;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      cleanup = await makeGroupActive(group);
      focused = true;
    } catch (e) {
      out.appendLine(`[${i}] col ${group.viewColumn.toString()}: ${String(e)}`);

      // Fallback 1: named focus command by full position (positions 0–7)
      if (fullIndex >= 0 && fullIndex < FOCUS_CMDS.length) {
        try {
          await vscode.commands.executeCommand(FOCUS_CMDS[fullIndex]);
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
      // Fallback 3: step forward from last known position (O(1) when the
      // previous full-list group was just processed) or cycle from group 0.
      if (!focused && fullIndex >= 0) {
        try {
          if (fullIndex > 0 && lastFullIndex === fullIndex - 1) {
            await vscode.commands.executeCommand('workbench.action.focusNextGroup');
          } else {
            await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
            for (let step = 0; step < fullIndex; step++) {
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

    lastFullIndex = fullIndex;

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
