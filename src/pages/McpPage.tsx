import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Check, Copy, Eye, KeyRound, LogIn, ShieldCheck, ShoppingBag, Undo2 } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import {
  HOST_TOOL_GROUP,
  MCP_PUBLIC_URL,
  MCP_SERVER_URL,
  PERSONAL_TOOL_GROUP,
  PUBLIC_TOOLS,
  SHOP_TOOL_GROUPS,
  allCatalogTools,
  type ToolGroup,
} from './mcpToolCatalog';

// The same words the link preview carries (functions/_middleware.ts, MCP_PAGE_META).
const TITLE = 'Connect your assistant to Teajia';
const DESCRIPTION = 'Let Claude, ChatGPT or your own agent work a Teajia tea shop: bring teas in, price, invoice and send. Every change is shown first and happens only when you say yes.';

const SIGN_IN_CLIENTS = [
  { name: 'Claude', where: 'Settings, then Connectors, then Add custom connector. Paste the address.' },
  { name: 'ChatGPT', where: 'Settings, then Connectors, then Advanced, then Developer mode. Create, paste the address.' },
  { name: 'Grok', where: 'grok.com/connectors, then New Connector, then Custom. Paste the address.' },
];

const TOKEN_CLIENTS = [
  { name: 'Claude Code', where: 'The repository’s .mcp.json reads the token from TEAJIA_MCP_TOKEN.' },
  { name: 'Codex, Hermes or your own agent', where: 'Add a remote HTTP server with the address and an Authorization header.' },
];

const PROMISES = [
  { icon: Eye, title: 'You see it first', copy: 'Every change comes back as a preview. Nothing is written until you say yes to that exact preview.' },
  { icon: KeyRound, title: 'Only what you allow', copy: 'A connection reads, or also writes, only the parts you ticked. Prices and settings stay off unless you turn them on.' },
  { icon: Undo2, title: 'Kept and undoable', copy: 'Each change is recorded against the connection that made it, and Curate changes can be undone.' },
  { icon: ShieldCheck, title: 'Never in the chat', copy: 'A token lives in the assistant’s settings, never pasted into a conversation. Signing in needs no token at all.' },
];

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="rounded-xl border border-tea-border bg-tea-surface p-4">
      <p className="label-caps mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="min-w-0 flex-1 break-all text-ui-15 text-tea-text">{value}</code>
        <button type="button" onClick={copy} className="btn-secondary btn-sm tap-target gap-2" aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function ToolChips({ tools }: { tools: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {tools.map((tool) => (
        <code key={tool} className="rounded-md border border-tea-border bg-tea-bg px-2 py-1 text-ui-11 text-tea-text-sec">
          {tool}
        </code>
      ))}
    </div>
  );
}

function GroupRow({ group }: { group: ToolGroup }) {
  return (
    <li className="grid items-start gap-3 border-t border-tea-border py-6 md:grid-cols-[3rem_minmax(0,16rem)_minmax(0,1fr)] md:gap-6">
      <span className="hidden font-display text-ui-28 leading-none text-tea-gold md:block" aria-hidden="true">
        {group.step ?? '·'}
      </span>
      <div>
        <h3 className="text-ui-17 font-medium text-tea-text">
          {group.step && <span className="mr-2 font-display text-ui-22 text-tea-gold md:hidden">{group.step}</span>}
          {group.title}
        </h3>
        <p className="mt-1 text-ui-14 leading-[1.6] text-tea-text-sec">{group.copy}</p>
      </div>
      <div className="hidden md:block"><ToolChips tools={group.tools} /></div>
      {/* On a phone the names would be a wall: they open on a tap. */}
      <details className="md:hidden">
        <summary className="tap-target inline-flex cursor-pointer items-center text-ui-13 text-tea-gold">
          {group.tools.length} tools
        </summary>
        <div className="mt-2"><ToolChips tools={group.tools} /></div>
      </details>
    </li>
  );
}

