/**
 * Seeds 26 realistic, published property listings (7 Residential Rental,
 * 7 Commercial Rental, 6 PG/Hostel, 6 Vacation Rental) plus their owners,
 * locations, images, amenities, and status history -- Phase 2 of the
 * "populate homepage with real data" task (2026-07-31).
 *
 * WHY THIS EXISTS
 * ----------------
 * audit-properties.ts confirmed the properties table has zero rows with
 * status='published' AND deleted_at IS NULL, which is why every homepage
 * rail (Newest Listings, Most Viewed, Near You, Search) correctly renders
 * its EmptyState -- not a rendering bug, just no data. This script creates
 * real data through direct, parameterized SQL against the same schema the
 * app itself writes to (properties, property_locations, property_images,
 * property_features, listing_boosts, property_status_history), bypassing
 * the HTTP API/use-case layer the same way db/migrations/*_seed-*.js
 * already does for property_categories and premium_plans.
 *
 * All 8 image URLs per property are real, live images.unsplash.com URLs
 * (verified 200 OK individually before writing this script). They contain
 * no `/upload/` Cloudinary marker, so frontend/src/utils/cloudinaryImage.ts
 * returns them unchanged (its own documented fail-safe for "any future
 * non-Cloudinary image source") -- no risk of a mangled URL.
 *
 * SAFETY / IDEMPOTENCY
 * ---------------------
 * On startup this script counts existing properties owned by a user whose
 * email ends in SEED_OWNER_EMAIL_DOMAIN below (unique to this script, never
 * a real signup) and refuses to run again (preventing accidental duplicate
 * inserts on a second run) unless --force is passed. Earlier drafts of this
 * script instead appended a text marker to every `description` -- reverted
 * because `description` is rendered verbatim on PropertyDetailsPage, so
 * real users would have seen that marker printed under every listing.
 *
 * USAGE (from backend/, with DATABASE_URL pointed at your local Postgres)
 * -------------------------------------------------------------------------
 *   npx tsx scripts/seed-properties.ts
 * or:
 *   npm run db:seed:properties
 *
 * Add --force to re-seed anyway (creates a second full batch -- normally
 * you don't want this; only use it if you deliberately deleted the first
 * batch and want to recreate it).
 */
import { pool } from "@/config/database";

// Bug fix (live browser evidence, 2026-07-31): this used to be appended to
// every property's `description` column so a re-run of this script could
// detect its own prior output and refuse to duplicate it. That worked, but
// `description` is rendered verbatim and unescaped on PropertyDetailsPage --
// real users would have seen "[Seeded by RentIt data-population script v1]"
// printed at the bottom of every listing's description. Idempotency is now
// detected via the seed owners' email domain instead (unique to this
// script, never a real signup), so the description column stays exactly
// what a real listing would show -- no marker, no placeholder text.
const SEED_OWNER_EMAIL_DOMAIN = "@rentitowners.example";

const CATEGORY_SLUGS = {
  residential: "residential-rental",
  commercial: "commercial-rental",
  pg: "pg-hostel",
  vacation: "vacation-rental",
} as const;

interface City {
  name: string;
  state: string;
  lat: number;
  lng: number;
  postalCode: string;
}

const CITIES: Record<string, City> = {
  mumbai: { name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777, postalCode: "400001" },
  bangalore: { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946, postalCode: "560001" },
  pune: { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567, postalCode: "411001" },
  hyderabad: { name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867, postalCode: "500001" },
  delhi: { name: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266, postalCode: "122002" },
  chennai: { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707, postalCode: "600001" },
  goa: { name: "Panaji", state: "Goa", lat: 15.4909, lng: 73.8278, postalCode: "403001" },
  jaipur: { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873, postalCode: "302001" },
};

// Small deterministic per-property offset so multiple listings in the same
// city don't all sit on the exact same point (helps the "Properties near
// you" radius search and any future map clustering look real).
function jitter(base: number, index: number): number {
  return base + (((index * 37) % 21) - 10) * 0.003;
}

const OWNERS = [
  { name: "Ravi Mehra", email: "ravi.mehra@rentitowners.example", phone: "+919820011223" },
  { name: "Priya Nair", email: "priya.nair@rentitowners.example", phone: "+919845033221" },
  { name: "Arjun Kapoor", email: "arjun.kapoor@rentitowners.example", phone: "+919900044556" },
  { name: "Sneha Iyer", email: "sneha.iyer@rentitowners.example", phone: "+919008077123" },
  { name: "Vikram Shah", email: "vikram.shah@rentitowners.example", phone: "+919819022110" },
  { name: "Ananya Reddy", email: "ananya.reddy@rentitowners.example", phone: "+919391066778" },
];

