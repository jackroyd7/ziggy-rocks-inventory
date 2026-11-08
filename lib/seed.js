// Starting data, from the "Ziggy owner to guest checklist" doc.
export const SEED_CHECKLISTS = [
  {
    "id": "owner-to-guest",
    "name": "Owners leaving → guests arriving",
    "tasks": [
      {
        "id": "t001",
        "room": "Kitchen",
        "task": "Empty the main kitchen fridge/freezer and move frozen food to the utility freezer"
      },
      {
        "id": "t002",
        "room": "Kitchen",
        "task": "Leave condiments and non-perishables where they are in the cupboards"
      },
      {
        "id": "t003",
        "room": "Utility room",
        "task": "Check the washer-dryer is empty; fold dry owner clothes and towels neatly into the locked cupboard"
      },
      {
        "id": "t004",
        "room": "Utility room",
        "task": "Check the utility fridge/freezer holds owner items only"
      },
      {
        "id": "t005",
        "room": "Utility room",
        "task": "Check the sign telling guests the owner freezer is not for their use is up"
      },
      {
        "id": "t006",
        "room": "Utility room",
        "task": "Leave dog food, bed and belongings where they are"
      },
      {
        "id": "t007",
        "room": "Boot room (dry room)",
        "task": "Move all coats, boots and other belongings to the locked cupboard"
      },
      {
        "id": "t008",
        "room": "Bedroom 1 (master)",
        "task": "Strip owners’ linen; wash it in the office and keep it until guests leave"
      },
      {
        "id": "t009",
        "room": "Bedroom 1 (master)",
        "task": "Put owners’ clothes away neatly in the locked cupboard"
      },
      {
        "id": "t010",
        "room": "Bedroom 1 (master)",
        "task": "Move owners’ toiletries into baskets in the locked cupboard"
      },
      {
        "id": "t011",
        "room": "Bedroom 2",
        "task": "Strip owners’ linen; wash it in the office and keep it until guests leave"
      },
      {
        "id": "t012",
        "room": "Bedroom 2",
        "task": "Put owners’ clothes away neatly in the locked cupboard"
      },
      {
        "id": "t013",
        "room": "Bedroom 2",
        "task": "Move owners’ toiletries into baskets in the locked cupboard"
      },
      {
        "id": "t014",
        "room": "Bedroom 3",
        "task": "Strip owners’ linen; wash it in the office and keep it until guests leave"
      },
      {
        "id": "t015",
        "room": "Bedroom 3",
        "task": "Put owners’ clothes away neatly in the locked cupboard"
      },
      {
        "id": "t016",
        "room": "Bedroom 3",
        "task": "Move owners’ toiletries into baskets in the locked cupboard"
      },
      {
        "id": "t017",
        "room": "Bedroom 4 (bunk room)",
        "task": "Keep kids’ clothes in one set of drawers"
      },
      {
        "id": "t018",
        "room": "Bedroom 4 (bunk room)",
        "task": "Put kids’ toys away, indoor and outdoor"
      },
      {
        "id": "t019",
        "room": "Main bathroom",
        "task": "Move owners’ toiletries into baskets in the locked cupboard"
      },
      {
        "id": "t020",
        "room": "General",
        "task": "Empty every bin and take the rubbish out of the house"
      },
      {
        "id": "t021",
        "room": "Outside",
        "task": "Put away any toys left outside"
      }
    ]
  },
  {
    "id": "guest-to-owner",
    "name": "Guests leaving → owners arriving",
    "tasks": [
      {
        "id": "t022",
        "room": "Bedroom 1 (master)",
        "task": "Put owners’ linen back on the bed"
      },
      {
        "id": "t023",
        "room": "Bedroom 1 (master)",
        "task": "Hang owners’ clothes back in the wardrobes (master bedroom only)"
      },
      {
        "id": "t024",
        "room": "Bedroom 2",
        "task": "Put owners’ linen back on the bed"
      },
      {
        "id": "t025",
        "room": "Bedroom 3",
        "task": "Put owners’ linen back on the bed"
      },
      {
        "id": "t026",
        "room": "Bathrooms",
        "task": "Put each bathroom’s owner toiletry basket back under the basin"
      },
      {
        "id": "t027",
        "room": "Utility room",
        "task": "Leave owners’ frozen food in the utility freezer for the owners to move"
      }
    ]
  }
];

