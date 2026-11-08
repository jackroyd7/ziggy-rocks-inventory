# Ziggy Rocks

Inventory, cleaning checklists and issue log for the Ziggy Rocks rental property.

The app is published as a claude.ai Artifact: https://claude.ai/artifact/AjdgumWnz341c29D5VPzfU

`app/ziggy-rocks.html` is its source. It uses the Artifact runtime for:

- **db**: shared records (`inventory`, `cleans`, `issues`, `config/template`)
- **assets**: photo storage for issues, inventory items and floor plans (Contributors can upload)
- **sample** (with images): Claude identifies and counts items in photos

## Tabs

- **Inventory**: items grouped by room with quantity, condition, notes, last-checked date and a photo.
  Use "Add items from photos" to have Claude list and count what is in a photo (for example a cutlery
  drawer). You review the list before it is saved, and items already listed are updated, not duplicated.
- **Cleaning**: start a dated changeover from one of two checklists based on the owner-to-guest
  checklist doc: "Owners leaving → guests arriving" and "Guests leaving → owners arriving". Tick tasks off
  room by room and add notes. Floor plans and the checklist editor are at the bottom of the tab.
- **Issues**: log things that need sorting, with room, priority, date, notes and photos.
  Move each issue through open, in progress and resolved.
