
import { getProjectContextRows, getBrandRulesRows, getBotMemoryRows } from './sheetsStorage.js';

export async function buildDynamicContextBlock(limit = 40) {
  const [contextRows, brandRows, memoryRows] = await Promise.all([
    getProjectContextRows(limit),
    getBrandRulesRows(limit),
    getBotMemoryRows(limit)
  ]);

  const context = contextRows.map((r) => `- [${r[1] || 'General'}] ${r[2] || ''}: ${r[3] || ''}`).join('\n');
  const brand = brandRows.map((r) => `- [${r[1] || 'Rule'}] ${r[2] || ''}`).join('\n');
  const memory = memoryRows.map((r) => `- [${r[1] || 'Memory'}] ${r[2] || ''}`).join('\n');

  return `LIVE PROJECT CONTEXT FROM SHEETS\n\nProject Context:\n${context || '- none'}\n\nBrand Rules:\n${brand || '- none'}\n\nBot Memory:\n${memory || '- none'}`;
}
