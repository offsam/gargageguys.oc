/** Seed inventory from Garage Guys physical stock sheet. Qty starts on one tech van. */

export type SeedStockItem = {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  qty: number;
};

export const SEED_STOCK_ITEMS: SeedStockItem[] = [
  // Motors
  { sku: "MOT-LM-2420L-7", name: "LM 2420L 7-ft", category: "Motors", qty: 1 },
  { sku: "MOT-LM-6690L-267-7", name: "LM 6690L-267 7-ft", category: "Motors", qty: 1 },
  { sku: "MOT-LM-98022", name: "LM 98022 (Jackshaft)", category: "Motors", qty: 0 },
  { sku: "MOT-CH-B3010", name: "Chamberlain B3010", category: "Motors", qty: 2 },
  { sku: "MOT-LM-BELT-8", name: "LM 8-ft belt rail", category: "Motors", qty: 1 },
  { sku: "MOT-LM-BELT-7", name: "LM 7-ft belt rail", category: "Motors", qty: 0 },
  { sku: "MOT-CH-BELT-7", name: "Chamberlain 7' belt rail", category: "Motors", qty: 0 },
  { sku: "MOT-LM-CHAIN-7", name: "LM 7-ft chain rail", category: "Motors", qty: 0 },

  // Springs
  { sku: "SPR-207-27-PAIR", name: "207*27 (pair)", category: "Springs", qty: 2 },
  { sku: "SPR-207-27-RED", name: "207*27 (red)", category: "Springs", qty: 1 },
  { sku: "SPR-218-28-PAIR", name: "218*28 (pair)", category: "Springs", qty: 3 },
  { sku: "SPR-218-28-RED", name: "218*28 (red)", category: "Springs", qty: 0 },
  { sku: "SPR-225-28-PAIR", name: "225*28 (pair)", category: "Springs", qty: 3 },
  { sku: "SPR-225-28-BLK", name: "225*28 (blk)", category: "Springs", qty: 0 },
  { sku: "SPR-234-30-PAIR", name: "234*30 (pair)", category: "Springs", qty: 3 },
  { sku: "SPR-234-30-RED", name: "234*30 (red)", category: "Springs", qty: 0 },
  { sku: "SPR-243-33-PAIR", name: "243*33 (pair)", category: "Springs", qty: 1 },
  { sku: "SPR-243-33-BLK", name: "243*33 (blk)", category: "Springs", qty: 1 },
  { sku: "SPR-250-33-PAIR", name: "250*33 (pair)", category: "Springs", qty: 2 },
  { sku: "SPR-250-33-BLK", name: "250*33 (blk)", category: "Springs", qty: 0 },
  { sku: "SPR-262-34-PAIR", name: "262*34 (pair)", category: "Springs", qty: 1 },
  { sku: "SPR-262-34-RED", name: "262*34 (red)", category: "Springs", qty: 0 },
  { sku: "SPR-728", name: "728 (single)", category: "Springs", qty: 4 },
  { sku: "SPR-928", name: "928 (single)", category: "Springs", qty: 2 },
  { sku: "SPR-730", name: "730 (single)", category: "Springs", qty: 0 },
  { sku: "SPR-WHOOK", name: "W Hook", category: "Springs", qty: 4 },

  // Misc
  { sku: "MSC-ROL-4", name: 'Rollers 4"', category: "Misc", qty: 20 },
  { sku: "MSC-ROL-Z-4", name: 'Rollers Z Bearing 4"', category: "Misc", qty: 20 },
  { sku: "MSC-ROL-7", name: 'Rollers 7"', category: "Misc", qty: 17 },
  { sku: "MSC-SEAL-BLK-4", name: 'Bottom seal (blk 4")', category: "Misc", qty: 1 },
  { sku: "MSC-SEAL-GRY-4", name: 'Bottom seal (gray 4")', category: "Misc", qty: 1 },
  { sku: "MSC-SEAL-GRY-6", name: 'Bottom seal (gray 6")', category: "Misc", qty: 0 },
  { sku: "MSC-SEAL-WOOD-16", name: "Bottom seal wood door 16ft", category: "Misc", qty: 0 },
  { sku: "MSC-RET-T-16", name: "Bottom retainer (T shape 16-ft)", category: "Misc", qty: 0 },
  { sku: "MSC-RET-L-138-16", name: 'Bottom retainer 1-3/8 (L shape 16-ft)', category: "Misc", qty: 0 },
  { sku: "MSC-RET-L-178-16", name: 'Bottom retainer 1-7/8 (L shape 16-ft)', category: "Misc", qty: 1 },
  { sku: "MSC-EMERG-LOCK", name: "Emergency release lock", category: "Misc", qty: 2 },
  { sku: "MSC-TLOCK", name: "T-lock", category: "Misc", qty: 1 },
  { sku: "MSC-TLOCK-HDL", name: "T-lock handle", category: "Misc", qty: 0 },
  { sku: "MSC-SLIDE-LOCK", name: "Slide lock", category: "Misc", qty: 1 },
  { sku: "MSC-CAB-7", name: "Cable 7-ft", category: "Misc", qty: 3 },
  { sku: "MSC-CAB-8", name: "Cable 8-ft", category: "Misc", qty: 2 },
  { sku: "MSC-ENDPL", name: "End plates", category: "Misc", qty: 3 },
  { sku: "MSC-ENDPL-LH", name: "End plates (low headroom)", category: "Misc", qty: 1 },
  { sku: "MSC-CTR-BRG", name: "Center bearing", category: "Misc", qty: 3 },
  { sku: "MSC-CTR-BRG-NYL", name: "Nylon center bearing", category: "Misc", qty: 2 },
  { sku: "MSC-DRM-8", name: "Drums 8ft", category: "Misc", qty: 2 },
  { sku: "MSC-DRM-12", name: "Drums 12ft", category: "Misc", qty: 1 },
  { sku: "MSC-STRUT-16", name: "Strut 16-ft", category: "Misc", qty: 3 },
  { sku: "MSC-STRUT-8", name: "Strut 8-ft", category: "Misc", qty: 0 },
  { sku: "MSC-TUBE-16", name: "Torsion tube 16-ft", category: "Misc", qty: 1 },
  { sku: "MSC-TUBE-16-11G", name: "Torsion tube 16-ft (11g)", category: "Misc", qty: 0 },
  { sku: "MSC-VTRACK-7", name: "Vertical tracks 7-ft", category: "Misc", qty: 1 },

  // Liftmaster
  { sku: "LM-889-WALL", name: "889 LM wall console", category: "Liftmaster", qty: 1 },
  { sku: "LM-BELT-7-OLD", name: "LM 7-ft Belt (041a3589-3) old style", category: "Liftmaster", qty: 2 },
  { sku: "LM-BELT-8-OLD", name: "LM 8-ft Belt (041a3589-1) old style", category: "Liftmaster", qty: 1 },
  { sku: "LM-BELT-7-NEW", name: "LM 7-ft Belt (041a5434-11A) new style", category: "Liftmaster", qty: 1 },
  { sku: "LM-BELT-8-NEW", name: "LM 8-ft Belt (041a5434-13A) new style", category: "Liftmaster", qty: 1 },
  { sku: "LM-PHOTO", name: "LM photo eye", category: "Liftmaster", qty: 2 },
  { sku: "LM-GEAR-CHAIN", name: "LM gear sprocket chain (041C4220A)", category: "Liftmaster", qty: 1 },
  { sku: "LM-GEAR-BELT", name: "LM gear sprocket belt (041A4885-5)", category: "Liftmaster", qty: 0 },
  { sku: "LM-COUPLER", name: "LM coupler", category: "Liftmaster", qty: 3 },
  { sku: "LM-SCREW-RACK", name: "LM screw drive rack", category: "Liftmaster", qty: 0 },

  // Liftmaster remotes/keypads
  { sku: "LM-380UT", name: "LM 380UT remote", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 5 },
  { sku: "LM-891", name: "LM 891 remote", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },
  { sku: "LM-893", name: "LM 893 remote", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },
  { sku: "LM-878MAX", name: "LM 878 MAX keypad", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 2 },
  { sku: "LM-L979M", name: "LM L979M keypad", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 3 },
  { sku: "LM-L992U", name: "LM L992U remote", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 2 },
  { sku: "LM-CH361", name: "CH361 remote", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },
  { sku: "LM-850-RX", name: "850 LM receiver", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },
  { sku: "LM-85-XFMR", name: "85 LM transformer", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },
  { sku: "LM-365-RX", name: "365 LM receiver", category: "Liftmaster", subcategory: "Remote/Keypad", qty: 0 },

  // Genie
  { sku: "GN-CAP-19988A", name: "GN capacitor 1/2hp (19988A)", category: "Genie", qty: 2 },
  { sku: "GN-PHOTO", name: "GN photo eye", category: "Genie", qty: 2 },
  { sku: "GN-TROLLEY", name: "GN trolley (screw drive)", category: "Genie", qty: 3 },
  { sku: "GN-COUPLER", name: "GN coupler", category: "Genie", qty: 0 },
  { sku: "GN-GK-BX", name: "GK-BX keypad", category: "Genie", subcategory: "Remote/Keypad", qty: 1 },

  // Marantec
  { sku: "MT-PHOTO", name: "Mtec photo eye", category: "Marantec", qty: 1 },
  { sku: "MT-REMOTE", name: "Mtec remotes", category: "Marantec", qty: 2 },

  // Hinges/Brackets
  { sku: "HNG-1", name: "Hinge #1", category: "Hinges/Brackets", qty: 5 },
  { sku: "HNG-2", name: "Hinge #2", category: "Hinges/Brackets", qty: 4 },
  { sku: "HNG-3", name: "Hinge #3", category: "Hinges/Brackets", qty: 4 },
  { sku: "HNG-4", name: "Hinge #4", category: "Hinges/Brackets", qty: 4 },
  { sku: "HNG-5", name: "Hinge #5", category: "Hinges/Brackets", qty: 2 },
  { sku: "BRK-BOTTOM", name: "Bottom brackets", category: "Hinges/Brackets", qty: 2 },
  { sku: "BRK-TOP", name: "Top brackets (single)", category: "Hinges/Brackets", qty: 2 },
  { sku: "BRK-TOP-LH", name: "Top brackets low head (single)", category: "Hinges/Brackets", qty: 2 },
  { sku: "BRK-SPR-CTR", name: "Spring center bracket", category: "Hinges/Brackets", qty: 2 },
  { sku: "BRK-JAMB-8", name: "Jamb brackets #8", category: "Hinges/Brackets", qty: 4 },
  { sku: "BRK-ORB", name: "Orb bracket", category: "Hinges/Brackets", qty: 2 },
];
