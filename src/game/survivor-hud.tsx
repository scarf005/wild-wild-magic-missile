import {
  debugGameSpeedSignal,
  debugInfiniteHpSignal,
  debugInfiniteReloadSignal,
  fpsSignal,
  hpSignal,
  levelUpChoicesSignal,
  levelUpSelectionSignal,
  persistDebugOptions,
  playerPerksSignal,
  primaryAmmoSignal,
  primaryWeaponSignal,
  timeRemainingSignal,
  xpSignal,
} from "./signals.ts"
import type { PerkId } from "./types.ts"
import { getItemSpritePath } from "./render/pixel-art.ts"

type MagicSchool = "pyrogenics" | "neutral"

const PERK_SCHOOL: Partial<Record<PerkId, MagicSchool>> = {
  proximity_grenades: "pyrogenics",
  overpressure_rounds: "pyrogenics",
  heavy_pellets: "pyrogenics",
}

const schoolColor = (perkId: PerkId) => {
  return PERK_SCHOOL[perkId] === "pyrogenics" ? "#c1324c" : "#8b8567"
}

const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(value / 60)
  const remaining = value % 60
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

export const SurvivorHud = () => {
  const hp = hpSignal.value
  const perks = playerPerksSignal.value
  const xp = xpSignal.value
  const levelUpChoices = levelUpChoicesSignal.value
  const levelUpSelection = levelUpSelectionSignal.value
  const fps = fpsSignal.value
  const hpPercent = hp.maxHp > 0 ? Math.max(0, Math.min(100, (hp.hp / hp.maxHp) * 100)) : 0
  const xpPercent = xp.nextLevelXp > 0 ? Math.max(0, Math.min(100, (xp.xp / xp.nextLevelXp) * 100)) : 0
  const isLevelUpActive = levelUpChoices.length > 0

  return (
    <>
      <div class="survivor-hud-topbar">
        <div class="survivor-top-chip">Time {formatTime(timeRemainingSignal.value)}</div>
        <div class="survivor-top-chip">FPS {Math.round(fps)}</div>
        <div class="survivor-top-stat">
          <div class="survivor-top-label">HP {hp.hp}/{hp.maxHp}</div>
          <div class="survivor-hp-track survivor-track-compact">
            <div class="survivor-hp-fill" style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
        <div class="survivor-top-stat">
          <div class="survivor-top-label">XP Lv {xp.level}</div>
          <div class="survivor-xp-track survivor-track-compact">
            <div class="survivor-xp-fill" style={{ width: `${xpPercent}%` }} />
          </div>
          <div class="survivor-top-detail">{xp.xp}/{xp.nextLevelXp}</div>
        </div>
        <div class="survivor-top-chip">{primaryWeaponSignal.value} | {primaryAmmoSignal.value}</div>
      </div>

      <div class="survivor-hud-left">
        <div class="survivor-panel">
          <div class="survivor-panel-title">Perks</div>
          {perks.length <= 0
            ? <div class="survivor-panel-text">No perks yet</div>
            : perks.map((perk) => (
              <div key={perk.id} class="survivor-panel-text">
                {perk.label}{perk.stacks > 1 ? ` x${perk.stacks}` : ""}
              </div>
            ))}
        </div>
      </div>

      <div class="survivor-debug-panel">
        <label class="survivor-debug-row">
          <input
            type="checkbox"
            checked={debugInfiniteHpSignal.value}
            onInput={(event) => {
              debugInfiniteHpSignal.value = event.currentTarget.checked
              persistDebugOptions()
            }}
          />
          Infinite HP
        </label>
        <label class="survivor-debug-row">
          <input
            type="checkbox"
            checked={debugInfiniteReloadSignal.value}
            onInput={(event) => {
              debugInfiniteReloadSignal.value = event.currentTarget.checked
              persistDebugOptions()
            }}
          />
          Infinite Reload
        </label>
        <label class="survivor-debug-row">
          Speed {debugGameSpeedSignal.value.toFixed(2)}x
          <input
            type="range"
            min={40}
            max={150}
            step={5}
            value={Math.round(debugGameSpeedSignal.value * 100)}
            onInput={(event) => {
              debugGameSpeedSignal.value = Number(event.currentTarget.value) / 100
              persistDebugOptions()
            }}
          />
        </label>
      </div>

      {isLevelUpActive && (
        <div class="survivor-overlay">
          <div class="survivor-levelup-panel">
            <div class="survivor-levelup-title">LEVEL UP!</div>
            <div class="survivor-card-grid">
              {levelUpChoices.slice(0, 3).map((choice) => (
                <button
                  key={choice.perkId}
                  class={`survivor-perk-card ${levelUpSelection === choice.perkId ? "selected" : ""}`}
                  style={{ borderColor: schoolColor(choice.perkId) }}
                  onClick={() => {
                    levelUpSelectionSignal.value = choice.perkId
                  }}
                >
                  <div class="survivor-perk-icon-wrap">
                    {getItemSpritePath(choice.icon)
                      ? <img src={getItemSpritePath(choice.icon)} class="survivor-perk-icon" alt="" />
                      : <span class="survivor-perk-icon-fallback">{choice.label.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div class="survivor-perk-school">
                    {PERK_SCHOOL[choice.perkId] === "pyrogenics" ? "Pyrogenics" : "Neutral"}
                  </div>
                  <div class="survivor-perk-label">{choice.label}</div>
                  <div class="survivor-perk-summary">
                    {choice.stacks > 0 ? `Upgrade ${choice.stacks}/${choice.maxStacks}` : `New perk 0/${choice.maxStacks}`}
                  </div>
                  <div class="survivor-perk-summary">{choice.detail}</div>
                </button>
              ))}
            </div>
            <button
              class="survivor-skip-button"
              onClick={() => {
                levelUpSelectionSignal.value = "skip"
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </>
  )
}
