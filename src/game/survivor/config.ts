import { buildPerkCardView, type SurvivorModeDefinition } from "./schema.ts"

export const SURVIVOR_MODE_DEFINITION: SurvivorModeDefinition = {
  title: "Wild Wild Magic Missile",
  coreLoop: [
    "Defeat insect swarms to gain essence and level quickly",
    "Draft perk cards to build school-based trigger chains",
    "Amplify chain reactions until one kill detonates whole packs",
  ],
  player: {
    id: "arcanist",
    displayName: "Arcanist",
    portraitPath: "./assets/concept.png",
    primarySchoolId: "pyrogenics",
    weaponId: "arcanic_staff",
  },
  schools: [
    {
      id: "pyrogenics",
      label: "Pyrogenics",
      borderColor: "#c23a2b",
    },
    {
      id: "neutral",
      label: "Neutral",
      borderColor: "#8b8567",
    },
  ],
  weapons: [
    {
      id: "arcanic_staff",
      label: "Arcanic Staff",
      frame: "halberd + 20mm semi-auto low-pressure gun",
      description: "Hybrid melee firearm tuned for pyrogenic trigger setups",
      melee: {
        shape: "sweep",
        sweepDegrees: 110,
        reach: 2.2,
        baseDamage: 22,
      },
      ballistic: {
        caliberMm: 20,
        action: "semi-auto",
        pressureClass: "low-pressure",
        magazineSize: 8,
        reloadSeconds: 1.35,
        baseDamage: 28,
      },
    },
  ],
  statusEffects: [
    {
      id: "burning",
      label: "Burning",
      schoolId: "pyrogenics",
      maxStacks: 20,
      tickSeconds: 0.35,
      description: "Deals periodic fire damage and enables ignition synergies",
    },
    {
      id: "scorch_mark",
      label: "Scorch Mark",
      schoolId: "pyrogenics",
      maxStacks: 5,
      tickSeconds: 0,
      description: "Detonation marker consumed by explosion-trigger perks",
    },
  ],
  perkCards: [
    {
      id: "ember_wake",
      label: "Ember Wake",
      schoolId: "pyrogenics",
      rarity: "common",
      summary: "Kills leave short-lived burning ground",
      synergyHint: "Starts ignition chains in dense swarms",
      triggers: [
        {
          event: "on_kill",
          condition: "enemy dies to arcanist damage",
          outcome: "spawn burning ground patch at death position",
        },
      ],
    },
    {
      id: "cinder_relay",
      label: "Cinder Relay",
      schoolId: "pyrogenics",
      rarity: "uncommon",
      summary: "Burning deaths ignite nearby enemies",
      synergyHint: "Pairs with Ember Wake for chain spread",
      triggers: [
        {
          event: "on_kill",
          condition: "killed enemy was burning",
          outcome: "apply burning to nearest 3 enemies",
        },
      ],
    },
    {
      id: "pressure_bloom",
      label: "Pressure Bloom",
      schoolId: "pyrogenics",
      rarity: "rare",
      summary: "Every 5 ignitions causes a micro-explosion",
      synergyHint: "Converts spread into burst wave clear",
      triggers: [
        {
          event: "on_ignite",
          condition: "ignition counter reaches 5",
          outcome: "trigger micro-explosion around ignited target",
        },
      ],
    },
    {
      id: "red_funeral",
      label: "Red Funeral",
      schoolId: "pyrogenics",
      rarity: "legendary",
      summary: "Explosions launch homing embers",
      synergyHint: "Turns each blast into another ignition source",
      triggers: [
        {
          event: "on_explosion",
          condition: "explosion hits at least one enemy",
          outcome: "spawn 4 homing embers toward nearest enemies",
        },
      ],
    },
    {
      id: "furnace_crown",
      label: "Furnace Crown",
      schoolId: "pyrogenics",
      rarity: "legendary",
      summary: "Ember kills refund reload and cooldown",
      synergyHint: "Sustains loop once ember chain starts",
      triggers: [
        {
          event: "on_kill",
          condition: "enemy dies to ember projectile",
          outcome: "refund partial reload and secondary cooldown",
        },
      ],
    },
    {
      id: "combat_drill",
      label: "Combat Drill",
      schoolId: "neutral",
      rarity: "common",
      summary: "Increase staff sweep speed",
      synergyHint: "Neutral baseline for safer early game",
      triggers: [
        {
          event: "on_hit",
          condition: "halberd sweep connects",
          outcome: "grant temporary move speed",
        },
      ],
    },
  ],
  enemies: [
    {
      id: "mosquito_swarmer",
      label: "Mosquito Swarmer",
      species: "mosquito",
      role: "swarmer",
      baseHp: 24,
      moveSpeed: 5.3,
      threatNotes: ["Very high pack pressure", "Best countered by ignition spread"],
    },
    {
      id: "giant_spider",
      label: "Giant Spider",
      species: "spider",
      role: "controller",
      baseHp: 180,
      moveSpeed: 2.4,
      threatNotes: ["Leap attack", "Web zone slows movement"],
    },
    {
      id: "carrion_beetle",
      label: "Carrion Beetle",
      species: "beetle",
      role: "bruiser",
      baseHp: 140,
      moveSpeed: 2,
      threatNotes: ["Armored front", "Weak rear exposure"],
    },
    {
      id: "bloat_tick",
      label: "Bloat Tick",
      species: "tick",
      role: "charger",
      baseHp: 100,
      moveSpeed: 1.7,
      threatNotes: ["Explodes into larvae on death", "Forces spacing discipline"],
    },
    {
      id: "wasp_lancer",
      label: "Wasp Lancer",
      species: "wasp",
      role: "charger",
      baseHp: 90,
      moveSpeed: 4.1,
      threatNotes: ["Dash-through attack", "Punishes stationary play"],
    },
  ],
  waveTimeline: [
    {
      atSeconds: 0,
      type: "spawn-pack",
      enemyId: "mosquito_swarmer",
      count: 28,
      note: "Open with manageable swarm pressure",
    },
    {
      atSeconds: 45,
      type: "spawn-pack",
      enemyId: "giant_spider",
      count: 2,
      note: "Introduce slow-zone control pressure",
    },
    {
      atSeconds: 90,
      type: "difficulty-spike",
      note: "Increase swarm density and elite chance",
    },
    {
      atSeconds: 180,
      type: "spawn-elite",
      enemyId: "giant_spider",
      count: 1,
      note: "First elite checkpoint",
    },
    {
      atSeconds: 600,
      type: "spawn-boss",
      enemyId: "giant_spider",
      count: 1,
      note: "Mid-run broodmother proxy encounter",
    },
  ],
  cardDraft: {
    cardsPerDraft: 3,
    rerollsPerDraft: 1,
    neutralSchoolId: "neutral",
  },
}

export const SURVIVOR_PERK_CARD_VIEWS = SURVIVOR_MODE_DEFINITION.perkCards.map((perk) => {
  return buildPerkCardView(SURVIVOR_MODE_DEFINITION.schools, perk)
})
