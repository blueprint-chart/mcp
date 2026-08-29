import type { ChartNode } from '@blueprint-chart/lib'

/**
 * The MCP numbers scenes the way the editor's player does: scene 1 is the base
 * chart and every `scene` block that follows takes the next number, so a chart
 * with one override has two scenes and the player reads "1 / 2". The library
 * indexes the override blocks alone, with `undefined` meaning the base state.
 *
 * These two functions are the only place the two numberings meet.
 */
export function sceneCount(ast: ChartNode): number {
  return (ast.scenes?.length ?? 0) + 1
}

export function toLibSceneIndex(scene: number | undefined): number | undefined {
  return scene === undefined || scene <= 1 ? undefined : scene - 2
}
