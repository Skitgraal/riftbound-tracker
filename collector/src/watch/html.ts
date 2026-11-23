/** Outils de lecture des pages : texte brut depuis du HTML, données embarquées des sites Next.js. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** HTML → texte lisible : titres et puces conservés, balises retirées. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|table|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Données de page d'un site Next.js « pages router » (`__NEXT_DATA__`). */
export function nextData(html: string): unknown {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) throw new Error('données __NEXT_DATA__ absentes : la structure de la page a changé');
  return JSON.parse(match[1]);
}

/** Flux React Server Components d'un site Next.js « app router » (`self.__next_f.push`), concaténé. */
export function rscPayload(html: string): string {
  const parts = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
  if (parts.length === 0) throw new Error('flux __next_f absent : la structure de la page a changé');
  return parts.map((m) => JSON.parse(m[1]!) as string).join('');
}

/** Extrait la valeur JSON (tableau ou objet) qui suit `"key":` dans un texte. */
export function jsonAfterKey(text: string, key: string): unknown {
  const marker = `"${key}":`;
  const start = text.indexOf(marker);
  if (start === -1) throw new Error(`clé ${key} absente : la structure de la page a changé`);
  let i = start + marker.length;
  const open = text[i];
  const close = open === '[' ? ']' : open === '{' ? '}' : undefined;
  if (!close) throw new Error(`valeur de ${key} inattendue`);
  let depth = 0;
  let inString = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(text.slice(start + marker.length, i + 1));
  }
  throw new Error(`valeur de ${key} tronquée`);
}

/** Parcourt récursivement un objet JSON et renvoie les objets qui satisfont le test. */
export function findObjects<T>(root: unknown, test: (o: Record<string, unknown>) => boolean): T[] {
  const found: T[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (test(o)) found.push(o as T);
      Object.values(o).forEach(walk);
    }
  };
  walk(root);
  return found;
}
