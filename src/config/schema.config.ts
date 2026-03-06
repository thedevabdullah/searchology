export const schema: Record<string, string> = {

    // Product Identity
    product_type:     "type of product for example t-shirt, dress, shoes, laptop, sofa, watch",
    product_name:     "specific product name if mentioned for example air jordan, iphone 15",
    brand:            "brand name if explicitly mentioned for example nike, apple, samsung, zara",
    model:            "specific model number or name for example iphone 15 pro, galaxy s24",
    category:         "broad category for example clothing, electronics, furniture, toys, sports",
    subcategory:      "specific subcategory for example running shoes, gaming laptop",
  
    // Physical Attributes
    color:            "color mentioned for example black, red, navy blue, multicolor",
    color_secondary:  "second color if two colors mentioned",
    size:             "size mentioned for example small, medium, large, xl, 32, 10",
    size_type:        "size system mentioned for example US, UK, EU, Asian sizing",
    material:         "material or fabric for example cotton, leather, wool, silk, wood, metal",
    pattern:          "pattern for example striped, floral, solid, checkered, polka dot",
    shape:            "shape for example round, square, oval, rectangular",
    weight:           "weight mentioned for example lightweight, heavy duty, 5kg, portable",
    dimensions:       "dimensions for example 55 inch, 10 feet, A4 size, compact",
  
    // Target Person
    gender:           "return male, female, or unisex only inferred from context",
    age:              "numeric age of the person the product is for, just the number",
    age_group:        "return one of: newborn, infant, toddler, kids, tweens, teen, adult, senior",
    relationship:     "who product is for example son, daughter, wife, husband, mom, dad, friend",
    profession:       "profession mentioned for example doctor, chef, teacher, athlete, engineer",
  
    // Occasion & Usage
    occasion:         "occasion for example birthday, wedding, graduation, christmas, eid, party",
    season:           "season for example summer, winter, spring, autumn, monsoon, all season",
    weather:          "weather condition for example rain, snow, hot, cold, windy",
    usage:            "how it will be used for example daily, office, gym, outdoor, travel, gaming",
    activity:         "specific activity for example running, swimming, hiking, cycling, yoga",
  
    // Pricing & Value
    price_max:        "maximum price as plain number without currency symbol",
    price_min:        "minimum price as plain number without currency symbol",
    currency:         "currency for example USD, GBP, PKR, EUR, INR infer from symbols $ £ ₹",
    budget_label:     "return one of: budget, mid-range, premium, luxury",
    discount:         "return true if user wants sale or discounted items",
  
    // Quality & Condition
    condition:        "return one of: new, used, refurbished, open-box",
    quality_tier:     "return one of: basic, standard, premium, professional, industrial",
    rating_min:       "minimum rating as number inferred from highly rated, best reviewed",
    certification:    "certification for example organic, waterproof, FDA approved, ISO",
  
    // Delivery & Availability
    delivery_speed:   "return one of: same-day, next-day, express, standard",
    location:         "delivery location or region mentioned for example Karachi, London, USA",
    availability:     "return in-stock if user wants available items only",
    seller_type:      "return one of: official-store, local-seller, any",
  
    // Technical — Electronics
    storage:          "storage capacity for example 128gb, 1tb, 512gb",
    ram:              "RAM for example 8gb, 16gb, 32gb",
    battery:          "battery for example 5000mah, long battery, all day battery",
    display_size:     "screen size for example 6.5 inch, 55 inch, 15.6 inch",
    connectivity:     "connectivity for example wifi, bluetooth, 5g, usb-c, hdmi, wireless",
    operating_system: "OS for example android, ios, windows, macos, linux",
    processor:        "processor for example m2 chip, snapdragon, intel i7, ryzen 5",
  
    // Style & Aesthetics
    style:            "style for example casual, formal, vintage, modern, minimalist, streetwear",
    fit:              "fit type for example slim fit, regular fit, oversized, relaxed, skinny",
    neckline:         "neckline for example v-neck, round neck, crew neck, polo, turtleneck",
    sleeve:           "sleeve for example full sleeve, half sleeve, sleeveless, three-quarter",
    aesthetic:        "aesthetic for example cute, edgy, professional, sporty, elegant",
  
    // Special Requirements
    eco_friendly:     "return true if user wants sustainable or eco-friendly products",
    handmade:         "return true if user wants handmade or artisan products",
    customizable:     "return true if user wants personalized or custom products",
    gift_wrap:        "return true if user mentions gifting, present, surprise, wrapped",
    quantity:         "quantity as number for example 2, or label like bulk, pack of 5",
    language:         "language preference for example English, Urdu, Arabic, French",
  
  }