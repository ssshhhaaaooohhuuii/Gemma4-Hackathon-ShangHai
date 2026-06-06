import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ToolRunRecord } from './types.js'

export type DockerToolSpec = {
  id: string
  name: string
  image: string
  script?: string
  command?: string[]
  mounts: Array<{ host: string; container: string; mode: 'ro' | 'rw' }>
  outputs: string[]
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code }))
  })
}

export async function runDockerTool(spec: DockerToolSpec, logDir: string): Promise<ToolRunRecord> {
  await fs.mkdir(logDir, { recursive: true })
  const startedAt = new Date()
  const stdoutPath = path.join(logDir, `${spec.id}.stdout.log`)
  const stderrPath = path.join(logDir, `${spec.id}.stderr.log`)
  const mountArgs = spec.mounts.flatMap((mount) => [
    '-v',
    `${mount.host}:${mount.container}:${mount.mode}`,
  ])
  const imageCommand = spec.script ? ['python', '-c', spec.script] : (spec.command || [])
  const command = [
    'docker',
    'run',
    '--rm',
    ...mountArgs,
    spec.image,
    ...imageCommand,
  ]

  const result = await runProcess(command[0], command.slice(1))
  const finishedAt = new Date()
  await fs.writeFile(stdoutPath, result.stdout)
  await fs.writeFile(stderrPath, result.stderr)

  if (result.code !== 0) {
    throw new Error(`${spec.name} failed with exit code ${result.code}. See ${stderrPath}`)
  }

  return {
    id: spec.id,
    name: spec.name,
    image: spec.image,
    command: [
      'docker',
      'run',
      '--rm',
      ...mountArgs,
      spec.image,
      ...(spec.script ? ['python', '-c', shellQuote(spec.script)] : imageCommand),
    ],
    status: 'completed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    stdoutPath,
    stderrPath,
    outputFiles: spec.outputs,
  }
}
