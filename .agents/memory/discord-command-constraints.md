---
name: Discord command constraints
description: Discord slash-command registration has ordering and permission limitations that affect future bot changes.
---

Discord requires every required slash-command option to appear before optional options, and permissions are applied at the root command level rather than on subcommands. Enforce admin-only subcommands inside their execute handlers when a command mixes member and admin actions.

**Why:** Discord rejects the full global command deployment when either rule is violated, even if TypeScript compilation succeeds.

**How to apply:** Before publishing commands, inspect generated command JSON and run the bot's deploy script after typechecking.