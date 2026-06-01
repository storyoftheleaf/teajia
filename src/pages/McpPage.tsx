import React from 'react';
import { ArrowRight, KeyRound, LockKeyhole, MessagesSquare, ServerCog, ShieldCheck } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const API_URL = (import.meta.env.VITE_API_URL || 'https://teajia-api.lightcodes.workers.dev').replace(/\/+$/, '');
const MCP_URL = `${API_URL}/mcp`;

const TOOL_GROUPS = [
  {
    title: 'Look up',
    tools: ['search_tea', 'get_tea', 'list_low_stock', 'find_customer'],
    copy: 'Find teas, inspect stock, and match customers before anything is changed.',
  },
  {
    title: 'Stock',
    tools: ['create_tea', 'add_stock', 'remove_stock'],
    copy: 'Create products and record stock that entered or left the store.',
  },
  {
    title: 'Sales',
    tools: ['record_sale', 'fulfill_invoice', 'mark_invoice_paid'],
    copy: 'Draft sales, deduct stock when goods leave, and mark payment when money arrives.',
  },
];

const CLIENTS = [
  {
    name: 'Claude Desktop',
    steps: [
      'Open Settings, then Developer.',
      'Edit the MCP configuration.',
      'Add a remote HTTP MCP server using the Teajia MCP URL and bearer token.',
      'Restart Claude and ask it to list Teajia tools.',
    ],
  },
  {
    name: 'Codex',
    steps: [
      'Open your Codex MCP configuration.',
      'Add a remote HTTP server named teajia.',
      'Set the URL to Teajia MCP and pass the token as an Authorization header.',
      'Restart Codex and ask it to search Teajia inventory.',
    ],
  },
  {
    name: 'Hermes or another agent',
    steps: [
      'Use any MCP client that supports remote HTTP servers.',
      'Store the Teajia token in that agent server environment.',
      'Register the Teajia MCP URL as the tool endpoint.',
      'Keep all write actions behind a human confirmation step.',
    ],
  },
];

export default function McpPage() {
  return (
    <div className="min-h-[100dvh] bg-tea-bg text-tea-text">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 pb-nav-gap md:px-8 lg:py-14">
        <header className="grid gap-8 border-b border-tea-border pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-3 text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec">Teajia MCP</p>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} max-w-3xl text-tea-text`}>
              Connect AI clients directly to a Teajia store.
            </h1>
            <p className="mt-5 max-w-2xl text-ui-16 leading-[1.7] text-tea-text-sec">
              This is a Teajia feature. The store owns the token, the inventory, the customers,
              invoices, stock movement, payment state, and audit trail. i64OS can document or link
              to it, but it is not required for another person to use Teajia MCP.
            </p>
          </div>
          <div className="rounded-xl border border-tea-border bg-tea-surface p-4">
            <p className="mb-2 text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec">MCP endpoint</p>
            <code className="block break-all rounded-md border border-tea-border bg-tea-bg px-3 py-3 text-ui-12 text-tea-text">
              {MCP_URL}
            </code>
            <a
              href="/admin/mcp-tokens"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-tea-gold/40 px-4 text-ui-13 text-tea-gold transition-colors hover:bg-tea-gold/10"
            >
              Open token manager <ArrowRight size={14} />
            </a>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: KeyRound,
              title: '1. Mint a token',
              copy: 'Log into Teajia as the store owner and mint a token from Admin, Voice & Agent access.',
            },
            {
              icon: ServerCog,
              title: '2. Add the MCP URL',
              copy: 'In Claude, Codex, Hermes, or another MCP client, point the server URL at Teajia.',
            },
            {
              icon: ShieldCheck,
              title: '3. Confirm writes',
              copy: 'Search can run freely. Sales, stock, and payment changes should be reviewed before final action.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-xl border border-tea-border bg-tea-surface p-5">
              <item.icon size={19} className="mb-4 text-tea-gold" />
              <h2 className="mb-2 text-ui-17 font-medium text-tea-text">{item.title}</h2>
              <p className="text-ui-13 leading-[1.6] text-tea-text-sec">{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-3 text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec">Configuration</p>
            <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>What every AI client needs</h2>
            <p className="mt-4 text-ui-14 leading-[1.7] text-tea-text-sec">
              The exact settings screen differs by client, but the inputs are the same:
              a remote HTTP MCP URL and an Authorization bearer token minted inside Teajia.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-tea-border bg-tea-surface p-4">
              <p className="mb-2 text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec">URL</p>
              <code className="break-all text-ui-13 text-tea-text">{MCP_URL}</code>
            </div>
            <div className="rounded-xl border border-tea-border bg-tea-surface p-4">
              <p className="mb-2 text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec">Header</p>
              <code className="break-all text-ui-13 text-tea-text">Authorization: Bearer tjmcp_...</code>
            </div>
            <div className="rounded-xl border border-tea-border bg-tea-surface p-4">
              <p className="mb-2 text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec">Rule</p>
              <p className="text-ui-13 leading-[1.6] text-tea-text-sec">
                Do not paste the token into chat. Store it in the MCP client settings or server environment.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {CLIENTS.map((client) => (
            <article key={client.name} className="rounded-xl border border-tea-border bg-tea-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessagesSquare size={17} className="text-tea-gold" />
                <h2 className="text-ui-17 font-medium text-tea-text">{client.name}</h2>
              </div>
              <ol className="space-y-2 text-ui-13 leading-[1.6] text-tea-text-sec">
                {client.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-tea-border pb-4">
            <div>
              <p className="mb-2 text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec">Tools</p>
              <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>What the connected AI can do</h2>
            </div>
            <LockKeyhole size={20} className="hidden text-tea-text-sec md:block" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TOOL_GROUPS.map((group) => (
              <article key={group.title} className="rounded-xl border border-tea-border bg-tea-surface p-5">
                <h3 className="mb-2 text-ui-17 font-medium text-tea-text">{group.title}</h3>
                <p className="mb-4 text-ui-13 leading-[1.6] text-tea-text-sec">{group.copy}</p>
                <div className="flex flex-wrap gap-2">
                  {group.tools.map((tool) => (
                    <code key={tool} className="rounded-md border border-tea-border bg-tea-bg px-2 py-1 text-ui-11 text-tea-text-sec">
                      {tool}
                    </code>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
