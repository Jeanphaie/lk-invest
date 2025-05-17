"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatKCurrency = formatKCurrency;
exports.formatPercentage = formatPercentage;
/**
 * Formate un nombre en devise
 * @param value Valeur à formater
 * @param unit Unité de la devise (par défaut: '€')
 * @param decimals Nombre de décimales (par défaut: 0)
 * @returns La valeur formatée en devise
 */
function formatCurrency(value, unit = '€', decimals = 0) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${unit}`;
    }
    catch (_a) {
        return 'N/A';
    }
}
/**
 * Formate un nombre en milliers d'euros (k€)
 * @param value Valeur à formater
 * @param decimals Nombre de décimales (par défaut: 0)
 * @returns La valeur formatée en k€
 */
function formatKCurrency(value, decimals = 0) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return formatCurrency(numValue / 1000, 'k€', decimals);
    }
    catch (_a) {
        return 'N/A';
    }
}
/**
 * Formate un nombre en pourcentage
 * @param value Valeur à formater
 * @param decimals Nombre de décimales (par défaut: 2)
 * @returns La valeur formatée en pourcentage
 */
function formatPercentage(value, decimals = 2) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}%`;
    }
    catch (_a) {
        return 'N/A';
    }
}
