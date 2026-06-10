# Get the Teajia voice assistant connecting from a phone

The voice and agent control (MCP) works on desktop via manually minted tokens. On a phone it reaches the consent page on teajia.com but reports that the query parameters are missing, so the connection never completes.

## What is needed

One screenshot of the failing consent page's URL bar, taken from the phone. That single piece of evidence identifies which of three candidate causes applies, and the fix follows from there.

## Full briefing and resume protocol

[docs/MCP_MOBILE_OAUTH_TODO.md](../../docs/MCP_MOBILE_OAUTH_TODO.md)

## Context

The MCP voice and agent server is live at the worker `/mcp` endpoint. All seven Phase 1 tools ship and the sale path runs the full fulfilment flow. This is the last gap before the assistant is usable from a phone.
