export const isNewOrderMessage = (text: string): boolean =>
  text.trim().toUpperCase().startsWith('NEW ORDER');

export interface ParsedOrderMessage {
  cylinderSize: string;
  gasType: string;
  quantity: string;
  deliveryAddress: string;
}

export const parseOrderMessageDetails = (text: string): ParsedOrderMessage => {
  const sizeMatch = text.match(/cylinder\s*size\s*:\s*([^\n•]+)/i);
  const gasMatch = text.match(/gas\s*type\s*:\s*([^\n•]+)/i);
  const qtyMatch = text.match(/quantity\s*:\s*([^\n•]+)/i);
  const addressMatch = text.match(/delivery\s*address\s*:\s*(.+)/i);

  return {
    cylinderSize: sizeMatch ? sizeMatch[1].trim() : '—',
    gasType: gasMatch ? gasMatch[1].trim() : '—',
    quantity: qtyMatch ? qtyMatch[1].trim() : '—',
    deliveryAddress: addressMatch ? addressMatch[1].trim() : '—',
  };
};
