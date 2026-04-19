# AAF dormant world components

This folder is reserved for world-page UI experiments that may be reused later
but must not be imported by the active app.

Component lifecycle tags:

- `active:list-surface`: mounted in the right-side system panel and kept short.
- `active:combat-focus-panel`: mounted in combat pages for initiative and round flow only.
- `active:overlay-tool`: mounted only after a player opens a modal or shortcut.
- `dormant:*`: preserved for reference, but never imported from routed pages.

If a UI idea is replaced but might return later, move it here or document it in
the world blueprint instead of leaving it mounted or mixed into active panels.
