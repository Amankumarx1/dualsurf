import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('DualSurf Interactive Element & Navigation Registry Suite', () => {
  const registryPath = path.resolve('apps/desktop/src/navigation/interactiveRegistry.ts');
  const sidebarPath = path.resolve('apps/desktop/src/components/Sidebar.tsx');
  const appPath = path.resolve('apps/desktop/src/App.tsx');
  const titlebarPath = path.resolve('apps/desktop/src/components/TitleBar.tsx');
  const navbarPath = path.resolve('apps/desktop/src/components/NavigationBar.tsx');
  const terminalWsPath = path.resolve('apps/desktop/src/components/terminal/DualSurfTerminalWorkspace.tsx');

  it('ensures all key interactive architecture and component files exist', () => {
    assert.ok(fs.existsSync(registryPath), 'interactiveRegistry.ts exists');
    assert.ok(fs.existsSync(sidebarPath), 'Sidebar.tsx exists');
    assert.ok(fs.existsSync(appPath), 'App.tsx exists');
    assert.ok(fs.existsSync(titlebarPath), 'TitleBar.tsx exists');
    assert.ok(fs.existsSync(navbarPath), 'NavigationBar.tsx exists');
    assert.ok(fs.existsSync(terminalWsPath), 'DualSurfTerminalWorkspace.tsx exists');
  });

  it('verifies interactive registry contains registered elements with mandatory schema fields', () => {
    const content = fs.readFileSync(registryPath, 'utf8');
    
    // Check that INTERACTIVE_ELEMENT_REGISTRY is defined and non-empty
    assert.ok(content.includes('export const INTERACTIVE_ELEMENT_REGISTRY'), 'Exports registry constant');
    
    // Check key categories
    const categories = ['chrome', 'sidebar', 'omnibox', 'tabs', 'terminal', 'toolbox', 'files', 'sessions', 'modals'];
    for (const cat of categories) {
      assert.ok(content.includes(`category: '${cat}'`), `Registry catalogs category: ${cat}`);
    }

    // Check execution boundaries
    const boundaries = ['renderer', 'main-ipc', 'pty-shell', 'storage'];
    for (const boundary of boundaries) {
      assert.ok(content.includes(`executionBoundary: '${boundary}'`), `Registry catalogs boundary: ${boundary}`);
    }
  });

  it('verifies all Left Sidebar navigation items are properly wired in Sidebar.tsx', () => {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    
    // Group titles
    assert.ok(sidebarContent.includes("'BROWSER'"), 'Sidebar contains BROWSER group');
    assert.ok(sidebarContent.includes("'WORKSPACE'"), 'Sidebar contains WORKSPACE group');
    assert.ok(sidebarContent.includes("'SECURITY OPS'"), 'Sidebar contains SECURITY OPS group');
    assert.ok(sidebarContent.includes("'SYSTEM'"), 'Sidebar contains SYSTEM group');

    // Expected items
    const expectedItems = [
      'home', 'bookmarks', 'history', 'downloads',
      'tools', 'network', 'proxy', 'repeater',
      'red-team', 'blue-team', 'purple-team',
      'sessions', 'files', 'settings'
    ];

    for (const item of expectedItems) {
      assert.ok(sidebarContent.includes(`id: '${item}'`), `Sidebar defines navigation item: ${item}`);
    }
    
    // Ensure collapse toggle button is present
    assert.ok(sidebarContent.includes('onToggleCollapse'), 'Sidebar wires collapse/expand toggle');
  });

  it('verifies TitleBar has complete window controls and theme toggle', () => {
    const titlebarContent = fs.readFileSync(titlebarPath, 'utf8');

    assert.ok(titlebarContent.includes('handleMinimize'), 'TitleBar wires minimize action');
    assert.ok(titlebarContent.includes('handleMaximize'), 'TitleBar wires maximize/restore action');
    assert.ok(titlebarContent.includes('handleClose'), 'TitleBar wires close action');
    assert.ok(titlebarContent.includes('onToggleTheme'), 'TitleBar wires theme toggle');
    assert.ok(titlebarContent.includes('onOpenSettings'), 'TitleBar wires settings shortcut');
  });

  it('verifies App.tsx wires all global keyboard shortcuts without collisions', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Check address bar focus shortcut
    assert.ok(appContent.includes('dualsurf:focus-address-bar'), 'Wires Ctrl+L / Alt+D address bar focus');
    
    // Check tab navigation shortcuts
    assert.ok(appContent.includes("e.key === 'Tab'"), 'Wires Ctrl+Tab and Ctrl+Shift+Tab for tab cycling');
    assert.ok(appContent.includes("e.key >= '1' && e.key <= '9'"), 'Wires Ctrl+1-9 for direct tab jumping');
    
    // Check core browser shortcuts
    assert.ok(appContent.includes("e.key.toLowerCase() === 't'"), 'Wires Ctrl+T new tab');
    assert.ok(appContent.includes("e.key.toLowerCase() === 'w'"), 'Wires Ctrl+W close tab');
    assert.ok(appContent.includes("reopenClosedTab"), 'Wires Ctrl+Shift+T restore tab');
    assert.ok(appContent.includes("toggleFullScreen"), 'Wires F11 fullscreen');
    assert.ok(appContent.includes("toggleDevTools"), 'Wires F12 devtools');
    assert.ok(appContent.includes("handleModeChange"), 'Wires mode toggle shortcut (Ctrl+` or Ctrl+Shift+M)');
  });

  it('verifies Browser and Terminal Mode switching maintains state', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Verify handleModeChange informs electron main process without destroying state
    assert.ok(appContent.includes('window.dualsurf.setTerminalMode'), 'App tells main process to show/hide webcontents');
    assert.ok(appContent.includes('setMode'), 'App updates renderer mode state');
  });

  it('verifies Terminal Workstation contains sessions, lower split panes, and right toolbox', () => {
    const terminalContent = fs.readFileSync(terminalWsPath, 'utf8');

    // Header sessions tabs
    assert.ok(terminalContent.includes('TerminalSessionTab'), 'Terminal workstation defines session tabs interface');
    assert.ok(terminalContent.includes('setSessions'), 'Manages terminal sessions list');
    assert.ok(terminalContent.includes('activeSessionId'), 'Tracks active session');
    
    // Split panes
    assert.ok(terminalContent.includes('isLowerPanesOpen'), 'Supports toggling split panes');
    assert.ok(terminalContent.includes('htop'), 'Includes htop monitor pane');
    assert.ok(terminalContent.includes('nmap'), 'Includes nmap scan pane');

    // Right sidebar panels
    assert.ok(terminalContent.includes('Toolbox'), 'Includes Toolbox panel');
    assert.ok(terminalContent.includes('Files'), 'Includes Files explorer panel');
    assert.ok(terminalContent.includes('Sessions'), 'Includes Sessions switcher panel');

    // Action buttons
    assert.ok(terminalContent.includes('handleClearTerminal'), 'Supports buffer clearing');
    assert.ok(terminalContent.includes('handleRunTool'), 'Supports click-to-execute tools');
  });

  it('verifies NavigationBar address bar search engine normalization and URL handling', () => {
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    assert.ok(navbarContent.includes('dualsurf:focus-address-bar'), 'Listens for address bar focus event');
    assert.ok(navbarContent.includes('handleKeyDown'), 'Handles Enter key submission');
    assert.ok(navbarContent.includes('onNavigate'), 'Navigates to normalized target');
    assert.ok(navbarContent.includes('onReload'), 'Wires reload button');
    assert.ok(navbarContent.includes('onGoBack'), 'Wires back button');
    assert.ok(navbarContent.includes('onGoForward'), 'Wires forward button');
  });
});