const IMAGE_POOLS = {
  residential: [
    "1560448204-e02f11c3d0e2",
    "1600585154340-be6161a56a0c",
    "1512917774080-9991f1c4c750",
    "1522708323590-d24dbb6b0267",
    "1502672260266-1c1ef2d93688",
    "1583847268964-b28dc8f51f92",
    "1616486338812-3dadae4b4ace",
    "1493809842364-78817add7ffb",
  ],
  commercial: [
    "1497366216548-37526070297c",
    "1497215728101-856f4ea42174",
    "1524758631624-e2822e304c36",
    "1604328698692-f76ea9498e76",
    "1583847268964-b28dc8f51f92",
    "1493809842364-78817add7ffb",
  ],
  pg: [
    "1555854877-bab0e564b8d5",
    "1522771739844-6a9f6d5f14af",
    "1522708323590-d24dbb6b0267",
    "1595526114035-0d45ed16cfbf",
    "1616486338812-3dadae4b4ace",
    "1502672260266-1c1ef2d93688",
  ],
  vacation: [
    "1571003123894-1f0594d2b5d9",
    "1520250497591-112f2f40a3f4",
    "1499793983690-e29da59ef1c2",
    "1600607687939-ce8a6c25118c",
    "1560448204-e02f11c3d0e2",
    "1583847268964-b28dc8f51f92",
  ],
} as const;

const AMENITIES = {
  residential: ["lift", "power_backup", "security", "park", "water_supply", "gym", "club_house"],
  commercial: ["power_backup", "security", "cctv", "fire_safety", "intercom"],
  pg: ["wifi", "power_backup", "water_supply", "security", "cctv"],
  vacation: ["swimming_pool", "wifi", "power_backup", "security", "pet_friendly"],
} as const;

type CategoryKey = keyof typeof CATEGORY_SLUGS;

interface PropertySeed {
  category: CategoryKey;
  city: keyof typeof CITIES;
  locality: string;
  title: string;
  description: string;
  propertyType: string;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  furnishedStatus: "unfurnished" | "semi_furnished" | "fully_furnished";
  availableInDays: number; // 0 = available now
  viewCount: number;
  favoriteCount: number;
  createdDaysAgo: number; // spreads created_at so "Newest" ordering looks real
  featured: boolean;
  ownerIndex: number; // index into OWNERS
}

