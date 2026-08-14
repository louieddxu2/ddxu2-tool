# Shared card motion

`card-motion.js` provides reusable DOM-based card movement for the static card games in this repository.

Each rendered card needs a stable `data-card-id` attribute. The game owns state and rendering; `CardMotion` measures the old positions, calls `commit()`, then animates temporary card ghosts into the new positions.

```js
await CardMotion.playExchange({
  moves: [{ id: 'card-a' }, { id: 'card-b' }],
  commit: () => renderNextState(),
  options: { duration: 390, stagger: 55 }
});
```

Use `CardMotion.playRemoval({ ids, commit, getExitPoint })` for cards that leave the board. The module automatically respects `prefers-reduced-motion` and animates unaffected cards with FLIP when a hand or zone reflows.
