/** Starter template for a project-level .jcodemunch.jsonc. */
export function projectConfigTemplate(projectName: string): string {
  return `{
  // jcodemunch-mcp project configuration for "${projectName}"
  // Docs: run \`jcodemunch-mcp config\` to see effective values.

  // ---- Indexing ----
  // Extra glob patterns to ignore when indexing (added to defaults).
  "extra_ignore_patterns": [
    // "**/generated/**",
    // "**/*.min.js"
  ],
  // Extra file extensions to index beyond the built-in language set.
  "extra_extensions": [],

  // ---- Architecture layers ----
  // Enforce dependency direction with get_layer_violations. Define layers by
  // path and which layers they may NOT import.
  "architecture": {
    "layers": [
      // { "name": "api", "paths": ["app/api/**"], "may_not_import": ["db"] },
      // { "name": "db",  "paths": ["lib/db/**"],  "may_not_import": [] }
    ]
  },

  // ---- Tools ----
  // Hide specific tools from this project's exposed MCP tool list.
  "disabled_tools": []
}
`;
}
