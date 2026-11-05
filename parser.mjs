/**
 * Strict English pickup-call parser.
 * Pure logic: no microphone, cloud service, audio storage, or DOM access.
 * Outputs null if the utterance is not recognizably an isolated pickup number.
 */
const UNITS = new Map(Object.entries({
  zero:0, oh:0, o:0, one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12,
  thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17,
  eighteen:18, nineteen:19
}));
const TENS = new Map(Object.entries({twenty:20, thirty:30, forty:40, fifty:50,
  sixty:60, seventy:70, eighty:80, ninety:90}));
const WORDS = new Map([...UNITS, ...TENS]);

function parseEnglishNumber(text) {
  const input = text.trim();
  if (/^\d{1,4}$/.test(input)) return Number(input);
  const tokens = input.split(/\s+/).filter(w => w !== 'and');
  if (!tokens.length || tokens.length > 9) return null;
  if (tokens.some(w => !WORDS.has(w) && !['hundred','thousand'].includes(w) && !/^\d{1,4}$/.test(w))) return null;

  // "one two five" / "one oh five" / "1 2 5"
  if (tokens.length >= 2 && tokens.every(w => (WORDS.has(w) && WORDS.get(w) < 10) || /^\d$/.test(w))) {
    const digits = tokens.map(w => /^\d$/.test(w) ? Number(w) : WORDS.get(w));
    return digits.length <= 4 ? Number(digits.join('')) : null;
  }

  // "one twenty five" / "two thirty" / "twelve thirty four" / "one 25"
  // A common restaurant way to read out 3/4-digit order identifiers.
  if (tokens.length >= 2 && tokens.length <= 3 && !tokens.some(w => ['hundred','thousand'].includes(w))) {
    const first = WORDS.has(tokens[0]) ? WORDS.get(tokens[0]) : /^\d{1,2}$/.test(tokens[0]) ? Number(tokens[0]) : null;
    let remainder = null;
    if (tokens.length === 2) {
      const second = WORDS.has(tokens[1]) ? WORDS.get(tokens[1]) : /^\d{1,2}$/.test(tokens[1]) ? Number(tokens[1]) : null;
      if (second !== null && second >= 10 && second <= 99) remainder = second;
    } else {
      const t = TENS.get(tokens[1]);
      const u = UNITS.get(tokens[2]);
      if (t !== undefined && u !== undefined && u < 10) remainder = t + u;
    }
    if (first !== null && first >= 1 && first <= 99 && remainder !== null) {
      const v = first * 100 + remainder;
      return v <= 9999 ? v : null;
    }
  }

  let total = 0, part = 0, valid = false;
  for (const word of tokens) {
    if (word === 'hundred') {
      if (part < 1 || part > 9) return null;
      part *= 100;
    } else if (word === 'thousand') {
      if (part < 1 || part > 9 || total !== 0) return null;
      total += part * 1000;
      part = 0;
    } else {
      const n = WORDS.has(word) ? WORDS.get(word) : /^\d{1,4}$/.test(word) ? Number(word) : null;
      if (n === null) return null;
      part += n;
    }
    valid = true;
  }
  const result = total + part;
  return valid && Number.isInteger(result) && result >= 0 && result <= 9999 ? result : null;
}

export function parsePickupNumber(transcript, {requireCue = false, maxNumber = 9999} = {}) {
  if (typeof transcript !== 'string') return null;
  let text = transcript.toLowerCase()
    .replace(/[\u2010-\u2015-]/g, ' ')
    .replace(/\bno\./g, 'number')
    .replace(/#/g, ' number ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!text || text.length > 90) return null;

  let hasCue = false;
  const cues = [
    /^(?:order\s+number|ticket\s+number|pickup\s+number)\s+/,
    /^(?:order|number|ticket)\s+/,
    /^(?:now\s+serving|calling|pickup\s+for|ready\s+for\s+pickup)\s+(?:order\s+number\s+|number\s+|order\s+)?/,
  ];
  for (const cue of cues) {
    if (cue.test(text)) {hasCue = true; text = text.replace(cue, ''); break;}
  }
  text = text.replace(/(?:\s+(?:is\s+)?ready(?:\s+for\s+pickup)?|\s+please|\s+thank\s+you)$/, '').trim();
  if (requireCue && !hasCue) return null;
  const value = parseEnglishNumber(text);
  if (value === null || value > maxNumber) return null;
  return {number: String(value), hasCue};
}
