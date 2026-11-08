// Identify and count inventory items in up to 5 photos with Claude.
// Body: {room, existing: [{item, qty}], images: ["<base64 JPEG>", ...]}
import Anthropic from "@anthropic-ai/sdk";
import { protect, json } from "../lib/auth.js";

const MODEL = "claude-opus-5-5";
const MAX_IMAGES = 5;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          qty: { type: "integer" },
          condition: { type: "string", enum: ["Good", "Fair", "Poor"] },
          notes: { type: "string" },
        },
        required: ["item", "qty", "condition", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

function prompt(room, existing) {
  return `You are helping build the contents inventory for Ziggy Rocks, a 10-guest holiday rental in Somerset.
The photos show the room: "${room}".
Items already listed for this room: ${existing.length ? existing.map(i => `${i.item} (qty ${i.qty})`).join("; ") : "none yet"}.

List every distinct item a rental inventory should record: furniture, appliances, electricals, kitchenware, crockery, glassware, cutlery, cookware, linen, towels, soft furnishings, decor and safety equipment.
Count carefully. List each type of cutlery, crockery and glassware separately (for example "Dinner knives", "Dessert spoons", "Side plates") with its count. When the same item appears in more than one photo, count it once.
If an item matches one already listed, use exactly the same name.
Give a condition of Good, Fair or Poor from what you can see. Add a short note only when useful (colour, brand, visible damage, or "count uncertain"); otherwise leave notes empty.`;
}

export const POST = protect(async request => {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Photo scanning isn't set up yet. Add ANTHROPIC_API_KEY in Vercel." }, 503);
  const { room = "", existing = [], images = [] } = await request.json();
  const photos = (Array.isArray(images) ? images : []).filter(s => typeof s === "string" && s.length > 100).slice(0, MAX_IMAGES);
  if (!String(room).trim()) return json({ error: "Enter the room these photos show." }, 400);
  if (!photos.length) return json({ error: "Add at least one photo." }, 400);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          ...photos.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
          { type: "text", text: prompt(String(room).slice(0, 80), Array.isArray(existing) ? existing.slice(0, 200) : []) },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return json({ error: "Claude declined these photos. Try different ones." }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "Too many items to list at once. Try fewer photos." }, 422);
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const parsed = JSON.parse(text);
    return json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Claude is busy. Try again in a minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The Claude API key isn't valid. Check ANTHROPIC_API_KEY in Vercel." }, 503);
    if (e instanceof Anthropic.BadRequestError) { console.error(e); return json({ error: "Claude couldn't read these photos. Try JPEG photos from your phone's camera." }, 400); }
    if (e instanceof Anthropic.APIError) { console.error(e); return json({ error: "Claude had a problem. Try again." }, 502); }
    if (e instanceof SyntaxError) return json({ error: "Claude's answer couldn't be read. Try again." }, 502);
    throw e;
  }
});
