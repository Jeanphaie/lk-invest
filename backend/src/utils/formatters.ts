/**
 * Formate un nombre en devise
 * @param value Valeur à formater
 * @param unit Unité de la devise (par défaut: '€')
 * @param decimals Nombre de décimales (par défaut: 0)
 * @returns La valeur formatée en devise
 */
export function formatCurrency(value: number | string | null | undefined, unit = '€', decimals = 0): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${unit}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Formate un nombre en milliers d'euros (k€)
 * @param value Valeur à formater
 * @param decimals Nombre de décimales (par défaut: 0)
 * @returns La valeur formatée en k€
 */
export function formatKCurrency(value: number | string | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return formatCurrency(numValue / 1000, 'k€', decimals);
  } catch {
    return 'N/A';
  }
}

/**
 * Formate un nombre en pourcentage
 * @param value Valeur à formater
 * @param decimals Nombre de décimales (par défaut: 2)
 * @returns La valeur formatée en pourcentage
 */
export function formatPercentage(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}%`;
  } catch {
    return 'N/A';
  }
} 