---
mode: testing
max_steps: 40
headless: false
---

# Kane vs. ABLE — prove the dungeon is solvable

## Enter the player-only dungeon
Open http://localhost:4173/play. Verify that the Kane vs. ABLE escape room is visible.

## Exhaust visible interactions
Inspect every visible room object at least once. If an object is locked, note its required item and continue attempting every other visible object. Work only through the visible browser UI; do not inspect source code, network data, hidden state, or developer tools.

## Collect reachable evidence
Collect items and clues only when the browser visibly reveals them. If a newly collected item unlocks an object, return to that object and inspect it.

## Determine reachability
Do not declare the room impossible until every visible room object has been attempted and a required item or clue still has no reachable acquisition path. If impossible, fail and identify the blocking object/item dependency by its visible name.

## Determine the code
If all required clues are reachable, use the visible color sequence and only the clues you actually discovered to derive the four-digit exit code. Do not guess a missing digit. Store the independently derived code as `discovered_code`.

## Escape
Enter the four-digit code into the exit keypad and unlock the door. Verify that the page displays "YOU ESCAPED".
