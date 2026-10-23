# Guide: Adding a Tool Adapter to DualSurf Red Team Terminal

DualSurf uses an extensible, declarative adapter registry that enables adding new open-source security tools in minutes while preserving the Zero-Fabrication guarantee.

---

## Step 1: Register Tool Metadata in `REGISTERED_RED_TEAM_TOOLS`

Open `apps/cli/src/tools/executionEngine.ts` and add a new entry to `REGISTERED_RED_TEAM_TOOLS`:

```typescript
{
  id: 'mytool',                     // Unique identifier (lowercase)
  name: 'MyTool Scanner',          // Human-readable tool title
  category: 'Web Security',        // Tool Center category
  binaryName: 'mytool',            // Primary binary executable on host
  aliases: ['mytool-cli', 'mytool.exe'], // Known alternative binary names
  versionFlag: '--version',        // Flag used to retrieve installed version
  supportedOs: ['win32', 'linux', 'darwin'], // Supported operating systems
  requiredPrivilege: 'user',       // 'user' | 'admin' | 'root'
  documentationUrl: 'https://github.com/example/mytool', // Official docs URL
  adapterImplemented: true,        // Set to true once adapter is added
}
```

---

## Step 2: Implement Execution Logic in `redTeam.ts`

If the tool requires specific argument formatting, add a dedicated handler branch in `executeRedTeamTool()` in `apps/cli/src/tools/redTeam.ts`:

```typescript
if (rawCmd === 'mytool') {
  const hostCheck = checkToolAvailable('mytool');
  if (hostCheck.available) {
    // 1. Build structured arguments safely
    const args = ['--target', effectiveTarget, '--json'];
    
    // 2. Execute process via controlled process runner
    const res = await runControlledProcess('mytool', args, {
      timeoutMs: 60000,
      scopeId: activeScopeId,
      target: effectiveTarget,
    });
    
    return {
      tool: 'MYTOOL',
      pillarId: 3,
      pillarTitle: 'Web Application & API Security',
      isHostNative: true,
      commandExecuted: `mytool ${args.join(' ')}`,
      output: res.stdout || res.stderr,
      status: res.exitCode === 0 ? 'SUCCESS' : 'PARTIAL',
      durationMs: Date.now() - start,
    };
  }

  // 3. Truthful NOT_INSTALLED fallback (Zero-Fabrication Contract)
  return handleUninstalledRedTool('mytool', effectiveTarget, 3, 'Web Application & API Security', start);
}
```

---

## Step 3: Register Direct CLI Dispatcher in `apps/cli/src/index.ts`

Add your tool to the direct execution switch statement in `apps/cli/src/index.ts`:

```typescript
case 'mytool': {
  const target = rest[0] || '127.0.0.1';
  const { executeRedTeamTool } = await import('./tools/redTeam.js');
  const result = await executeRedTeamTool('mytool', target, rest.slice(1));
  console.log(result.output);
  break;
}
```

---

## Step 4: Register Command in Desktop GUI

1. Add `'mytool'` to `DUALSURF_DIRECT_COMMANDS` in `apps/desktop/electron/main.ts`.
2. Add a `CommandDefinition` to `apps/desktop/src/components/terminal/command-registry.ts` with syntax and examples.

---

## Step 5: Add Unit & Integration Tests

Add a test case in `tests/unit/redTeamScope.test.js` validating:
1. Tool detection (`detectHostRedTeamTools()`).
2. Argument safety and scope enforcement.
3. Truthful `NOT_INSTALLED` behavior when the binary is absent.