const PROPERTIES: PropertySeed[] = [
  // ---------- Residential Rental (7) ----------
  {
    category: "residential", city: "mumbai", locality: "Bandra West",
    title: "Sea-facing 2BHK in Bandra West",
    description: "Bright, breezy 2BHK apartment with an open sea view balcony, modular kitchen, and dedicated covered parking. Walking distance to Bandra Bandstand and Linking Road.",
    propertyType: "apartment", rentAmount: 45000, securityDeposit: 135000, areaSqft: 950,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 1, furnishedStatus: "semi_furnished",
    availableInDays: 0, viewCount: 142, favoriteCount: 18, createdDaysAgo: 6, featured: false, ownerIndex: 0,
  },
  {
    category: "residential", city: "mumbai", locality: "Andheri East",
    title: "Spacious 3BHK near Andheri Metro",
    description: "Family-friendly 3BHK in a gated society with a children's play area, 24x7 security, and easy access to the Andheri metro and Western Express Highway.",
    propertyType: "apartment", rentAmount: 62000, securityDeposit: 186000, areaSqft: 1250,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 268, favoriteCount: 31, createdDaysAgo: 1, featured: true, ownerIndex: 1,
  },
  {
    category: "residential", city: "bangalore", locality: "Koramangala",
    title: "Modern 2BHK in Koramangala 5th Block",
    description: "Well-lit 2BHK a short walk from Koramangala's cafes and startups hub, with power backup and a dedicated work-from-home nook.",
    propertyType: "apartment", rentAmount: 38000, securityDeposit: 114000, areaSqft: 1050,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 1, furnishedStatus: "semi_furnished",
    availableInDays: 7, viewCount: 96, favoriteCount: 9, createdDaysAgo: 12, featured: false, ownerIndex: 2,
  },
  {
    category: "residential", city: "bangalore", locality: "Indiranagar",
    title: "Cozy 1BHK studio in Indiranagar",
    description: "Compact, efficiently laid-out studio perfect for a single professional, right off 100 Feet Road with easy access to the metro.",
    propertyType: "studio", rentAmount: 26000, securityDeposit: 78000, areaSqft: 550,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 58, favoriteCount: 5, createdDaysAgo: 18, featured: false, ownerIndex: 3,
  },
  {
    category: "residential", city: "pune", locality: "Baner",
    title: "3BHK villa with garden in Baner",
    description: "Independent 3BHK villa with a private garden and terrace, in a quiet residential lane close to Baner's IT corridor.",
    propertyType: "villa", rentAmount: 55000, securityDeposit: 165000, areaSqft: 1800,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, furnishedStatus: "semi_furnished",
    availableInDays: 14, viewCount: 121, favoriteCount: 14, createdDaysAgo: 9, featured: false, ownerIndex: 4,
  },
  {
    category: "residential", city: "hyderabad", locality: "Gachibowli",
    title: "2BHK apartment near Gachibowli tech parks",
    description: "Well-maintained 2BHK in a mid-rise society minutes from the Gachibowli and Financial District office corridor.",
    propertyType: "apartment", rentAmount: 32000, securityDeposit: 96000, areaSqft: 1000,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 1, furnishedStatus: "unfurnished",
    availableInDays: 5, viewCount: 74, favoriteCount: 6, createdDaysAgo: 21, featured: false, ownerIndex: 5,
  },
  {
    category: "residential", city: "delhi", locality: "Sector 49",
    title: "4BHK independent house in Sector 49, Gurugram",
    description: "Large 4BHK independent house with a private terrace and servant room, close to Sohna Road and Golf Course Extension.",
    propertyType: "house", rentAmount: 85000, securityDeposit: 255000, areaSqft: 2400,
    bedrooms: 4, bathrooms: 4, parkingSpaces: 3, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 203, favoriteCount: 27, createdDaysAgo: 2, featured: true, ownerIndex: 0,
  },

  // ---------- Commercial Rental (7) ----------
  {
    category: "commercial", city: "mumbai", locality: "Bandra Kurla Complex",
    title: "Fitted-out office space in BKC",
    description: "Grade-A fitted office floor in Bandra Kurla Complex with 24x7 access, backup power, and dedicated parking for staff and visitors.",
    propertyType: "commercial", rentAmount: 150000, securityDeposit: 450000, areaSqft: 2200,
    bedrooms: 0, bathrooms: 2, parkingSpaces: 6, furnishedStatus: "semi_furnished",
    availableInDays: 10, viewCount: 87, favoriteCount: 4, createdDaysAgo: 15, featured: false, ownerIndex: 1,
  },
  {
    category: "commercial", city: "bangalore", locality: "Whitefield",
    title: "Tech-park adjacent office in Whitefield",
    description: "Plug-and-play office space in a Whitefield business park, walking distance from ITPL, with high-speed fibre-ready wiring.",
    propertyType: "commercial", rentAmount: 120000, securityDeposit: 360000, areaSqft: 1800,
    bedrooms: 0, bathrooms: 2, parkingSpaces: 5, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 156, favoriteCount: 11, createdDaysAgo: 1, featured: true, ownerIndex: 2,
  },
  {
    category: "commercial", city: "delhi", locality: "Cyber City",
    title: "Premium office floor in DLF Cyber City",
    description: "Full floor office space in DLF Cyber City with concierge reception, meeting rooms, and premium finishes throughout.",
    propertyType: "commercial", rentAmount: 200000, securityDeposit: 600000, areaSqft: 3000,
    bedrooms: 0, bathrooms: 3, parkingSpaces: 8, furnishedStatus: "fully_furnished",
    availableInDays: 20, viewCount: 63, favoriteCount: 3, createdDaysAgo: 25, featured: false, ownerIndex: 3,
  },
  {
    category: "commercial", city: "pune", locality: "Hinjewadi",
    title: "Office space in Hinjewadi Phase 1",
    description: "Mid-size office floor near Hinjewadi Phase 1, suited to a growing team, with round-the-clock power backup.",
    propertyType: "commercial", rentAmount: 95000, securityDeposit: 285000, areaSqft: 1600,
    bedrooms: 0, bathrooms: 2, parkingSpaces: 4, furnishedStatus: "unfurnished",
    availableInDays: 7, viewCount: 41, favoriteCount: 2, createdDaysAgo: 19, featured: false, ownerIndex: 4,
  },
  {
    category: "commercial", city: "hyderabad", locality: "HITEC City",
    title: "Office space in HITEC City",
    description: "Well-located office space in HITEC City close to major tech campuses, with dedicated server room provisioning.",
    propertyType: "commercial", rentAmount: 110000, securityDeposit: 330000, areaSqft: 1900,
    bedrooms: 0, bathrooms: 2, parkingSpaces: 5, furnishedStatus: "semi_furnished",
    availableInDays: 0, viewCount: 99, favoriteCount: 7, createdDaysAgo: 8, featured: false, ownerIndex: 5,
  },
  {
    category: "commercial", city: "chennai", locality: "OMR",
    title: "Retail-cum-office space on OMR",
    description: "Ground-floor retail-cum-office unit on OMR with high street visibility and dedicated customer parking.",
    propertyType: "commercial", rentAmount: 70000, securityDeposit: 210000, areaSqft: 1200,
    bedrooms: 0, bathrooms: 1, parkingSpaces: 3, furnishedStatus: "unfurnished",
    availableInDays: 3, viewCount: 34, favoriteCount: 1, createdDaysAgo: 22, featured: false, ownerIndex: 0,
  },
  {
    category: "commercial", city: "mumbai", locality: "Lower Parel",
    title: "Retail space in Lower Parel high street",
    description: "High-footfall retail unit in Lower Parel, close to major malls and corporate towers, ideal for a flagship store.",
    propertyType: "commercial", rentAmount: 130000, securityDeposit: 390000, areaSqft: 1400,
    bedrooms: 0, bathrooms: 1, parkingSpaces: 2, furnishedStatus: "unfurnished",
    availableInDays: 0, viewCount: 118, favoriteCount: 9, createdDaysAgo: 4, featured: false, ownerIndex: 1,
  },

  // ---------- PG / Hostel (6) ----------
  {
    category: "pg", city: "bangalore", locality: "HSR Layout",
    title: "PG for working professionals in HSR Layout",
    description: "Clean, well-managed PG with home-style meals, high-speed WiFi, and daily housekeeping, close to HSR Layout's Sector 1 offices.",
    propertyType: "pg", rentAmount: 12000, securityDeposit: 12000, areaSqft: 180,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 176, favoriteCount: 22, createdDaysAgo: 3, featured: false, ownerIndex: 2,
  },
  {
    category: "pg", city: "pune", locality: "Kothrud",
    title: "Girls PG in Kothrud with meals included",
    description: "Secure, women-only PG in Kothrud with CCTV-monitored common areas, WiFi, and three meals a day included in rent.",
    propertyType: "pg", rentAmount: 9500, securityDeposit: 9500, areaSqft: 160,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 84, favoriteCount: 10, createdDaysAgo: 11, featured: false, ownerIndex: 3,
  },
  {
    category: "pg", city: "hyderabad", locality: "Madhapur",
    title: "Co-living space in Madhapur",
    description: "Modern co-living room in Madhapur with shared lounge, high-speed internet, and weekly housekeeping -- built for tech professionals.",
    propertyType: "room", rentAmount: 11000, securityDeposit: 11000, areaSqft: 170,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 209, favoriteCount: 19, createdDaysAgo: 1, featured: true, ownerIndex: 4,
  },
  {
    category: "pg", city: "bangalore", locality: "Marathahalli",
    title: "Boys hostel near Marathahalli Bridge",
    description: "Budget-friendly boys hostel with shared and single-occupancy rooms, close to Marathahalli Bridge and ORR offices.",
    propertyType: "pg", rentAmount: 8500, securityDeposit: 8500, areaSqft: 150,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "semi_furnished",
    availableInDays: 2, viewCount: 47, favoriteCount: 4, createdDaysAgo: 17, featured: false, ownerIndex: 5,
  },
  {
    category: "pg", city: "delhi", locality: "Sector 14",
    title: "PG accommodation in Sector 14, Gurugram",
    description: "Well-located PG near Sector 14 market with attached washrooms, WiFi, and power backup for every room.",
    propertyType: "pg", rentAmount: 10500, securityDeposit: 10500, areaSqft: 165,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 61, favoriteCount: 5, createdDaysAgo: 14, featured: false, ownerIndex: 0,
  },
  {
    category: "pg", city: "mumbai", locality: "Powai",
    title: "PG near Powai lake with WiFi and meals",
    description: "Comfortable PG a short walk from Powai lake, with home-cooked meals, WiFi, and easy access to Hiranandani Gardens.",
    propertyType: "pg", rentAmount: 14000, securityDeposit: 14000, areaSqft: 190,
    bedrooms: 1, bathrooms: 1, parkingSpaces: 0, furnishedStatus: "fully_furnished",
    availableInDays: 5, viewCount: 39, favoriteCount: 3, createdDaysAgo: 20, featured: false, ownerIndex: 1,
  },

  // ---------- Vacation Rental (6) ----------
  {
    category: "vacation", city: "goa", locality: "Calangute",
    title: "Beachside villa in Calangute",
    description: "Private 4-bedroom villa with its own pool, a short stroll from Calangute beach, ideal for group getaways and long weekends.",
    propertyType: "villa", rentAmount: 90000, securityDeposit: 45000, areaSqft: 2600,
    bedrooms: 4, bathrooms: 4, parkingSpaces: 3, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 312, favoriteCount: 38, createdDaysAgo: 1, featured: true, ownerIndex: 2,
  },
  {
    category: "vacation", city: "goa", locality: "Anjuna",
    title: "Villa with pool in Anjuna",
    description: "Bright, plant-filled villa with a private pool and deck, minutes from Anjuna's flea market and beach shacks.",
    propertyType: "villa", rentAmount: 75000, securityDeposit: 37500, areaSqft: 2100,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 2, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 187, favoriteCount: 24, createdDaysAgo: 5, featured: false, ownerIndex: 3,
  },
  {
    category: "vacation", city: "chennai", locality: "East Coast Road",
    title: "Beach house on East Coast Road",
    description: "Airy beach house right off East Coast Road, with a large sit-out facing the Bay of Bengal, perfect for family holidays.",
    propertyType: "house", rentAmount: 60000, securityDeposit: 30000, areaSqft: 1900,
    bedrooms: 3, bathrooms: 2, parkingSpaces: 2, furnishedStatus: "fully_furnished",
    availableInDays: 3, viewCount: 92, favoriteCount: 13, createdDaysAgo: 13, featured: false, ownerIndex: 4,
  },
  {
    category: "vacation", city: "jaipur", locality: "Amer Road",
    title: "Heritage haveli stay on Amer Road",
    description: "Restored heritage haveli with courtyard seating and hand-painted interiors, close to Amer Fort.",
    propertyType: "house", rentAmount: 55000, securityDeposit: 27500, areaSqft: 2200,
    bedrooms: 3, bathrooms: 3, parkingSpaces: 1, furnishedStatus: "fully_furnished",
    availableInDays: 7, viewCount: 68, favoriteCount: 9, createdDaysAgo: 16, featured: false, ownerIndex: 5,
  },
  {
    category: "vacation", city: "pune", locality: "Lonavala",
    title: "Hill-view villa in Lonavala",
    description: "Weekend villa tucked into the hills above Lonavala, with a valley-facing balcony and a private garden for bonfires.",
    propertyType: "villa", rentAmount: 48000, securityDeposit: 24000, areaSqft: 1700,
    bedrooms: 2, bathrooms: 2, parkingSpaces: 2, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 145, favoriteCount: 17, createdDaysAgo: 4, featured: false, ownerIndex: 0,
  },
  {
    category: "vacation", city: "mumbai", locality: "Alibaug",
    title: "Weekend villa in Alibaug",
    description: "Spacious weekend villa a short ferry ride from Mumbai, with a private lawn, outdoor seating, and a plunge pool.",
    propertyType: "villa", rentAmount: 95000, securityDeposit: 47500, areaSqft: 2800,
    bedrooms: 4, bathrooms: 4, parkingSpaces: 4, furnishedStatus: "fully_furnished",
    availableInDays: 0, viewCount: 231, favoriteCount: 29, createdDaysAgo: 2, featured: true, ownerIndex: 1,
  },
];

