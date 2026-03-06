/**
 * Formats an ore amount (1/100 NOK) to Norwegian kroner display format.
 * Example: 10000 -> "100,00 kr", 123456 -> "1 234,56 kr"
 */
export function formatOreToNOK(ore: number): string {
  const nok = ore / 100;
  const parts = nok.toFixed(2).split(".");
  const intPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${intPart},${parts[1]} kr`;
}

interface PriceDisplayProps {
  ore: number;
  className?: string;
}

export default function PriceDisplay({ ore, className }: PriceDisplayProps) {
  return <span className={className}>{formatOreToNOK(ore)}</span>;
}
