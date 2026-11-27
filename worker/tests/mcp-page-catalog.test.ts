import { describe, expect, it } from 'vitest';
import { mcpToolNames, publicMcpToolNames } from '../src/mcp';
import { allCatalogTools, PUBLIC_TOOLS } from '../../src/pages/mcpToolCatalog';

/*
 * The /mcp page lists what a connected assistant can do. Before 2026-11-27 it
 * named 10 tools of 176, so a person reading it could not tell the connector
 * did most of the shop. This holds the page's list to the worker's own, both
 * ways, so the page never names a tool that is gone or leaves out a new one.
 */
describe('the /mcp page names every connector tool, and only those', () => {
  const real = new Set(mcpToolNames());
  const listed = allCatalogTools();

  it('names no tool the worker does not have', () => {
    expect(listed.filter((name) => !real.has(name))).toEqual([]);
  });

  it('leaves out no tool the worker has', () => {
    const shown = new Set(listed);
    expect([...real].filter((name) => !shown.has(name))).toEqual([]);
  });

  it('names each tool once', () => {
    expect(listed.filter((name, i) => listed.indexOf(name) !== i)).toEqual([]);
  });

  it('lists the public tools the public connector defines', () => {
    expect([...PUBLIC_TOOLS].sort()).toEqual(publicMcpToolNames().sort());
  });
});
