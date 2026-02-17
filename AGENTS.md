# Project Agent Rules

## Execution Workflow

- Always execute implementation tasks with multiple subagents in parallel when tasks can be split.
- Use `PLAN.md` as the source of truth for implementation sequencing.
- Prioritize PLAN backlog progress before opportunistic polish changes.

## Delivery Discipline

- Keep commits atomic and use conventional commit messages.
- Group each commit around one clear intent (tuning, feature slice, UI slice, etc.).
- Verify with diagnostics and build before each commit.

## Survivor Direction

- Preserve Vampire Survivors pacing: spiders must be slower than player and slower than mosquito swarmers.
- Keep survivor UI functional at all times (HP, XP, ammo, perk cards, debug panel).
