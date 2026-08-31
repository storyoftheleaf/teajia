# Order panel, design source

The design canvas behind the public cart and order panel
(`src/components/shared/PublicCart.tsx` and `CartItem.tsx`).

- `Main.dc.html` is the artboard: a working 390x844 prototype of the panel,
  with the weight buttons, the custom amount and remove all live.
- `canvas.json` places it and carries the notes explaining what changed
  and why.

Both are the source. The published page is a 2.4 MB file with a whole editor
baked into it, which is generated from these two and therefore ignored rather
than committed. Rebuild and republish it with the `design` skill's helper,
passing this folder's two files.

Keep this in step with the components. The value of a design file that has
drifted from the screen it describes is negative: the next person trusts it
and is wrong.
