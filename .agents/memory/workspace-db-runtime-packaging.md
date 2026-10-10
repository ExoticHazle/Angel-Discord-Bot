---
name: Workspace DB runtime packaging
description: Runtime packaging constraint for workspace libraries consumed by compiled Node services.
---

Workspace libraries consumed by compiled Node services must expose compiled JavaScript through their default package export while keeping TypeScript source available through the types condition.

**Why:** Node executes the bot’s compiled output and cannot load a workspace package that exports TypeScript source or points to a source `.js` path that does not exist.

**How to apply:** Keep the DB package’s declaration and JavaScript outputs in `dist`, define conditional `types`/`default` exports, and include the DB package in the service’s workspace dependencies.