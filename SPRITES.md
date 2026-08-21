# Kane & ABLE Sprite Integration

The app uses generated retro pixel-art character sprites as state-driven UI portraits rather than gameplay avatars.

## Kane
- idle → idle sprite
- exploring → magnifying-glass investigation sprite
- failed verification / evidence → evidence-card sprite
- successful verification → victory sprite

## ABLE
- smug → smug sprite
- amused → showman sprite
- concerned → smug sprite
- defensive / humiliated → glitch sprite
- repairing → architect sprite
- vindicated → amused sprite

## Placement
Sprites appear in:
- ABLE's character card;
- a Kane-vs-ABLE live duel stage;
- the successful escape overlay.

`src/character-sprites.js` contains the mappings. CSS keeps the images pixel-sharp and adds subtle state-specific motion/glow effects.

The original generated sheets are retained under `assets/sprites/source/`.
