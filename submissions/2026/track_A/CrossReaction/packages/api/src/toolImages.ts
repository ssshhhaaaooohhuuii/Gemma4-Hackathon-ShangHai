import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { rootDir } from './paths.js'

export type DemoToolKey =
  | 'fastqc'
  | 'trimmomatic'
  | 'kallisto'
  | 'pydeseq2'
  | 'multiqc'
  | 'fastp'
  | 'scanpy'
  | 'limma'
  | 'openms'
  | 'msstats'

export type DemoToolImage = {
  image: string
  context?: string
}

const toolImagesRoot = path.join(rootDir, 'packages', 'api', 'tool-images')
const cleanDockerConfigDir = path.join(rootDir, '.review-data', 'docker-config')

export const demoToolImages: Record<DemoToolKey, DemoToolImage> = {
  fastqc: {
    image: 'quay.io/biocontainers/fastqc:0.12.1--hdfd78af_0',
  },
  trimmomatic: {
    image: 'quay.io/biocontainers/trimmomatic:0.39--hdfd78af_2',
  },
  fastp: {
    image: 'quay.io/biocontainers/fastp:0.23.4--hadf994f_2',
  },
  kallisto: {
    image: 'quay.io/biocontainers/kallisto:0.51.1--h2b92561_2',
  },
  pydeseq2: {
    image: 'gemma-demo/pydeseq2-rnaseq:0.1.0',
    context: path.join(toolImagesRoot, 'pydeseq2-rnaseq'),
  },
  multiqc: {
    image: 'quay.io/biocontainers/multiqc:1.21--pyhdfd78af_0',
  },
  scanpy: {
    image: 'ghcr.io/getwilds/scanpy:latest',
  },
  limma: {
    image: 'quay.io/biocontainers/bioconductor-limma:3.58.1--r43ha9d7317_1',
  },
  openms: {
    image: 'quay.io/biocontainers/openms:3.4.1--heb594b5_0',
  },
  msstats: {
    image: 'quay.io/biocontainers/bioconductor-msstats:4.10.0--r43hf17093f_1',
  },
}

const ensuredImages = new Set<string>()

function runProcess(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: env ?? process.env })
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

function isDockerCredentialHelperError(output: string): boolean {
  return /credentials?|credsStore|credential helper|parameters passed to the function/i.test(output)
}

async function ensureCleanDockerConfig(): Promise<NodeJS.ProcessEnv> {
  await fs.mkdir(cleanDockerConfigDir, { recursive: true })
  await fs.writeFile(path.join(cleanDockerConfigDir, 'config.json'), '{"auths":{}}\n', 'utf8')
  return { ...process.env, DOCKER_CONFIG: cleanDockerConfigDir }
}

export async function ensureDemoToolImage(tool: DemoToolKey): Promise<void> {
  const definition = demoToolImages[tool]
  if (ensuredImages.has(definition.image)) return

  const inspected = await runProcess('docker', ['image', 'inspect', definition.image])
  if (inspected.code === 0) {
    ensuredImages.add(definition.image)
    return
  }

  if (!definition.context) {
    const pulled = await runProcess('docker', ['pull', definition.image])
    if (pulled.code !== 0) {
      const output = pulled.stderr || pulled.stdout
      if (isDockerCredentialHelperError(output)) {
        const retry = await runProcess('docker', ['pull', definition.image], await ensureCleanDockerConfig())
        if (retry.code === 0) {
          ensuredImages.add(definition.image)
          return
        }
        throw new Error(`Failed to pull public tool image ${definition.image} with clean Docker config: ${retry.stderr || retry.stdout}`)
      }
      throw new Error(`Failed to pull public tool image ${definition.image}: ${output}`)
    }
    ensuredImages.add(definition.image)
    return
  }

  const built = await runProcess('docker', ['build', '-t', definition.image, definition.context])
  if (built.code !== 0) {
    throw new Error(`Failed to build demo tool image ${definition.image}: ${built.stderr || built.stdout}`)
  }
  ensuredImages.add(definition.image)
}

export function listDemoToolImages(): Array<{ key: DemoToolKey; image: string; context?: string }> {
  return (Object.entries(demoToolImages) as Array<[DemoToolKey, DemoToolImage]>).map(([key, value]) => ({
    key,
    image: value.image,
    context: value.context,
  }))
}
