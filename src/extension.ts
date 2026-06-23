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
async function makeGroupActive(group: vscode.TabGroup): Promise<void> {
  const input = group.activeTab?.input;
  const col = group.viewColumn;

  if (input instanceof vscode.TabInputText) {
    await vscode.window.showTextDocument(input.uri, { viewColumn: col, preserveFocus: false });
    return;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    await vscode.commands.executeCommand('vscode.diff', input.original, input.modified, undefined, { viewColumn: col });
    return;
  }
  if (input instanceof vscode.TabInputNotebook) {
    await vscode.commands.executeCommand('vscode.openWith', input.uri, input.notebookType, { viewColumn: col });
    return;
  }
  if (input instanceof vscode.TabInputCustom) {
    await vscode.commands.executeCommand('vscode.openWith', input.uri, input.viewType, { viewColumn: col });
    return;
  }
  throw new Error('unsupported tab type');
}

async function lockAllGroups(out: vscode.OutputChannel): Promise<number> {
  const groups = vscode.window.tabGroups.all;
  out.clear();

  let locked = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    let focused = false;

    try {
      await makeGroupActive(group);
      focused = true;
    } catch {
      // Fallback 1: named index commands (positions 0–7, non-empty groups)
      if (i < FOCUS_CMDS.length) {
        try {
          await vscode.commands.executeCommand(FOCUS_CMDS[i]);
          focused = true;
        } catch { /* silent */ }
      }
      // Fallback 2: viewColumn-based — covers empty groups and positions ≥ 8
      if (!focused) {
        try {
          await vscode.commands.executeCommand('workbench.action.focusEditorGroup', { viewColumn: group.viewColumn });
          focused = true;
        } catch { /* silent */ }
      }
      if (!focused) {
        out.appendLine(`[${i}] could not focus group at col ${group.viewColumn.toString()}`);
      }
    }

    if (!focused) continue;

    try {
      await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
      locked++;
    } catch (e) {
      out.appendLine(`[${i}] lock failed: ${String(e)}`);
    }
  }

  if (locked < groups.length) {
    out.appendLine(`locked ${locked} of ${groups.length} — see above for skipped groups`);
    out.show(true);
  }

  return locked;
}

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel('Lock All Groups');
  context.subscriptions.push(
    out,
    vscode.commands.registerCommand('lockAllGroups.lockAll', () => lockAllGroups(out)),
  );
}

export function deactivate(): void {}
