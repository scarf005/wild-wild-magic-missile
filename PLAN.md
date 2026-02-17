# Wild Wild Magic Missile

## Rewrite Goal

Completely rewrite the current game into a Vampire Survivors-style survival action game where the player controls a single hero, survives escalating waves, and snowballs into absurdly lethal chain reactions through perk combinations.

## Game Identity

- Genre: top-down horde survival auto-battler
- Tone: arcane western horror with insect swarms
- Session length target: 10-15 minutes per run
- Core fantasy: start fragile, become an unstoppable chain-destruction engine

## Core Loop (Run-Level)

1. Spawn as the Arcanist in a hostile biome.
2. Defeat enemies to gain Essence (XP) and occasional pickups.
3. Level up to draft perk cards.
4. Stack perks that trigger each other (burn -> explosion -> shrapnel flame -> chain ignite).
5. Survive timed difficulty spikes, elite waves, and boss insects.
6. Reach late-game where the build causes humongous deathly chain effects across dense swarms.
7. End run by timer completion or death, then convert progress into meta unlocks.

## Player: "Arcanist"

- Portrait reference: `./src/assets/concept.png`
- Signature weapon: arcanic staff (halberd + 20mm semi-auto low-pressure gun)
- Magazine: 8 rounds before reload cadence applies
- Primary school: Pyrogenics (flame magic)
- Expansion-ready: architecture supports additional schools later (electromancy, hexcraft, cryomancy, etc)

## Combat and Controls

- Movement-first controls (WASD) with auto-targeting attacks in Vampire Survivors style.
- Staff has two integrated behaviors:
  - Halberd sweep for close-range arc hits.
  - Semi-auto arcane shot for mid-range puncture and ignite setup.
- Reload and cadence are tuned so early game feels tense, then perks overpower limitations.
- Damage model prioritizes status interactions (burn, scorch stacks, detonation marks, chain propagation).

## Perk Card System

### Card Presentation

- Perks are shown as cards during level-up drafts.
- Card border color maps to school:
  - Pyrogenics: red
  - Normal/neutral: desaturated khaki
  - Future schools: unique border colors reserved now for readability
- Card anatomy: name, school tag, concise effect line, synergy hint line.

### Card Function

- Every perk must either:
  - add a new trigger,
  - amplify an existing trigger, or
  - bridge two systems for chain reactions.
- Strong preference for "if X then Y" effects to maximize combinatorics.
- Include rarity tiers to control power spikes.

### Example Pyrogenic Chain

- Ember Wake: killed enemies leave burning ground.
- Cinder Relay: burning enemy death ignites nearest 3 enemies.
- Pressure Bloom: every 5 ignitions causes micro-explosion.
- Red Funeral: explosions fire homing embers.
- Furnace Crown: ember kills refund cooldown/reload.

Result: one kill can trigger multi-stage wave clears.

## Enemy Direction: Insect-Based Threats

### Baseline Units

- Mosquito Swarmers: fast, fragile, high pressure in groups.
- Giant Spiders: medium health, leap and web slow.
- Carrion Beetles: armored front, weak rear.
- Bloat Ticks: slow approach, burst on death into larvae.
- Wasp Lancers: dash-through behavior, punish standing still.

### Elite/Boss Concepts

- Broodmother Spider: web zones + hatchling summons.
- Cathedral Mosquito: map-spanning blood siphon beams.
- Chitin Colossus: rotating armor phases and charge lanes.

### Encounter Shape

- Minute-by-minute composition script: pressure -> release -> spike.
- Enemy mixes force build adaptation (pierce, area denial, anti-armor, anti-swarm).

## Meta Progression (Between Runs)

- Unlock new perks, schools, and weapon mutations.
- Permanent Arcanist upgrades remain modest to keep run skill meaningful.
- New enemy species and map modifiers unlock as milestones.

## Full Rewrite Architecture Plan

### 1) Foundation Reset

- Create a clean game-mode boundary for "Survivor Mode" instead of patching current mode logic.
- Define data-driven schemas for:
  - player stats,
  - weapons,
  - status effects,
  - perks,
  - enemies,
  - wave timeline events.
- Keep rendering/audio/input infrastructure only where reusable.

### 2) Vertical Slice (Must-Have)

- One map, Arcanist base kit, 5 enemy archetypes, 30 perks.
- Functional level-up card draft with school border colors.
- Working chain reaction system with visible propagation.
- Full run from minute 0 to minute 20.

### 3) Content Expansion

- Add elite wave logic and 2 insect bosses.
- Expand perk pool to 80+ with school tags.
- Introduce at least one non-pyrogenic school stub and cross-school synergies.

### 4) Polish and Balance

- Tight telegraph readability for dense VFX.
- Frame-time stabilization under late-game swarm density.
- Audio layering for chain cascades and level-up beats.
- Accessibility pass: colorblind-safe card border accents plus icon backup.

### 5) Shipping Scope

- Final run mode, unlock loop, settings, and onboarding.
- Build validation and deterministic simulation tests for critical systems.

## System Implementation Backlog

1. Build event-driven combat pipeline (onHit, onKill, onIgnite, onExplosion).
2. Implement status stack engine with deterministic ordering.
3. Implement perk resolver with trigger registry and dependency guards.
4. Implement wave director with difficulty curve tables.
5. Build card draft UI with school-colored border treatment.
6. Build enemy behavior set for mosquito, spider, beetle, tick, wasp.
7. Add boss behaviors and timer milestones.
8. Add run-end and meta progression hooks.

## Success Criteria

- By minute 12, a standard run reliably demonstrates first major chain cascade.
- By minute 20, high-synergy builds can clear dense packs through chained triggers.
- Players can identify perk school and role in under 1 second from card UI.
- Giant spiders and mosquitos are recognizable threats with distinct counters.

## Risks and Mitigations

- Risk: chain effects tank performance in late game.
  - Mitigation: cap per-frame trigger fanout, pool effects, batch damage events.
- Risk: perk pool has dead picks.
  - Mitigation: enforce synergy lint checks in perk data and run simulation tests.
- Risk: visual overload obscures enemy telegraphs.
  - Mitigation: hard contrast rules and telegraph priority layer.

## Immediate Next Steps

1. Approve this rewrite plan as the new project direction.
2. Lock vertical slice scope (enemy count, perk count, map target).
3. Start implementation with data schemas + event pipeline first.
