// src/utils/SolarExportCalculator.js

/**
 * Generic calculator for solar export credit or consumption bill
 * - Uses Firestore template for slabs (per state)
 * - Supports Tamil Nadu progressive
 * - Supports Kerala telescopic (≤250) + non-telescopic (>250 flat on all units)
 * - Adds fixed charge if provided
 */
class SolarExportCalculator {
  constructor() {
    this.configByMonth = {}; // monthKey → { state, slabs, fixedCharge?, type? }
  }

  /**
   * Add slab configuration for a month (from Firestore template)
   * @param {string} monthKey 'YYYY-MM' or 'default'
   * @param {Array|Object} slabsOrTemplate - raw slabs array or full template object
   * @param {string} [state='tamil-nadu'] - 'tamil-nadu' or 'kerala'
   * @param {number} [fixedCharge=0] - monthly fixed charge
   */
  addConfig(monthKey, template, overrideFixedCharge = 0) {
    if (!template || typeof template !== 'object') {
      console.warn(`Invalid template for ${monthKey}`);
      this.configByMonth[monthKey] = {
        state: 'tamil-nadu',
        type: 'progressive',
        slabs: [],
        fixedCharge: 0,
        rawTemplate: null
      };
      return;
    }

    const state = (template.state || 'tamil-nadu').toLowerCase();
    const type = template.type || 'progressive';
    let slabs = [];
    let fixedCharge = overrideFixedCharge || template.fixedCharge || 0;
    if (state === 'kerala') {
      // Store BOTH telescopic and non-telescopic separately
      this.configByMonth[monthKey] = {
        state,
        type,
        telescopicSlabs: template.slabs?.telescopic_up_to_250 || [],
        nonTelescopicSlabs: template.slabs?.non_telescopic_above_250 || [],
        fixedCharge: Number(fixedCharge),
        rawTemplate: template
      };
    } else {
      // TN or default progressive
let slabsArray = template.slabs;

  // If no 'slabs' key → assume the object itself is the slabs (TN style)
  if (!slabsArray) {
    slabsArray = Object.entries(template)
      .filter(([key]) => key !== 'state') // remove state key
      .map(([_, slab]) => slab);           // take values as slab objects
  }

    // Normalize slabs
    const normalizedSlabs = (Array.isArray(slabsArray) ? slabsArray : []).map(s => ({
      from: Number(s.from || 0),
      to: s.to === 'above' || s.to == null ? Infinity : Number(s.to),
      rate: Number(s.rate || 0),
    })).filter(s => !isNaN(s.from) && !isNaN(s.rate)); // filter invalid

    normalizedSlabs.sort((a, b) => a.from - b.from);

      this.configByMonth[monthKey] = {
        state,
        type,
        slabs: normalizedSlabs,
        fixedCharge: Number(fixedCharge),
        rawTemplate: template
      };
    }
  }
  /**
   * Calculate credit/bill for one month's units
   * @param {number} units - Exported or consumed kWh
   * @param {string} monthKey 'YYYY-MM' or 'default'
   * @returns {number} Total ₹ (2 decimals)
   */
calculateMonthlyCredit(units, monthKey = 'default') {
  if (units <= 0) return 0;

  const config = this.configByMonth[monthKey] || this.configByMonth['default'];
  if (!config) {
    console.warn(`No config for ${monthKey} — cost = 0`);
    return 0;
  }
  console.log('Ezhil calculateMonthlyCredit config:', config, 'for units:', units, 'monthKey:', monthKey);
  const { state, fixedCharge = 0, rawTemplate } = config;
  const lowerState = state.toLowerCase();
  let cost = 0;

  if (lowerState === 'kerala') {
    const telescopic = rawTemplate?.slabs?.telescopic_up_to_250 || [];
    const nonTelescopic = rawTemplate?.slabs?.non_telescopic_above_250 || [];

    // Dynamically get the telescopic threshold from the last 'to' in telescopic slabs
    let telescopicThreshold = 250;
    if (telescopic.length > 0) {
      const lastTelescopic = telescopic[telescopic.length - 1];
      telescopicThreshold = lastTelescopic.to === 'above' || lastTelescopic.to == null 
        ? Infinity 
        : Number(lastTelescopic.to);
    }

    if (units <= telescopicThreshold) {
      // Telescopic - progressive
      let remaining = units;
      for (const slab of telescopic) {
        if (remaining <= 0) break;
        const slabEnd = slab.to === 'above' || slab.to == null ? Infinity : slab.to;
        const slabUnits = Math.min(remaining, slabEnd - slab.from + 1);
        cost += slabUnits * slab.rate;
        remaining -= slabUnits;
      }
    } else {
      // Non-telescopic - flat rate on entire consumption
      let rate = 9.20; // fallback highest (can be in template if needed)
      for (const slab of nonTelescopic) {
        const from = Number(slab.from || 0);
        const to = slab.to === 'above' || slab.to == null ? Infinity : Number(slab.to);
        if (units >= from && units <= to) {
          rate = Number(slab.rate);
          break;
        }
      }
      cost = units * rate;
    }
  } else {
    // Default progressive (TN style)
    const slabs = config.slabs || [];
    let remaining = units;
    for (const slab of slabs) {
      if (remaining <= 0) break;
      const slabEnd = slab.to === 'above' || slab.to == null ? Infinity : slab.to;
      const slabUnits = Math.min(remaining, slabEnd - slab.from + 1);
      if (slabUnits > 0) {
        cost += slabUnits * slab.rate;
        remaining -= slabUnits;
      }
    }
    if (remaining > 0) {
      const lastRate = slabs[slabs.length - 1]?.rate || 0;
      cost += remaining * lastRate;
    }
  }

  cost += fixedCharge;

  return Number(cost.toFixed(2));
}
  /**
   * Calculate total from monthly exported/consumed data
   * @param {Object} monthlyData { '2025-12': 1404.6, '2026-01': 1078.96, ... }
   * @returns {Object} { totalUnits, totalCost, breakdown }
   */
  calculateFromMonthly(monthlyData) {
    let totalUnits = 0;
    let totalCost = 0;
    const breakdown = [];

    for (const [month, units] of Object.entries(monthlyData || {})) {
      if (units <= 0) continue;

      const cost = this.calculateMonthlyCredit(units, month);
      totalUnits += units;
      totalCost += cost;

      breakdown.push({
        month,
        units: Number(units.toFixed(2)),
        cost: Number(cost.toFixed(2))
      });
    }

    return {
      totalUnits: Number(totalUnits.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      breakdown,
    };
  }

  /**
   * Quick flat-rate helper (for fallback or simple cases)
   */
  static flatCredit(units, rate = 2.55, fixedCharge = 0) {
    return Number((units * rate + fixedCharge).toFixed(2));
  }
}

export default SolarExportCalculator;