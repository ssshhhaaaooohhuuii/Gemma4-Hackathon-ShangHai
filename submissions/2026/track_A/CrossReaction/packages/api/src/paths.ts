import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const apiSrcDir = path.dirname(currentFile)

export const rootDir = path.resolve(apiSrcDir, '../../..')
export const dataRoot = path.join(rootDir, 'demo-data', 'bulk_rnaseq')
export const singleCellDataRoot = path.join(rootDir, 'demo-data', 'single_cell_rnaseq')
export const proteomicsDataRoot = path.join(rootDir, 'demo-data', 'proteomics_lfq')
export const reviewDataRoot = path.join(rootDir, '.review-data')
export const providerConfigPath = path.join(reviewDataRoot, 'provider.json')
