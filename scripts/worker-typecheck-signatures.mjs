import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

// Keep the statement, message and multiplicity: code-only counts could allow a
// fixed error to be replaced by a different error with the same TypeScript code.
export function diagnosticSignature(diagnostic, root) {
  const file = diagnostic.file;
  let statement = '';
  if (file && diagnostic.start !== undefined) {
    let node = file;
    function descend(parent) {
      parent.forEachChild(child => {
        if (child.getFullStart() <= diagnostic.start && diagnostic.start < child.end) {
          node = child;
          descend(child);
        }
      });
    }
    descend(file);
    while (node.parent && !ts.isStatement(node)) node = node.parent;
    statement = printer.printNode(ts.EmitHint.Unspecified, node, file);
  }
  return JSON.stringify([
    file ? path.relative(root, file.fileName).split(path.sep).join('/') : '<global>',
    `TS${diagnostic.code}`,
    createHash('sha256').update(statement).digest('hex'),
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  ]);
}

export function collectDiagnostics(root) {
  const configPath = path.join(root, 'worker/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return [config.error];
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), undefined, configPath);
  if (parsed.errors.length) return parsed.errors;
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return ts.getPreEmitDiagnostics(program);
}

export function diffDiagnostics(known, actual) {
  function tally(signatures) {
    const counts = new Map();
    for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);
    return counts;
  }
  const expected = tally(known);
  const observed = tally(actual);
  return [...new Set([...expected.keys(), ...observed.keys()])].sort().flatMap(key => {
    const want = expected.get(key) ?? 0;
    const got = observed.get(key) ?? 0;
    return want === got ? [] : [`  ${key}: expected ${want}, got ${got}`];
  });
}
