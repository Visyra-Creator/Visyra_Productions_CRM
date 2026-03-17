export function getSummaryCardBasis(width: number): string {
  const isTablet = width > 768;
  return isTablet ? '32.5%' : '49%';
}

