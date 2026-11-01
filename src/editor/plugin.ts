// The level editor's way into the repository: while `npm run dev` serves the
// game, GET /__catalog reads src/gen/catalog.json and POST /__catalog writes
// it, laid out as `pretty` says (short things on one line, so that a change
// shows as a change of a few lines). The game reloads with it at once.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** JSON, what fits in `width` characters on one line, the rest one item per line */
export function pretty(v: unknown, indent = '', width = 150): string {
  const flat = JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']');
  if (v === null || typeof v !== 'object' || indent.length + flat.length <= width) return flat;
  const inner = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => inner + pretty(x, inner, width)).join(',\n')}\n${indent}]`;
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${pretty(x, inner, width)}`).join(',\n')}\n${indent}}`;
}

export function catalogFile(root: string): Plugin {
  const file = resolve(root, 'src/gen/catalog.json');
  return {
    name: 'loose-ends-catalog',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__catalog', async (req, res) => {
        try {
          if (req.method === 'POST') {
            let body = '';
            for await (const chunk of req) body += chunk;
            await writeFile(file, pretty(JSON.parse(body)) + '\n');
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
            return;
          }
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(await readFile(file, 'utf8'));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}
