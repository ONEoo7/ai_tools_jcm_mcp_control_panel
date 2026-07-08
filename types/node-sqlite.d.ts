// Minimal typings for Node's built-in SQLite (node:sqlite), which @types/node@20
// doesn't yet ship. Runtime support is present on Node 22.5+/24. Only the surface
// used by lib/jcm/indexVersion.ts is declared.
declare module "node:sqlite" {
  interface StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(
      path: string,
      options?: { readOnly?: boolean; open?: boolean; enableForeignKeyConstraints?: boolean },
    );
    prepare(sql: string): StatementSync;
    close(): void;
    exec(sql: string): void;
  }
}