export const SEED_ISSUES = [
  {
    "id": "doc-locked-cupboards",
    "createdAt": 1794150000001,
    "date": "2026-11-08",
    "notes": "From the changeover checklist: do we need more than one locked cupboard?\nSuggestion: 2 locked cupboards, one for clothes and one for owners' towels.",
    "photos": [],
    "priority": "medium",
    "resolved": "",
    "room": "General",
    "status": "open",
    "title": "Decide how many locked cupboards are needed"
  },
  {
    "id": "doc-hanging-space",
    "createdAt": 1794150000002,
    "date": "2026-11-08",
    "notes": "From the changeover checklist: do we need more hanging space in the locked cupboard (master bedroom), and in the wardrobes in bedrooms 2 and 3?",
    "photos": [],
    "priority": "medium",
    "resolved": "",
    "room": "Bedroom 1 (master)",
    "status": "open",
    "title": "More hanging space for owners' clothes"
  },
  {
    "id": "doc-storage-baskets",
    "createdAt": 1794150000003,
    "date": "2026-11-08",
    "notes": "Suggestion: owners to buy storage baskets so toiletries and belongings are easy to move. Each basket needs a room-numbered label.\nThe checklist also asks whether toiletries should go in baskets in the locked cupboard (bedrooms 1 to 3 and the main bathroom).",
    "photos": [],
    "priority": "medium",
    "resolved": "",
    "room": "General",
    "status": "open",
    "title": "Buy storage baskets with room labels"
  },
  {
    "id": "doc-freezer-signs",
    "createdAt": 1794150000004,
    "date": "2026-11-08",
    "notes": "From the changeover checklist: Nook to make signs so guests know the owner freezer is not for their use.",
    "photos": [],
    "priority": "medium",
    "resolved": "",
    "room": "Utility room",
    "status": "open",
    "title": "Make 'owners only' signs for the utility freezer"
  },
  {
    "id": "doc-dog-belongings",
    "createdAt": 1794150000005,
    "date": "2026-11-08",
    "notes": "From the changeover checklist: keep them where they are while guests stay?",
    "photos": [],
    "priority": "low",
    "resolved": "",
    "room": "Utility room",
    "status": "open",
    "title": "Decide where the dog's food, bed and belongings go"
  },
  {
    "id": "doc-toys",
    "createdAt": 1794150000006,
    "date": "2026-11-08",
    "notes": "From the changeover checklist: check toys are put away, but where? Applies to indoor toys and to toys left outside.",
    "photos": [],
    "priority": "low",
    "resolved": "",
    "room": "Bedroom 4 (bunk room)",
    "status": "open",
    "title": "Decide where kids' toys go, indoor and outdoor"
  },
  {
    "id": "doc-kids-clothes",
    "createdAt": 1794150000007,
    "date": "2026-11-08",
    "notes": "Suggestion: keep owners' kids' clothes in the chest of drawers and let guests use the kids' wardrobe drawers?",
    "photos": [],
    "priority": "low",
    "resolved": "",
    "room": "Bedroom 4 (bunk room)",
    "status": "open",
    "title": "Kids' clothes: which drawers stay for the owners"
  },
  {
    "id": "doc-boot-room",
    "createdAt": 1794150000008,
    "date": "2026-11-08",
    "notes": "Do we move owners' belongings into the locked cupboards if they fit? Ideas welcome for when guests stay.",
    "photos": [],
    "priority": "medium",
    "resolved": "",
    "room": "Boot room (dry room)",
    "status": "open",
    "title": "Boot room shelves are full"
  }
];
