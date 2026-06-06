import fs from 'node:fs/promises'
import { providerConfigPath, reviewDataRoot } from './paths.js'
import type { ProviderConfig } from './types.js'

export function defaultProviderConfig(): ProviderConfig {
  return {
    provider: 'local_openai_compatible',
    baseUrl: process.env.GEMMA_BASE_URL || 'http://127.0.0.1:11434/v1',
    apiKey: process.env.GEMMA_API_KEY || 'local-placeholder-token',
    model: process.env.GEMMA_MODEL || 'gemma4:latest',
  }
}

export async function loadProviderConfig(): Promise<ProviderConfig> {
  try {
    const raw = await fs.readFile(providerConfigPath, 'utf8')
    return { ...defaultProviderConfig(), ...JSON.parse(raw) }
  } catch {
    return defaultProviderConfig()
  }
}

export async function saveProviderConfig(config: Partial<ProviderConfig>): Promise<ProviderConfig> {
  await fs.mkdir(reviewDataRoot, { recursive: true })
  const current = await loadProviderConfig()
  const next: ProviderConfig = {
    ...current,
    ...config,
    provider: 'local_openai_compatible',
    baseUrl: String(config.baseUrl ?? current.baseUrl).trim(),
    apiKey: String(config.apiKey ?? current.apiKey).trim(),
    model: String(config.model ?? current.model).trim(),
  }
  await fs.writeFile(providerConfigPath, JSON.stringify(next, null, 2))
  return next
}

export function publicProviderConfig(config: ProviderConfig) {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: config.apiKey.trim().length > 0,
  }
}
