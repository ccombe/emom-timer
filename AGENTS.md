# Agent Notes

## Fallow MCP Server

The `fallow-mcp` MCP server is configured in `~/.config/opencode/opencode.json` and provides codebase intelligence tools:

| Tool | Purpose |
|------|---------|
| `fallow_analyze` | Full dead code analysis |
| `fallow_check_changed` | Incremental analysis of changed files |
| `fallow_find_dupes` | Code duplication detection |
| `fallow_fix_preview` | Preview auto-fixes |
| `fallow_fix_apply` | Apply auto-fixes |
| `fallow_check_health` | Complexity metrics and hotspots |
| `fallow_audit` | Combined dead-code + complexity + duplication for changed files |
| `fallow_project_info` | Project structure and entry points |

When asked to analyze code health, find dead code, check duplicates, or audit complexity, use the `fallow_*` tools instead of running CLI commands directly.

### Key Configuration
- Config file: `.fallowrc.json`
- Snapshot dir: `.fallow/snapshots/` (created by `fallow --save-snapshot`)
- Regression baseline: `.fallow/regression-baseline.json`

### Useful Patterns
- `fallow audit --changed-since main` — check PR impact
- `fallow --production` — exclude tests, find real dead code
- `fallow fix --dry-run` — preview removals before applying
