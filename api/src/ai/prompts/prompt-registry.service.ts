import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface PromptSection {
  name: string;
  raw: string;
}

export interface PromptTemplate {
  featureKey: string;
  version: number;
  locale?: string;
  sections: PromptSection[];
}

const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * Prompts como código (D-03 / ADR previo a esta fase): archivos versionados
 * en `templates/<featureKey>/v<version>.md`, cargados e inmutables una vez
 * en caché. Una versión publicada no se edita — se crea `v2` y se cambia el
 * binding en `config/ai-feature.binding.ts`.
 *
 * Convención de ruta: la carpeta es la feature, el archivo es la versión.
 * Es una simplificación concreta de la notación `<feature>/<name>.v1.md` del
 * documento de arquitectura — sin ambigüedad sobre qué nombre de archivo
 * derivar de la clave de la feature.
 */
@Injectable()
export class PromptRegistry {
  private readonly cache = new Map<string, PromptTemplate>();

  resolve(featureKey: string, version: number): PromptTemplate {
    const cacheKey = `${featureKey}@v${version}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const filePath = join(TEMPLATES_DIR, featureKey, `v${version}.md`);
    if (!existsSync(filePath)) {
      throw new Error(`PromptRegistry: no existe la plantilla "${filePath}".`);
    }

    const raw = readFileSync(filePath, 'utf-8');
    const template = this.parse(featureKey, version, raw);
    this.cache.set(cacheKey, template);
    return template;
  }

  private parse(featureKey: string, version: number, raw: string): PromptTemplate {
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    const body = frontmatterMatch ? frontmatterMatch[2] : raw;
    const frontmatterRaw = frontmatterMatch ? frontmatterMatch[1] : '';

    const frontmatter: Record<string, string> = {};
    for (const line of frontmatterRaw.split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) frontmatter[key] = value;
    }

    const sections: PromptSection[] = [];
    const sectionRegex = /^##\s+(\S+)\s*$/gm;
    const matches = [...body.matchAll(sectionRegex)];
    for (let i = 0; i < matches.length; i++) {
      const name = matches[i][1];
      const start = (matches[i].index ?? 0) + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
      sections.push({ name, raw: body.slice(start, end).trim() });
    }

    return {
      featureKey,
      version,
      locale: frontmatter.locale,
      sections,
    };
  }
}
