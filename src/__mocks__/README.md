[<<< Back](../README.md)

# Test mocks

This folder contains a code to imitate some libraries behaviour (for example, Tauri) in the `bun test` environment. The mocks are registered with `mock.module()` in [`bun.setup.ts`](../../bun.setup.ts), which `bun run test` preloads.

See https://bun.sh/docs/test/mocks#module-mocks-with-mock-module for more.
