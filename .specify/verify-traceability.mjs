#!/usr/bin/env node
// Verificador de trazabilidad SDD.
//
//   node .specify/verify-traceability.mjs INV-002
//
// Cierra la cadena FR/BR/AC -> anotación @spec en código y tests.
// Sin dependencias. Sale con código 1 si hay huérfanos o referencias muertas.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SPEC_ID = process.argv[2];
const SEP = String.fromCharCode(92); // separador de Windows, sin regex

if (!SPEC_ID) {
  console.error('uso: node .specify/verify-traceability.mjs <ID>   p.ej. INV-002');
  process.exit(2);
}

const SCAN_ROOTS = ['api/src', 'api/test', 'web/src', 'apps/pos-web/src'];
const SCAN_EXT = /\.(ts|tsx|js|mjs)$/;
const SKIP_DIR = /^(node_modules|dist|build|coverage|\.turbo|\.git)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(entry.name)) walk(join(dir, entry.name), out);
    } else if (SCAN_EXT.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function findSpecDir() {
  const base = join(REPO, 'specs');
  if (!existsSync(base)) fail(`no existe ${base}`);
  for (const vertical of readdirSync(base)) {
    const vdir = join(base, vertical);
    if (!statSync(vdir).isDirectory()) continue;
    for (const slug of readdirSync(vdir)) {
      if (slug.startsWith(SPEC_ID + '-') || slug === SPEC_ID) return join(vdir, slug);
    }
  }
  fail(`no encontré un spec con id ${SPEC_ID} bajo specs/`);
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(2);
}

// --- spec.md -----------------------------------------------------------------

const specDir = findSpecDir();
const specPath = join(specDir, 'spec.md');
if (!existsSync(specPath)) fail(`falta ${relative(REPO, specPath)}`);
const spec = readFileSync(specPath, 'utf8');

// ### FR-001   |   ### AC-001 · Covers: FR-001, BR-002

const requirements = new Map(); // id -> { covers: [] }
const lines = spec.split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  const m = /^#{2,4}\s+((?:FR|BR|AC)-\d+)\s*(?:[·|-]\s*Covers:\s*(.+))?\s*$/.exec(lines[i]);
  if (!m) continue;
  const id = m[1];
  let covers = m[2];
  if (!covers) {
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const c = /^Covers:\s*(.+)$/.exec(lines[j].trim());
      if (c) { covers = c[1]; break; }
      if (/^#{2,4}\s/.test(lines[j])) break;
    }
  }
  requirements.set(id, {
    covers: covers ? covers.split(/[,\s]+/).filter((x) => /^(FR|BR|AC)-\d+$/.test(x)) : [],
  });
}

if (requirements.size === 0) fail(`${relative(REPO, specPath)} no declara ningún FR/BR/AC`);

// --- tasks.md ----------------------------------------------------------------

const tasksPath = join(specDir, 'tasks.md');
const viaByRequirement = new Map(); // id -> Set<via>
if (existsSync(tasksPath)) {
  const tasks = readFileSync(tasksPath, 'utf8');
  const BLOCK = /```[\s\S]*?```/g;
  for (const block of tasks.match(BLOCK) ?? []) {
    const via = /^\s*via:\s*(\w+)/m.exec(block)?.[1];
    const covers = /^\s*covers:\s*(.+)$/m.exec(block)?.[1] ?? '';
    if (!via) continue;
    for (const ref of covers.match(/(?:FR|BR|AC)-\d+/g) ?? []) {
      if (!viaByRequirement.has(ref)) viaByRequirement.set(ref, new Set());
      viaByRequirement.get(ref).add(via);
    }
  }
}

// --- anotaciones @spec -------------------------------------------------------

const ANNOTATION = /@spec\s+([A-Z]+-\d+)\s+((?:(?:FR|BR|AC)-\d+[,\s]*)+)/g;
const annotations = new Map(); // requisito -> [{file, line}]
const deadRefs = [];

for (const root of SCAN_ROOTS) {
  for (const file of walk(join(REPO, root))) {
    const content = readFileSync(file, 'utf8');
    if (!content.includes('@spec')) continue;
    const fileLines = content.split(/\r?\n/);
    fileLines.forEach((line, idx) => {
      let m;
      const re = new RegExp(ANNOTATION.source, 'g');
      while ((m = re.exec(line))) {
        if (m[1] !== SPEC_ID) continue;
        for (const ref of m[2].match(/(?:FR|BR|AC)-\d+/g) ?? []) {
          const where = { file: relative(REPO, file).split(SEP).join('/'), line: idx + 1 };
          if (!requirements.has(ref)) { deadRefs.push({ ref, ...where }); continue; }
          if (!annotations.has(ref)) annotations.set(ref, []);
          annotations.get(ref).push(where);
        }
      }
    });
  }
}

// --- reporte -----------------------------------------------------------------

const orphans = [...requirements.keys()].filter((id) => !annotations.has(id));
const acsSinCovers = [...requirements.entries()]
  .filter(([id, r]) => id.startsWith('AC-') && r.covers.length === 0)
  .map(([id]) => id);
const sinTest = [...requirements.keys()].filter((id) => {
  const vias = viaByRequirement.get(id);
  return vias && vias.size > 0 && [...vias].every((v) => v === 'directo');
});

console.log(`\nTrazabilidad — ${SPEC_ID}  (${relative(REPO, specDir).split(SEP).join('/')})`);
console.log(`${requirements.size} requisitos · ${annotations.size} con anotación\n`);

for (const [id, r] of requirements) {
  const hits = annotations.get(id) ?? [];
  const mark = hits.length ? 'ok  ' : 'HUÉRFANO';
  const covers = r.covers.length ? `  covers: ${r.covers.join(', ')}` : '';
  console.log(`  ${mark.padEnd(9)} ${id}${covers}`);
  for (const h of hits) console.log(`${' '.repeat(14)}${h.file}:${h.line}`);
}

if (acsSinCovers.length) {
  console.log(`\nACs sin Covers: ${acsSinCovers.join(', ')}`);
  console.log('  La cadena no se puede seguir: el número compartido no es un enlace.');
}

if (sinTest.length) {
  console.log(`\nCobertura sin test: ${sinTest.join(', ')}`);
  console.log('  Cubiertos solo por tareas `directo`. No bloquea; decláralo en verify.md.');
}

if (deadRefs.length) {
  console.log('\nReferencias muertas:');
  for (const d of deadRefs) console.log(`  ${d.ref} en ${d.file}:${d.line} — no existe en el spec`);
}

const blocking = orphans.length + deadRefs.length;
console.log(
  blocking === 0
    ? '\nSin huérfanos ni referencias muertas.\n'
    : `\n${orphans.length} huérfanos, ${deadRefs.length} referencias muertas. Bloquea el cierre.\n`,
);
process.exit(blocking === 0 ? 0 : 1);