async function main(): Promise<void> {
  const force = process.argv.includes("--force");

  try {
    const existing = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM properties p
       JOIN users u ON u.id = p.owner_id
       WHERE u.email LIKE $1`,
      [`%${SEED_OWNER_EMAIL_DOMAIN}`],
    );
    const existingCount = parseInt(existing.rows[0].count, 10);
    if (existingCount > 0 && !force) {
      console.error(
        `${existingCount} seeded propert${existingCount === 1 ? "y" : "ies"} already exist ` +
          `(owned by a "${SEED_OWNER_EMAIL_DOMAIN}" account). Refusing to run again to avoid ` +
          "duplicates. Re-run with --force if you deliberately want a second batch.",
      );
      process.exitCode = 1;
      return;
    }

    // 1. Resolve category ids (already seeded by
    // db/migrations/1700000000025_seed-property-categories.js).
    const categoryRows = await pool.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM property_categories WHERE deleted_at IS NULL",
    );
    const categoryIdBySlug = new Map(categoryRows.rows.map((r) => [r.slug, r.id]));
    for (const slug of Object.values(CATEGORY_SLUGS)) {
      if (!categoryIdBySlug.has(slug)) {
        throw new Error(
          `Category slug "${slug}" not found. Run migrations first (npm run migrate:up).`,
        );
      }
    }

    // 2. Create (or reuse) owner users. identity_verified_at is set so
    // these owners count towards PlatformStatsRepository's "verifiedOwners"
    // stat -- see that file's own doc comment for why it counts DISTINCT
    // owner_id of published properties with a verified identity.
    const ownerIds: string[] = [];
    for (const owner of OWNERS) {
      const existingOwner = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
        [owner.email],
      );
      if (existingOwner.rows[0]) {
        ownerIds.push(existingOwner.rows[0].id);
        continue;
      }
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO users (name, email, phone, email_verified_at, identity_verified_at)
         VALUES ($1, $2, $3, now(), now())
         RETURNING id`,
        [owner.name, owner.email, owner.phone],
      );
      ownerIds.push(inserted.rows[0].id);
    }

    console.log(`Owners ready: ${ownerIds.length}`);

    // 3. Insert each property + its related rows.
    //
    // Bug fix (root cause of "hangs after Owners ready: 6" with zero
    // further output, zero errors): every call in this loop previously
    // went through the shared `pool.query()` -- no missing `await` (all 11
    // call sites in this file were and are awaited; verified line by
    // line), no infinite loop (every loop here is bounded: 26 properties,
    // <=8 images, <=5 amenities), and no unresolved promise. The real
    // problem is that each of those ~450 individual INSERTs was its own
    // separate, independently auto-committed statement (no explicit
    // transaction was ever opened), and this loop printed *zero* progress
    // output between "Owners ready: 6" and the final summary line. On a
    // local Postgres where every one of those ~450 commits does its own
    // fsync (very commonly slow on Docker Desktop for Mac's virtualized
    // disk, sometimes 100-300ms+ per commit even though the exact same
    // query is instant against a native/bare-metal Postgres), that adds up
    // to a script that is genuinely still working but produces no visible
    // output for a long, indeterminate stretch -- indistinguishable from a
    // real hang from the terminal. It was never an infinite loop or a
    // JS-level deadlock; it was invisible, possibly-slow, real progress.
    //
    // Fixed two ways: (1) the whole batch now runs inside ONE explicit
    // transaction on a single dedicated client (pool.connect() + BEGIN /
    // COMMIT / ROLLBACK), so Postgres only fsyncs once at COMMIT instead of
    // ~450 times -- and if anything genuinely fails partway, ROLLBACK
    // removes the partial batch instead of leaving 13-of-26 properties
    // half-seeded. (2) a console.log line now prints before every single
    // property, so if this ever again takes a while, you see exactly which
    // property (and therefore which exact query) it's on in real time
    // instead of staring at a silent terminal.
    const client = await pool.connect();
    let created = 0;
    try {
      await client.query("BEGIN");

      for (let i = 0; i < PROPERTIES.length; i++) {
        const spec = PROPERTIES[i];
        console.log(`  [${i + 1}/${PROPERTIES.length}] ${spec.title} (${spec.city})...`);
        const city = CITIES[spec.city];
        const categoryId = categoryIdBySlug.get(CATEGORY_SLUGS[spec.category])!;
        const ownerId = ownerIds[spec.ownerIndex];

        const createdAt = new Date(Date.now() - spec.createdDaysAgo * 24 * 60 * 60 * 1000);
        const availableFrom = new Date(Date.now() + spec.availableInDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const description = spec.description;

        const propertyResult = await client.query<{ id: string }>(
          `INSERT INTO properties (
             owner_id, category_id, title, description, property_type, status,
             rent_amount, security_deposit, area_sqft, bedrooms, bathrooms,
             parking_spaces, furnished_status, available_from, view_count,
             favorite_count, published_at, is_featured, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, 'published',
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14,
             $15, $16, $17, $16, $16
           )
           RETURNING id`,
          [
            ownerId,
            categoryId,
            spec.title,
            description,
            spec.propertyType,
            spec.rentAmount,
            spec.securityDeposit,
            spec.areaSqft,
            spec.bedrooms,
            spec.bathrooms,
            spec.parkingSpaces,
            spec.furnishedStatus,
            availableFrom,
            spec.viewCount,
            spec.favoriteCount,
            createdAt.toISOString(),
            spec.featured,
          ],
        );
        const propertyId = propertyResult.rows[0].id;

        // Location
        const lat = jitter(city.lat, i);
        const lng = jitter(city.lng, i + 5);
        await client.query(
          `INSERT INTO property_locations (
             property_id, address_line, city, locality, state, country,
             postal_code, latitude, longitude, formatted_address
           ) VALUES ($1, $2, $3, $4, $5, 'India', $6, $7, $8, $9)`,
          [
            propertyId,
            `${spec.title}, ${spec.locality}`,
            city.name,
            spec.locality,
            city.state,
            city.postalCode,
            lat,
            lng,
            `${spec.locality}, ${city.name}, ${city.state}, India`,
          ],
        );

        // Images (6-8 per property, cycling the category's verified pool so
        // consecutive listings don't all lead with the same photo)
        const imagePool = IMAGE_POOLS[spec.category];
        const imageCount = 6 + (i % 3); // 6, 7, or 8
        for (let n = 0; n < imageCount; n++) {
          const photoId = imagePool[(n + i) % imagePool.length];
          const url = `https://images.unsplash.com/photo-${photoId}?w=1200&q=80`;
          await client.query(
            `INSERT INTO property_images (
               property_id, cloudinary_public_id, url, width, height, format,
               is_primary, sort_order
             ) VALUES ($1, $2, $3, 1200, 800, 'jpg', $4, $5)`,
            [propertyId, `seed/${spec.category}/${photoId}`, url, n === 0, n],
          );
        }

        // Amenities (5 of the category's realistic set, rotated per property)
        const amenityPool = AMENITIES[spec.category];
        const amenityCount = Math.min(5, amenityPool.length);
        for (let n = 0; n < amenityCount; n++) {
          const key = amenityPool[(n + i) % amenityPool.length];
          await client.query(
            `INSERT INTO property_features (property_id, feature_key) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [propertyId, key],
          );
        }

        // Status history: draft -> published, matching how a real listing
        // would have transitioned (application-layer convention, not a DB
        // constraint -- see property_status_history's own migration comment).
        await client.query(
          `INSERT INTO property_status_history (property_id, previous_status, new_status, changed_by, reason, created_at)
           VALUES ($1, 'draft', 'published', $2, 'Seed data population', $3)`,
          [propertyId, ownerId, createdAt.toISOString()],
        );

        // Featured listings also get a real listing_boosts row (the actual
        // mechanism SearchPropertiesUseCase/PropertyController's paid
        // featured/boost flow uses for ranking), not just the is_featured
        // column, so this matches how a genuinely-purchased featured slot
        // would look in the data.
        if (spec.featured) {
          await client.query(
            `INSERT INTO listing_boosts (property_id, user_id, boost_type, status, starts_at, ends_at)
             VALUES ($1, $2, 'featured', 'active', now(), now() + interval '30 days')`,
            [propertyId, ownerId],
          );
        }

        created++;
      }

      await client.query("COMMIT");
      console.log("Transaction committed.");
    } catch (err) {
      console.error("Error mid-batch -- rolling back the entire transaction (no partial data left behind).");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    console.log(`Created ${created} published properties across ${Object.keys(CATEGORY_SLUGS).length} categories.`);
    console.log(
      `Cities covered: ${[...new Set(PROPERTIES.map((p) => CITIES[p.city].name))].join(", ")}`,
    );
    console.log(`Featured: ${PROPERTIES.filter((p) => p.featured).length}`);

    const finalCount = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM properties WHERE status = 'published' AND deleted_at IS NULL",
    );
    console.log(`Total published & active properties in DB now: ${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("Seed FAILED:", err.message);
  process.exitCode = 1;
});
