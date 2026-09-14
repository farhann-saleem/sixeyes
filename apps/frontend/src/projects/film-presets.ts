import type { ProjectScript } from "../video-studio/model";

type PresetScene = Pick<ProjectScript["scenes"][number], "heading" | "voiceover_line" | "stock_query" | "duration_sec">;
type PresetScript = { title: string; voiceover_full: string; scenes: PresetScene[] };

export type FilmPreset = {
  id: string;
  label: string;
  name: string;
  topic: string;
  script: PresetScript;
};

function pack(title: string, scenes: PresetScript["scenes"]): PresetScript {
  return { title, voiceover_full: scenes.map((s) => s.voiceover_line).join(" "), scenes };
}

export const FILM_PRESETS: FilmPreset[] = [
  {
    id: "coffee-morning",
    label: "Coffee shop morning — first grind to the rush",
    name: "Coffee shop morning",
    topic: "Coffee shop morning — first grind to the rush. Dawn street, keys in the door, first grind, steam, first cup, then the line.",
    script: pack("First grind", [
      { heading: "The street before open", voiceover_line: "Before the lock turns, the street is still half asleep.", stock_query: "empty cafe street dawn", duration_sec: 8 },
      { heading: "Keys and light", voiceover_line: "A key finds the lock. Light spills onto the floor.", stock_query: "barista unlocking cafe door", duration_sec: 7 },
      { heading: "First grind", voiceover_line: "The first grind is loud on purpose. It tells the room the day has started.", stock_query: "coffee grinder close up", duration_sec: 8 },
      { heading: "Steam", voiceover_line: "Steam lifts. Milk turns from cold to silk.", stock_query: "espresso steam pitcher pour", duration_sec: 8 },
      { heading: "First cup", voiceover_line: "The first cup leaves the bar before the rush arrives.", stock_query: "barista handing coffee cup", duration_sec: 8 },
      { heading: "The rush", voiceover_line: "Then the line arrives, and the shop becomes a city in one room.", stock_query: "busy coffee shop morning", duration_sec: 8 },
    ]),
  },
  {
    id: "coffee-friend",
    label: "Coffee with a friend — two cups, one table",
    name: "Coffee with a friend",
    topic: "Coffee with a friend. Two cups on one table. Talk, hands on mugs, window light, a shared plate, then the street.",
    script: pack("Two cups", [
      { heading: "Two cups", voiceover_line: "Two cups land. The table is small on purpose.", stock_query: "two coffee cups table", duration_sec: 8 },
      { heading: "The talk", voiceover_line: "You do not rush the first sentence. The shop holds the rest.", stock_query: "friends talking coffee shop", duration_sec: 8 },
      { heading: "Hands", voiceover_line: "Hands find the warm mug when the story gets honest.", stock_query: "hands holding coffee mug", duration_sec: 7 },
      { heading: "Window", voiceover_line: "Afternoon light sits on the glass like it was invited.", stock_query: "cafe window afternoon light", duration_sec: 8 },
      { heading: "Shared plate", voiceover_line: "One plate between you. That is the whole point.", stock_query: "sharing pastry coffee shop", duration_sec: 8 },
      { heading: "Outside", voiceover_line: "You leave still talking. The street can wait one more block.", stock_query: "friends leaving cafe street", duration_sec: 8 },
    ]),
  },
  {
    id: "coffee-rain",
    label: "Coffee after rain — wet street, warm cup",
    name: "Coffee after rain",
    topic: "Coffee after rain. Wet street, fogged window, dripping coat, a quiet cup, steam, then walking home.",
    script: pack("After the rain", [
      { heading: "Wet street", voiceover_line: "Rain has just stopped. The street still shines.", stock_query: "wet city street after rain", duration_sec: 8 },
      { heading: "Door", voiceover_line: "You step in dripping. The shop smells like heat.", stock_query: "entering cafe rainy day", duration_sec: 7 },
      { heading: "Window fog", voiceover_line: "The window fogs. Outside turns into a painting.", stock_query: "fogged cafe window rain", duration_sec: 8 },
      { heading: "The cup", voiceover_line: "A quiet cup. No rush. Just warm ceramic.", stock_query: "hot coffee cup closeup", duration_sec: 8 },
      { heading: "Steam", voiceover_line: "Steam writes the same short letter every time.", stock_query: "coffee cup steam rising", duration_sec: 8 },
      { heading: "Walk home", voiceover_line: "You walk home slower. The city has been washed.", stock_query: "walking wet sidewalk evening", duration_sec: 8 },
    ]),
  },
  {
    id: "coffee-night",
    label: "Coffee after dark — last table still open",
    name: "Coffee after dark",
    topic: "Coffee after dark. Neon, last tables, espresso at night, a book, the barista wiping down, lights out.",
    script: pack("Last table", [
      { heading: "Neon", voiceover_line: "Night does not close this shop. It only changes the light.", stock_query: "cafe neon night window", duration_sec: 8 },
      { heading: "Last tables", voiceover_line: "A few tables stay. Voices drop to half volume.", stock_query: "empty cafe tables night", duration_sec: 8 },
      { heading: "Night espresso", voiceover_line: "Espresso after dark is a different drink. Shorter. Bolder.", stock_query: "espresso pour night cafe", duration_sec: 8 },
      { heading: "A book", voiceover_line: "Someone reads like the city asked them to wait.", stock_query: "reading book coffee shop", duration_sec: 7 },
      { heading: "Wipe down", voiceover_line: "The bar gets wiped. The day is almost told.", stock_query: "barista wiping counter night", duration_sec: 8 },
      { heading: "Lights", voiceover_line: "Lights go down. The cup was the last true thing.", stock_query: "cafe lights turning off", duration_sec: 8 },
    ]),
  },
];
