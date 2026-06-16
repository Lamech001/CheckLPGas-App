export const isNewOrderMessage = (text: string): boolean =>
  text.trim().toUpperCase().startsWith('NEW ORDER:');

export interface ParsedOrderMessage {
  cylinderSize: string;
  gasType: string;
  quantity: string;
  deliveryAddress: string;
}

const parseFirstGroup = (re: RegExp, text: string): string | null => {
  const m = text.match(re);
  return m?.[1]?.trim() ? m[1].trim() : null;
};

export const parseOrderMessageDetails = (text: string): ParsedOrderMessage => {
  const sizeMatch = parseFirstGroup(/cylinder\s*size\s*:\s*([^\n•]+)/i, text);

  // Gas brand/type can be written in a few formats depending on the sender.
  // Consumer order screen currently sends: "Gas Type: <brand>"
  // Some older/other variants may send:
  //   - "Gas Brand: <brand>"
  //   - "Gas type: LPG"
  //   - "Gas: LPG"
  //   - "Type: LPG"
  //   - bullet variants like "• Gas Type: PRO Gas"
  const gasMatch =
    // Bullet + label variants (covers messages like "• Gas Type: PRO Gas")
    // NEW ORDER messages may include both "Gas Brand" and "Gas Type".
    // Capture whichever label is present.
    parseFirstGroup(/\u2022\s*gas\s*(?:brand|type)\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/\u2022\s*gas\s*type\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/\u2022\s*gas\s*brand\s*:\s*([^\n•]+)/i, text) ||

    // Plain label variants (covers both "Gas Brand:" and "Gas Type:")
    parseFirstGroup(/gas\s*brand\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/gas\s*type\s*:\s*([^\n•]+)/i, text) ||

    // Reduced forms
    parseFirstGroup(/gas\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/type\s*:\s*([^\n•]+)/i, text);

  const qtyMatch =
    parseFirstGroup(/quantity\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/quantity\s*\u2022\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/\u2022\s*quantity\s*:\s*([^\n•]+)/i, text);

  const addressMatch =
    parseFirstGroup(/delivery\s*address\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/Delivery\s+Address\s*:\s*([^\n•]+)/i, text) ||
    parseFirstGroup(/\u2022\s*delivery\s*address\s*:\s*([^\n•]+)/i, text);

  const gasType = gasMatch && gasMatch.toLowerCase() !== 'null' ? gasMatch : '—';

  return {
    cylinderSize: sizeMatch ?? '—',
    gasType,
    quantity: qtyMatch ?? '—',
    deliveryAddress: addressMatch ?? '—',
  };
};

