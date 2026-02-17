export type Team = string

export type AIState = "wander" | "aggro" | "flee"

export type PrimaryWeaponId =
  | "pistol"
  | "assault"
  | "shotgun"
  | "flamethrower"
  | "auto-shotgun"
  | "battle-rifle"
  | "grenade-launcher"
  | "rocket-launcher"

export type SecondaryMode = "grenade" | "molotov"

export type PerkId =
  | "laser_sight"
  | "ricochet_shells"
  | "proximity_grenades"
  | "rapid_reload"
  | "heavy_pellets"
  | "extra_heart"
  | "overpressure_rounds"
  | "extra_stamina"
  | "kevlar_vest"

export type GameModeId = "survivor" | "ffa" | "tdm" | "duo" | "squad"