export default function McpPage() {
  const toolCount = allCatalogTools().length;
  const steps = SHOP_TOOL_GROUPS.filter((group) => group.step);
  const rest = SHOP_TOOL_GROUPS.filter((group) => !group.step);

  return (
    <div className="min-h-[100dvh] bg-tea-bg text-tea-text">
      <Helmet>
        <title>{`${TITLE} · Teajia`}</title>
        <meta name="description" content={DESCRIPTION} />
      </Helmet>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 pb-nav-gap md:px-8 lg:gap-20 lg:py-16">
        {/* What it is */}
        <header className="max-w-3xl">
          <p className="label-caps mb-4">The Teajia connector</p>
          <h1 className="h1 text-tea-text">Run your tea shop from a conversation.</h1>
          <p className="body-prose mt-6 text-tea-text-sec">
            Connect Claude, ChatGPT or your own agent to your Teajia shop. It works the same records you do:
            it brings a sample in, prices it, writes the invoice and sends the parcel. Every change is shown
            to you first and happens only when you say yes.
          </p>
          <p className="mt-6 text-ui-14 text-tea-text-dim">
            {toolCount} tools across the whole shop, from the first sample to the cup after.
          </p>
        </header>

        {/* Connect */}
        <section aria-labelledby="connect" className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <p className="label-caps mb-3">Connect</p>
            <h2 id="connect" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>One address, two ways in</h2>
            <p className="mt-4 text-ui-15 leading-[1.7] text-tea-text-sec">
              Give your assistant this address. Apps you talk to ask you to sign in to Teajia and approve.
              Agents that run on their own take a token you make in Manage.
            </p>
            <div className="mt-6">
              <CopyLine label="Connector address" value={MCP_SERVER_URL} />
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-xl border border-tea-border bg-tea-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <LogIn size={17} className="text-tea-gold" />
                <h3 className="text-ui-17 font-medium text-tea-text">Sign in</h3>
                <span className="text-ui-12 text-tea-text-dim">no token to copy</span>
              </div>
              <ul className="space-y-3">
                {SIGN_IN_CLIENTS.map((client) => (
                  <li key={client.name} className="text-ui-14 leading-[1.6] text-tea-text-sec">
                    <span className="font-medium text-tea-text">{client.name}.</span> {client.where}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-ui-13 leading-[1.6] text-tea-text-dim">
                The app opens Teajia, you sign in, choose what it may do, and approve.
              </p>
            </article>

            <article className="rounded-xl border border-tea-border bg-tea-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={17} className="text-tea-gold" />
                <h3 className="text-ui-17 font-medium text-tea-text">Token</h3>
                <span className="text-ui-12 text-tea-text-dim">for agents that run on their own</span>
              </div>
              <ul className="space-y-3">
                {TOKEN_CLIENTS.map((client) => (
                  <li key={client.name} className="text-ui-14 leading-[1.6] text-tea-text-sec">
                    <span className="font-medium text-tea-text">{client.name}.</span> {client.where}
                  </li>
                ))}
              </ul>
              <code className="mt-4 block break-all rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-13 text-tea-text">
                Authorization: Bearer tjmcp_...
              </code>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link to="/admin/mcp-tokens" className="btn-primary btn-sm tap-target">Make a token</Link>
                <span className="text-ui-13 text-tea-text-dim">Shop owners only. It is shown once.</span>
              </div>
            </article>
          </div>
        </section>

        {/* Safety */}
        <section aria-labelledby="safety">
          <p className="label-caps mb-3">Safety</p>
          <h2 id="safety" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Nothing changes without you</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((item) => (
              <article key={item.title} className="rounded-xl border border-tea-border bg-tea-surface p-5">
                <item.icon size={18} className="mb-4 text-tea-gold" />
                <h3 className="mb-2 text-ui-16 font-medium text-tea-text">{item.title}</h3>
                <p className="text-ui-13 leading-[1.6] text-tea-text-sec">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* What it can do */}
        <section aria-labelledby="tools">
          <p className="label-caps mb-3">What it can do</p>
          <h2 id="tools" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>A tea’s whole way through the shop</h2>
          <p className="mt-4 max-w-2xl text-ui-15 leading-[1.7] text-tea-text-sec">
            The same ten steps a tea takes in Teajia, from the day it is found to the day someone drinks it and comes back.
            An assistant sees only the tools its connection allows.
          </p>
          <ol className="mt-8 border-b border-tea-border">
            {steps.map((group) => <GroupRow key={group.title} group={group} />)}
          </ol>

          <h3 className="mt-12 text-ui-19 font-medium text-tea-text">Around the shop</h3>
          <ul className="mt-4 border-b border-tea-border">
            {rest.map((group) => <GroupRow key={group.title} group={group} />)}
          </ul>

          <h3 className="mt-12 text-ui-19 font-medium text-tea-text">For hosts and members</h3>
          <ul className="mt-4 border-b border-tea-border">
            <GroupRow group={HOST_TOOL_GROUP} />
            <GroupRow group={PERSONAL_TOOL_GROUP} />
          </ul>
        </section>

        {/* Public */}
        <section aria-labelledby="public" className="grid gap-6 rounded-xl border border-tea-border bg-tea-surface p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag size={17} className="text-tea-gold" />
              <p className="label-caps">For shoppers</p>
            </div>
            <h2 id="public" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Ask your assistant for a tea</h2>
            <p className="mt-4 text-ui-15 leading-[1.7] text-tea-text-sec">
              Anyone can connect this one, with no sign-in. It reads the shop&rsquo;s public teas and prices, and makes a
              WhatsApp message ready to send. It never places an order: every order is a conversation with a person.
            </p>
          </div>
          <div className="grid gap-4">
            <CopyLine label="Public address" value={MCP_PUBLIC_URL} />
            <ToolChips tools={PUBLIC_TOOLS} />
          </div>
        </section>
      </div>
    </div>
  );
}
