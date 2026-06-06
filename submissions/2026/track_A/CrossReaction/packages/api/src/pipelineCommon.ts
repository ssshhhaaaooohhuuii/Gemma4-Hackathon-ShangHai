import fs from 'node:fs/promises'
import path from 'node:path'
import { runDockerTool, type DockerToolSpec } from './dockerTools.js'
import { ensureDemoToolImage, type DemoToolKey } from './toolImages.js'
import type { ResultTable, TimelineEventInput } from './types.js'

export type PipelineEventSink = (event: TimelineEventInput) => void
export type VisibleDockerSpec = DockerToolSpec & { toolKey: DemoToolKey }

export function toContainerScript(script: string): string[] {
  return ['sh', '-lc', script]
}

export async function runVisibleDockerTool(
  spec: VisibleDockerSpec,
  logDir: string,
  emitEvent?: PipelineEventSink,
) {
  emitEvent?.({
    id: `execution-${spec.id}`,
    phase: 'execution',
    status: 'running',
    title: spec.name,
    detail: `Preparing and starting dedicated tool image ${spec.image}.`,
    toolName: spec.name,
    image: spec.image,
    outputFiles: spec.outputs,
  })

  try {
    await ensureDemoToolImage(spec.toolKey)
    const result = await runDockerTool(spec, logDir)
    emitEvent?.({
      id: `execution-${spec.id}`,
      phase: 'execution',
      status: 'completed',
      title: spec.name,
      detail: `Completed in ${result.durationMs} ms.`,
      toolName: spec.name,
      image: spec.image,
      durationMs: result.durationMs,
      outputFiles: result.outputFiles,
    })
    return result
  } catch (error) {
    emitEvent?.({
      id: `execution-${spec.id}`,
      phase: 'execution',
      status: 'failed',
      title: spec.name,
      detail: error instanceof Error ? error.message : 'Container step failed.',
      toolName: spec.name,
      image: spec.image,
      outputFiles: spec.outputs,
    })
    throw error
  }
}

export function parseCsv(raw: string): Array<Record<string, string | number>> {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, index) => {
      const value = values[index] ?? ''
      const numeric = Number(value)
      return [header, Number.isFinite(numeric) && value.trim() !== '' ? numeric : value]
    }))
  })
}

export async function csvTable(title: string, filePath: string): Promise<ResultTable> {
  const rows = parseCsv(await fs.readFile(filePath, 'utf8'))
  return {
    title,
    columns: rows.length ? Object.keys(rows[0]) : [],
    rows,
  }
}

export async function ensurePipelineDirs(outputDir: string) {
  const logDir = path.join(outputDir, 'logs')
  await fs.mkdir(outputDir, { recursive: true })
  await fs.mkdir(logDir, { recursive: true })
  return { logDir }
}
