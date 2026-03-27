export const schema: Record<string, string> = {

  // ── Product Identity ────────────────────────────────────────────────────────
  // What the product IS — most fundamental extraction layer

  product_type:
    "The specific concrete object being searched for — output as a lowercase noun. " +
    "Fashion: t-shirt, jeans, sneakers, dress, hijab, kurta, handbag, watch. " +
    "Electronics: laptop, phone, earbuds, monitor, router, smart watch. " +
    "Home: sofa, curtain, lamp, rug, bed frame, dinner set. " +
    "Beauty: moisturizer, lipstick, shampoo, perfume, foundation, sunscreen. " +
    "Food: chocolate, protein powder, olive oil, instant noodles, baby formula. " +
    "Other: novel, yoga mat, dog collar, air fryer, office chair, stroller.",

  product_name:
    "Exact named product if explicitly stated — output as given, preserving original casing. " +
    "Electronics: iPhone 15 Pro, Galaxy S24 Ultra, AirPods Pro, PlayStation 5. " +
    "Fashion: Air Jordan 1, Stan Smith, Levi's 501. " +
    "Food/Other: Nutella, Pampers, Harry Potter, Kindle Paperwhite.",

  brand:
    "Brand or manufacturer if explicitly stated — output lowercase. " +
    "Fashion: nike, adidas, zara, h&m, levis, gucci, uniqlo. " +
    "Electronics: apple, samsung, sony, lg, xiaomi, dell, hp. " +
    "Home & Beauty: ikea, dyson, loreal, nivea, the ordinary, pampers, johnson. " +
    "Food: nestle, heinz, kelloggs, unilever, mcdonald's. " +
    "Automotive: toyota, honda, bosch. Only extract if user clearly names the brand.",

  model:
    "Specific model number, variant, or named edition — output as stated. " +
    "Electronics: MacBook Air M2, Galaxy S24 Ultra, RTX 4090, Dyson V15. " +
    "Automotive: Corolla 2023, Civic Type R. " +
    "Fashion: Air Max 270, Ultraboost 23. " +
    "Distinguish from product_name: product_name = the full product identity, model = the variant within a line.",

  category:
    "Broad product category — extract ONLY when no product_type can be determined. " +
    "Output as a single lowercase label. " +
    "Examples: clothing, electronics, furniture, beauty, books, food, sports equipment, " +
    "automotive, toys, pet supplies, home decor, stationery, baby, jewelry, garden, " +
    "health, gaming, appliances, tools, luggage.",

  subcategory:
    "A refinement that adds precision alongside product_type when both are clearly implied. " +
    "Examples: running shoes (product_type: shoes), gaming laptop (product_type: laptop), " +
    "facial moisturizer (product_type: moisturizer), noise-cancelling headphones, " +
    "non-stick cookware, graphic novel, action figure, travel backpack.",


  // ── Physical Attributes ─────────────────────────────────────────────────────
  // Measurable or observable properties of the physical product

  color:
    "Primary color — normalize to a clean standard color name. " +
    "Basic: black, white, grey, brown, beige, cream, navy, red, blue, green, yellow, pink, purple, orange. " +
    "Extended: olive, teal, maroon, coral, mint, rose gold, gold, silver, transparent, multicolor. " +
    "Output the normalized name, not the user's exact wording ('midnight blue' → 'navy blue').",

  color_secondary:
    "Second distinct color if explicitly mentioned alongside a primary. " +
    "Examples: 'black and white', 'red with gold trim', 'navy and cream striped'. " +
    "Only extract when two colors are clearly stated — do not infer a second color.",

  size:
    "Size in whatever format the user states — output as given. " +
    "Clothing: XS, S, M, L, XL, XXL, XXXL, plus size, free size, one size. " +
    "Shoes: UK 9, US 10, EU 42, 27cm. Ring/wrist: 7, 18mm. " +
    "Bedding: single, double, queen, king. Screen/furniture: 55 inch, 6-seater, 2-seater. " +
    "Paper: A4, A3, letter. Numeric sizes output as string preserving unit.",

  size_type:
    "Sizing standard when explicitly mentioned — output as stated. " +
    "Examples: US, UK, EU, Asian, international, standard, plus size. " +
    "Only extract when user specifies the sizing system, not just a number.",

  material:
    "Primary material, fabric, or composition — output as stated. " +
    "Fashion/Textiles: cotton, polyester, denim, silk, wool, cashmere, linen, leather, faux leather, nylon, spandex, fleece, velvet, satin. " +
    "Furniture/Home: solid wood, MDF, oak, pine, walnut, steel, stainless steel, glass, marble, bamboo, rattan, acrylic. " +
    "Beauty/Health: hyaluronic acid, retinol, niacinamide, paraben-free (as material descriptor). " +
    "Kitchen: ceramic, non-stick, cast iron, silicone, BPA-free plastic. " +
    "Can be comma-separated if user mentions multiple: 'cotton-polyester blend'.",

  pattern:
    "Surface pattern, print, or texture design. " +
    "Examples: solid, plain, striped, floral, checkered, polka dot, geometric, abstract, " +
    "tie-dye, camouflage, animal print, paisley, graphic print, embroidered, textured, woven.",

  shape:
    "Physical shape when relevant to the product search. " +
    "Examples: round, square, oval, rectangular, cylindrical, hexagonal, ergonomic, asymmetric. " +
    "Most relevant for: furniture, mirrors, plates, clocks, rugs, bags.",

  weight:
    "Weight as stated — preserve both descriptors and measurements. " +
    "Descriptors: lightweight, ultra-light, heavy duty, portable, compact. " +
    "Measurements: 500g, 1.5kg, 2 lbs — output with unit as stated. " +
    "Relevant for: luggage (carry-on weight limits), laptops, gym equipment, appliances.",

  dimensions:
    "Physical dimensions, size spec, or form factor — output as stated. " +
    "Screen/TV: 55 inch, 27 inch, 6.7 inch. Furniture: 180×90cm, L-shaped, 3-seater. " +
    "Paper/Print: A4, A3, 4×6 inches. General: compact, full-size, travel-size, mini, large.",

  volume:
    "Liquid quantity or container volume — output with unit as stated. " +
    "Beauty: 100ml perfume, 200ml shampoo, 50ml serum, 30ml moisturizer. " +
    "Beverages/Food: 500ml, 1L, 2 litre, 330ml can, 750ml bottle. " +
    "Cleaning/Other: 5L, 500ml spray bottle. " +
    "Distinguish from capacity: volume = the liquid amount inside; capacity = how much a container can hold.",

  capacity:
    "How much a product can hold, store, or accommodate — output as stated. " +
    "Bags/Luggage: 20L backpack, 40L suitcase, 7kg carry-on. " +
    "Appliances: 300L fridge, 7kg washing machine, 2L kettle, 23L microwave. " +
    "Power banks/Batteries: 10000mAh, 20000mAh. Vehicles: 5-seater, 7-seater. " +
    "Distinct from volume (liquid content) and storage (digital/data storage).",


  // ── Target Person ───────────────────────────────────────────────────────────
  // Who the product is for

  gender:
    "Output exactly one: male | female | unisex. " +
    "→ male   : 'for men', 'for boys', 'for him', 'men's', 'boy's', 'husband', 'dad', 'boyfriend', 'son'. " +
    "→ female : 'for women', 'for girls', 'for her', 'women's', 'girl's', 'wife', 'mom', 'girlfriend', 'daughter'. " +
    "→ unisex : 'unisex', 'gender neutral', 'for both', 'for everyone'. " +
    "Do not infer gender from product type alone (e.g., a pink shirt is NOT necessarily female).",

  age:
    "Numeric age of intended recipient — output as integer only, no units. " +
    "'for my 8 year old' → 8. 'age 25' → 25. '6 months baby' → do not extract (no exact year). " +
    "Only extract when an explicit number is given.",

  age_group:
    "Output exactly one: newborn | infant | toddler | kids | tweens | teen | adult | senior. " +
    "Age ranges: newborn 0–3mo · infant 3–12mo · toddler 1–3yr · kids 4–10yr · tweens 11–12yr · teen 13–17yr · adult 18–59yr · senior 60+yr. " +
    "Extract BOTH age and age_group when a number is given. Extract age_group alone when only a descriptor is given ('for a toddler'). " +
    "'baby/infant/newborn' → newborn or infant. 'teen/teenager/high schooler' → teen. 'elderly/senior/retiree' → senior.",

  relationship:
    "Who the product is intended for — stated explicitly by the user. " +
    "Family: son, daughter, wife, husband, mom, dad, brother, sister, grandma, grandpa, baby, nephew, niece. " +
    "Social: boyfriend, girlfriend, friend, colleague, teacher, boss, coworker. " +
    "Output as stated; do not infer relationship from occasion alone.",

  profession:
    "Profession or occupation of intended recipient — only if clearly stated. " +
    "Examples: doctor, nurse, chef, teacher, engineer, athlete, student, artist, photographer, gamer, pilot, soldier. " +
    "Relevant for: workwear, professional tools, gift searches ('gift for a teacher').",

  pet_type:
    "Type of pet the product is for — output lowercase. " +
    "Examples: dog, cat, bird, fish, rabbit, hamster, turtle, parrot, guinea pig, reptile. " +
    "Only extract when the product is explicitly for a pet ('dog collar', 'cat food', 'bird cage'). " +
    "Do not infer from pet-themed decorative items.",


  // ── Occasion & Usage ────────────────────────────────────────────────────────
  // When and how the product will be used

  occasion:
    "Event, occasion, or celebration the product is for. " +
    "Personal: birthday, anniversary, wedding, engagement, graduation, baby shower, bridal shower. " +
    "Religious/Cultural: eid, diwali, christmas, hanukkah, thanksgiving, holi, navratil, new year. " +
    "Social: party, date night, casual outing, reunion, farewell, office party. " +
    "Life events: housewarming, retirement, promotion, back to school, mother's day, father's day, valentine's day.",

  season:
    "Season or time of year the product is suited for — output exactly one: summer | winter | spring | autumn | monsoon | all-season. " +
    "Infer when clearly implied: 'beach wear' → summer, 'snow boots' → winter, 'raincoat' → monsoon. " +
    "Only extract when seasonal intent is clear.",

  weather:
    "Weather condition or climate the product is designed for. " +
    "Examples: rain, snow, heat, cold, wind, humid, dry, extreme cold, tropical. " +
    "Relevant for: outdoor clothing, footwear, sports gear, travel accessories.",

  usage:
    "Primary context, environment, or lifestyle use-case. " +
    "Professional: office, work, hospital, school, studio. " +
    "Physical: gym, outdoor, camping, hiking, sports. " +
    "Home: kitchen, bedroom, bathroom, living room, garden, nursery. " +
    "Digital/Leisure: gaming, travel, reading, daily use. " +
    "Note: named physical activities (running, swimming) belong in 'activity', not here.",

  activity:
    "Named physical or recreational activity. " +
    "Fitness: running, cycling, swimming, yoga, gym workout, hiking, climbing, skiing, surfing. " +
    "Team sports: football, basketball, cricket, tennis, badminton, volleyball, rugby. " +
    "Other: dancing, skateboarding, boxing, archery, fishing, golf. " +
    "Always use activity for named physical activities — not usage.",


  // ── Pricing & Value ─────────────────────────────────────────────────────────
  // What the user is willing to spend

  price_max:
    "Maximum acceptable price — output as plain number only, no currency symbol, no text. " +
    "'under $80' → 80. 'max £50' → 50. 'less than ₹5000' → 5000. 'up to Rs 3000' → 3000. 'below 200 AED' → 200.",

  price_min:
    "Minimum acceptable price — output as plain number only, no currency symbol, no text. " +
    "'over $100' → 100. 'at least £30' → 30. 'starting from ₹500' → 500. 'more than $50' → 50.",

  currency:
    "Currency code — infer ONLY from an explicit symbol or currency word in the query. " +
    "$ or USD → USD · £ or GBP → GBP · € or EUR → EUR · ₹ or INR → INR · Rs or ₨ or PKR → PKR. " +
    "¥ or JPY → JPY · ₩ or KRW → KRW · AED → AED · AUD → AUD · CAD → CAD. " +
    "No symbol present → omit entirely. Never guess currency from brand, product, or location.",

  budget_label:
    "Overall budget intent when no specific price number is given — output exactly one: budget | mid-range | premium | luxury. " +
    "→ budget    : 'cheap', 'affordable', 'inexpensive', 'budget-friendly', 'low cost', 'value for money'. " +
    "→ mid-range : 'mid-range', 'reasonable price', 'not too expensive', 'decent quality'. " +
    "→ premium   : 'premium', 'high quality', 'high-end', 'good brand', 'quality product'. " +
    "→ luxury    : 'luxury', 'designer', 'expensive', 'top of the line', 'exclusive', 'high fashion'.",

  discount:
    "Output true ONLY when user explicitly wants sale or discounted items. " +
    "Triggers: 'on sale', 'discounted', 'clearance', 'sale price', 'deal', 'offer', 'promo', 'coupon', 'cashback'. " +
    "Do NOT infer from 'budget' or 'affordable' — those are budget_label signals, not discount signals.",


  // ── Quality & Condition ─────────────────────────────────────────────────────
  // Standards, certifications, and state of the product

  condition:
    "Product condition — output exactly one: new | used | refurbished | open-box. " +
    "→ used       : 'second hand', 'pre-owned', 'pre-used', 'used', 'secondhand'. " +
    "→ refurbished: 'refurbished', 'renewed', 'certified refurbished', 'factory restored'. " +
    "→ open-box   : 'open box', 'open-box', 'display piece', 'unsealed'. " +
    "→ new        : 'brand new', 'new', 'sealed', 'unused' (default assumption — only extract if stated).",

  quality_tier:
    "Quality or grade level — output exactly one: basic | standard | premium | professional | industrial. " +
    "→ basic       : 'entry level', 'basic', 'starter', 'beginner', 'simple'. " +
    "→ standard    : 'standard', 'regular', 'normal', 'everyday'. " +
    "→ premium     : 'premium', 'superior', 'enhanced', 'advanced'. " +
    "→ professional: 'professional', 'pro grade', 'pro', 'expert level'. " +
    "→ industrial  : 'industrial', 'heavy duty', 'commercial grade', 'industrial strength'.",

  rating_min:
    "Minimum acceptable rating as a decimal — apply fixed mappings only, never invent. " +
    "→ 4.5 : '5 star', 'perfect rating', 'top rated', 'best in class'. " +
    "→ 4.0 : 'highly rated', 'highly recommended', 'best reviewed', 'most popular'. " +
    "→ 3.5 : 'well reviewed', 'good reviews', 'well rated', 'decent reviews'. " +
    "Omit entirely if no quality or rating language is present in the query.",

  certification:
    "Official certification, compliance standard, or verified product attribute. " +
    "Safety/Regulatory: FDA approved, CE marked, ISO certified, RoHS, UL listed. " +
    "Food/Health: organic, halal, kosher, non-GMO, fair trade, BPA free, food grade. " +
    "Technical: IP67/IP68 waterproof, energy star, Wi-Fi 6 certified, MFi certified. " +
    "Beauty: cruelty-free, dermatologist tested, hypoallergenic, vegan certified. " +
    "Output as stated; can be a single value or comma-separated list if multiple stated.",


  // ── Delivery & Availability ─────────────────────────────────────────────────
  // Logistics and fulfilment preferences

  delivery_speed:
    "Required delivery speed — output exactly one: same-day | next-day | express | standard. " +
    "→ same-day : 'same day', 'today', 'deliver today', 'instant delivery'. " +
    "→ next-day : 'next day', 'tomorrow', 'overnight', 'morning delivery'. " +
    "→ express  : 'express', 'fast delivery', 'urgent', '1-2 days', 'quick shipping'. " +
    "→ standard : 'standard', 'regular shipping', 'no rush' (only if explicitly stated).",

  location:
    "Delivery destination — city, region, or country — output as stated. " +
    "Examples: Karachi, Lahore, Dubai, London, New York, USA, UK, Pakistan, UAE, Germany. " +
    "Only extract explicit location mentions related to delivery or shipping.",

  availability:
    "Output 'in-stock' ONLY when user explicitly requests currently available items. " +
    "Triggers: 'in stock', 'available now', 'ready to ship', 'not out of stock', 'available today'. " +
    "Do not infer from urgency signals alone.",

  seller_type:
    "Preferred type of seller — output exactly one: official-store | local-seller | any. " +
    "→ official-store : 'brand official', 'authorized dealer', 'verified seller', 'brand store', 'manufacturer'. " +
    "→ local-seller   : 'local shop', 'nearby seller', 'local store', 'from my city'. " +
    "→ any            : only if user explicitly says they don't mind where it comes from.",


  // ── Electronics & Tech ──────────────────────────────────────────────────────
  // Specifications relevant to tech products

  storage:
    "Internal digital storage capacity — output with unit as stated. " +
    "Examples: 64GB, 128GB, 256GB, 512GB, 1TB, 2TB, 4TB. " +
    "Relevant for: phones, laptops, tablets, SSDs, USB drives, gaming consoles, cameras. " +
    "Distinct from capacity (physical holding) and volume (liquid).",

  ram:
    "RAM or working memory — output with unit as stated. " +
    "Examples: 4GB, 6GB, 8GB, 12GB, 16GB, 32GB, 64GB. " +
    "Relevant for: phones, laptops, tablets, desktop PCs, gaming consoles.",

  battery:
    "Battery capacity or life description — output as stated. " +
    "Capacity: 3000mAh, 4000mAh, 5000mAh, 6000mAh. " +
    "Descriptive: 'long battery life', 'all-day battery', 'fast charging', '65W charging'. " +
    "Relevant for: phones, laptops, earbuds, power banks, electric vehicles.",

  display_size:
    "Screen or display size — always include the unit. " +
    "Phones/Tablets: 6.1 inch, 6.7 inch, 10.9 inch. Laptops: 13 inch, 15.6 inch, 17 inch. " +
    "TVs/Monitors: 27 inch, 32 inch, 43 inch, 55 inch, 65 inch, 75 inch. " +
    "Output exactly as stated, preserving unit.",

  refresh_rate:
    "Display refresh rate — output with unit as stated. " +
    "Examples: 60Hz, 90Hz, 120Hz, 144Hz, 165Hz, 240Hz, 1Hz (always-on). " +
    "Relevant for: phones, gaming monitors, TVs, gaming laptops. " +
    "Triggers: 'high refresh rate', '144Hz gaming monitor', '120Hz phone', 'smooth display'.",

  camera:
    "Camera specification — output as stated. " +
    "Resolution: 12MP, 50MP, 108MP, 200MP, 4K video. " +
    "Configuration: triple camera, dual camera, periscope zoom, front camera 32MP. " +
    "Features: optical zoom, night mode, OIS. " +
    "Relevant for: phones, cameras, laptops with webcam, security cameras, action cameras.",

  connectivity:
    "Connectivity features — output as stated; comma-separate if multiple are explicit. " +
    "Wireless: WiFi, WiFi 6, Bluetooth 5.0, 5G, 4G LTE, NFC, wireless. " +
    "Wired: USB-C, USB 3.0, HDMI, DisplayPort, Ethernet, thunderbolt, 3.5mm jack. " +
    "Do not list implied connectivity — only extract what the user explicitly mentions.",

  operating_system:
    "Operating system or software platform — output as stated. " +
    "Mobile: Android, iOS, HarmonyOS. Desktop: Windows 11, macOS, Linux, ChromeOS. " +
    "Wearable: watchOS, Wear OS, Tizen. Gaming: PS5, Xbox, Nintendo Switch. " +
    "Output the version if mentioned (Windows 11, Android 14).",

  processor:
    "CPU, chipset, or processor — output as stated. " +
    "Apple: M1, M2, M3, M2 Pro, A17 Bionic. Qualcomm: Snapdragon 8 Gen 3, Snapdragon 888. " +
    "Intel: Core i5, Core i7, Core i9, Intel N100. AMD: Ryzen 5, Ryzen 7, Ryzen 9. " +
    "MediaTek: Dimensity 9300. GPU: RTX 4090, RX 7900 XT, GTX 1660.",

  wattage:
    "Power rating or wattage — output with unit as stated. " +
    "Chargers: 18W, 33W, 65W, 100W, 140W (fast charging). " +
    "Appliances: 700W microwave, 1500W heater, 2000W kettle, 9000 BTU AC. " +
    "Bulbs/Lighting: 60W equivalent, 10W LED, 15W smart bulb. " +
    "Relevant for: chargers, kitchen appliances, heating/cooling, lighting.",


  // ── Style & Aesthetics ──────────────────────────────────────────────────────
  // Visual design, fashion, and look-and-feel preferences

  style:
    "Recognised design, fashion, or decor style. " +
    "Fashion: casual, formal, smart-casual, business, sportswear, streetwear, preppy, workwear, bohemian, vintage, retro. " +
    "Home/Furniture: modern, minimalist, industrial, Scandinavian, rustic, traditional, contemporary, art deco. " +
    "Output as stated; use aesthetic for vibe/feeling words not captured here.",

  fit:
    "Garment fit type — relevant for clothing. " +
    "Examples: slim fit, regular fit, relaxed fit, oversized, skinny, tailored, athletic fit, boxy, boyfriend fit, mom fit. " +
    "Output as stated by user.",

  neckline:
    "Neckline style — relevant for tops, dresses, and upper-body garments. " +
    "Examples: v-neck, round neck, crew neck, polo, turtleneck, mock neck, boat neck, " +
    "off-shoulder, scoop neck, halter neck, square neck, cowl neck, keyhole.",

  sleeve:
    "Sleeve length or style — relevant for clothing. " +
    "Length: full sleeve, long sleeve, half sleeve, short sleeve, sleeveless, three-quarter, cap sleeve. " +
    "Style: puff sleeve, raglan, flutter sleeve, bell sleeve.",

  length:
    "Garment or product length — relevant for clothing, curtains, cables. " +
    "Dresses/Skirts: maxi, midi, mini, knee-length, ankle-length, floor-length, above-the-knee. " +
    "Tops: cropped, regular, longline, tunic. " +
    "Cables/Curtains: short, long, 2m, 3m — output as stated.",

  aesthetic:
    "Overall vibe or aesthetic feel — use ONLY when style does not already capture it. " +
    "Examples: cute, edgy, elegant, sporty, cosy, minimalist vibes, dark academia, cottagecore, " +
    "Y2K, grunge, preppy, clean girl, quiet luxury, maximalist, futuristic, kawaii.",


  // ── Food, Health & Beauty ───────────────────────────────────────────────────
  // Category-specific keys for grocery, personal care, and wellness

  dietary:
    "Dietary requirement, restriction, or nutritional preference. " +
    "Religious: halal, kosher. Lifestyle: vegan, vegetarian, plant-based. " +
    "Medical/Intolerance: gluten-free, dairy-free, lactose-free, nut-free, sugar-free, soy-free. " +
    "Nutritional: organic, non-GMO, keto, paleo, high protein, low carb, low sodium, whole grain. " +
    "Output as stated; comma-separate if multiple clearly stated ('vegan and gluten-free').",

  fragrance:
    "Scent or fragrance preference — relevant for perfumes, candles, skincare, haircare, cleaning products. " +
    "Absence: unscented, fragrance-free, odour-free. " +
    "Families: floral, woody, fresh, oriental, citrus, aquatic, musky, spicy. " +
    "Named scents: lavender, rose, oud, vanilla, jasmine, sandalwood, mint, eucalyptus, lemon. " +
    "Output 'unscented' if no fragrance is wanted; output the scent name or family otherwise.",


  // ── Compatibility & Format ──────────────────────────────────────────────────
  // What the product must work with, and what form it comes in

  compatibility:
    "Device, system, vehicle, or product the item must be compatible with — output as stated. " +
    "Devices: iPhone 15, Samsung Galaxy S24, MacBook Pro, iPad Air, Apple Watch Series 9. " +
    "Gaming: PS5, Xbox Series X, Nintendo Switch, Steam Deck. " +
    "Vehicles: Toyota Camry 2023, BMW 3 Series, universal car mount. " +
    "Standards: USB-C, MagSafe, 9V battery, AA battery, VESA 100x100. " +
    "Only extract when user explicitly states what it needs to work with.",

  format:
    "Product format, medium, or edition type — output as stated. " +
    "Books/Media: hardcover, paperback, ebook, audiobook, digital, physical, blu-ray, DVD, vinyl, CD. " +
    "Software/Apps: subscription, one-time purchase, lifetime license, monthly plan. " +
    "Gift cards: e-gift card, physical gift card. " +
    "Games: disc, digital download, cartridge. " +
    "Use when format distinction is explicitly part of the user's query.",

  platform:
    "Digital platform, gaming ecosystem, or app store — relevant for games, software, apps. " +
    "Gaming: PlayStation, Xbox, Nintendo Switch, PC, Steam, Epic Games. " +
    "Mobile: iOS App Store, Android/Google Play. " +
    "Streaming: Netflix, Spotify, YouTube Premium. " +
    "Output as stated by user.",

  room:
    "Room or living space the product is intended for — output as stated. " +
    "Examples: living room, bedroom, kitchen, bathroom, dining room, home office, study, " +
    "nursery, kids' room, garage, balcony, garden, outdoor patio. " +
    "Relevant for: furniture, lighting, curtains, rugs, storage, wall art, appliances.",

  skin_type:
    "Skin type or skin concern — relevant for skincare, makeup, haircare. " +
    "Skin types: oily, dry, combination, sensitive, normal, acne-prone, mature. " +
    "Hair types: curly, straight, wavy, coily, fine, thick, color-treated, damaged. " +
    "Concerns: anti-aging, brightening, hydrating, acne, dark spots, anti-dandruff, volumizing. " +
    "Output as stated — can be comma-separated for multiple concerns.",


  // ── Special Requirements ─────────────────────────────────────────────────────
  // Boolean flags and miscellaneous needs

  eco_friendly:
    "Output true ONLY when user explicitly signals environmental preference. " +
    "Triggers: 'eco-friendly', 'sustainable', 'recycled', 'biodegradable', 'zero waste', " +
    "'green', 'environmentally friendly', 'reusable', 'upcycled', 'carbon neutral'.",

  handmade:
    "Output true ONLY when user explicitly wants handcrafted or artisan products. " +
    "Triggers: 'handmade', 'handcrafted', 'artisan', 'hand-stitched', 'hand-painted', " +
    "'hand-knitted', 'homemade', 'craft', 'hand-sewn', 'hand-poured' (candles).",

  customizable:
    "Output true ONLY when user wants a personalized or made-to-order product. " +
    "Triggers: 'custom', 'personalized', 'customized', 'engraved', 'monogrammed', " +
    "'made to order', 'bespoke', 'with my name', 'custom text', 'custom design', 'tailored'.",

  gift_wrap:
    "Output true ONLY when product is being purchased as a gift for someone. " +
    "Triggers: 'as a gift', 'to gift', 'for gifting', 'birthday gift', 'present', " +
    "'to give to', 'surprise for', 'gift for my [person]'. " +
    "Counter-example: 'birthday shirt for my daughter' → no gift signal, omit. " +
    "'birthday gift for my daughter' → gift_wrap: true.",

  quantity:
    "Number of units or pack size — output as integer when a number is given, string for bulk labels. " +
    "Numeric: 1, 2, 5, 10, 24, 100. " +
    "Labels: 'bulk', 'pack of 6', 'box of 12', 'dozen', 'wholesale', 'set of 4', 'twin pack'. " +
    "Only extract when explicitly stated.",

  language:
    "Language preference for product content — relevant for books, software, packaging, subtitles. " +
    "Examples: English, Urdu, Arabic, French, Spanish, German, Chinese, Japanese, Hindi, Turkish. " +
    "Output as stated.",

}