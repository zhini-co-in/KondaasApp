// src/utils/SolarExportCalculator.js

/**
 * Calculator for solar export credit (surplus units fed to grid)
 * Supports flat rate (current TN/Kerala reality) and progressive slabs (for testing/legacy)
 */
class SolarExportCalculator {
  constructor() {
    this.slabsByMonth = {}; // monthKey → slabs array
  }

  /**
   * Add slabs for a specific month (or 'default')
   * @param {string} monthKey e.g. '2026-02' or 'default'
   * @param {Array} slabs [{from: number, to: number|'above', rate: number}]
   */
  addSlabs(monthKey, slabs) {
    const normalized = slabs.map(s => ({
      from: Number(s.from),
      to: s.to === 'above' || s.to === Infinity ? Infinity : Number(s.to),
      rate: Number(s.rate),
    })).sort((a, b) => a.from - b.from);

    this.slabsByMonth[monthKey] = normalized;
  }

  /**
   * Calculate credit for one month's exported units
   * @param {number} units Exported surplus units (kWh)
   * @param {string} monthKey 'YYYY-MM' or 'default'
   * @returns {number} Credit in ₹ (2 decimals)
   */
  calculateMonthlyCredit(units, monthKey = 'default') {
    if (units <= 0) return 0;

    const slabs = this.slabsByMonth[monthKey] || this.slabsByMonth['default'];
    if (!slabs || slabs.length === 0) {
      console.warn(`No slabs for ${monthKey} — using fallback flat rate`);
      return Number((units * 2.55).toFixed(2)); // default TN ~₹2.55/unit
    }

    let remaining = units;
    let credit = 0;

    for (const slab of slabs) {
      if (remaining <= 0) break;

      const slabEnd = slab.to === Infinity ? Infinity : slab.to;
      const slabUnits = Math.min(remaining, slabEnd - slab.from + 1);

      if (slabUnits > 0) {
        credit += slabUnits * slab.rate;
        remaining -= slabUnits;
      }
    }

    // Any leftover uses highest rate
    if (remaining > 0) {
      const lastRate = slabs[slabs.length - 1].rate;
      credit += remaining * lastRate;
    }

    return Number(credit.toFixed(2));
  }

  /**
   * Calculate total from monthly data object
   * @param {Object} monthlyExported { '2025-12': 520, '2026-01': 380, ... }
   * @returns {Object} { totalUnits, totalCredit, breakdown }
   */
  calculateFromMonthly(monthlyExported) {
    let totalUnits = 0;
    let totalCredit = 0;
    const breakdown = [];

    for (const [month, units] of Object.entries(monthlyExported || {})) {
      if (units <= 0) continue;

      const credit = this.calculateMonthlyCredit(units, month);
      totalUnits += units;
      totalCredit += credit;

      breakdown.push({ month, units, credit });
    }

    return {
      totalUnits: Number(totalUnits.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      breakdown,
    };
  }

  /**
   * Quick flat-rate helper (current TN/Kerala standard)
   * @param {number} units
   * @param {number} [rate=2.55] default TN feed-in
   */
  static flatCredit(units, rate = 2.55) {
    return Number((units * rate).toFixed(2));
  }
}

export default SolarExportCalculator;