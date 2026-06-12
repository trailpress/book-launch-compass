/**
 * KDP Royalty Calculator - Calcolo preciso delle royalties Amazon KDP
 * 
 * Formula: Royalty = (List Price × Royalty Rate) - Printing Cost
 * 
 * Printing Cost = Fixed Cost + (Per Page Cost × Page Count)
 * 
 * Rates and costs based on Amazon KDP official pricing (US marketplace):
 * https://kdp.amazon.com/en_US/help/topic/G201834340
 */

export interface KDPPrintingCosts {
  fixedCost: number;
  perPageCostBW: number;  // Black & White interior
  perPageCostColor: number; // Standard color interior
  perPageCostPremium: number; // Premium color interior
}

// Amazon KDP printing costs (USD) - Updated June 2023 pricing (currently in effect)
// Source: https://kdp.amazon.com/en_US/help/topic/G201834340
// NOTE: For paperback B&W books with 24-108 pages, KDP applies a flat $2.30 cost
//       (handled separately in calculatePrintingCost via SHORT_BOOK_FLAT_COST).
const PRINTING_COSTS: Record<string, KDPPrintingCosts> = {
  // Paperback costs (≥110 pages B&W, ≥72 pages color)
  paperback: {
    fixedCost: 1.00,           // Fixed cost per book (updated 2023)
    perPageCostBW: 0.012,      // $0.012 per page for B&W
    perPageCostColor: 0.017,   // $0.017 per page for standard color (updated 2023)
    perPageCostPremium: 0.065, // $0.065 per page for premium color (updated 2023)
  },
  // Hardcover (case laminate) costs
  hardcover: {
    fixedCost: 6.80,
    perPageCostBW: 0.027,      // Hardcover B&W per page (higher than paperback)
    perPageCostColor: 0.027,   // Hardcover standard color
    perPageCostPremium: 0.08,  // Hardcover premium color
  },
};

// Short B&W paperback books (24-108 pages) have a flat printing cost in the US marketplace
const SHORT_BW_PAPERBACK_FLAT_COST = 2.30;
const SHORT_BW_PAGE_THRESHOLD = 110;

// Minimum list prices by format and page count
const MIN_LIST_PRICES = {
  paperback: 0.99,
  hardcover: 9.99,
  ebook: 0.99,
};

// Royalty rates
const ROYALTY_RATES = {
  paperback: 0.60,   // 60% royalty on paperback
  hardcover: 0.60,   // 60% royalty on hardcover
  ebook35: 0.35,     // 35% royalty option for ebooks
  ebook70: 0.70,     // 70% royalty option for ebooks (with conditions)
};

// Expanded distribution takes additional 40% of list price
const EXPANDED_DISTRIBUTION_RATE = 0.40;

export interface RoyaltyCalculation {
  listPrice: number;
  printingCost: number;
  fixedCost: number;
  variableCost: number;
  grossRoyalty: number;
  netRoyalty: number;
  netRoyaltyExpanded: number;
  pageCount: number;
  format: string;
  isColor: boolean;
  breakdown: {
    royaltyRate: number;
    prePrintingRoyalty: number;
    printingDeduction: number;
    finalRoyalty: number;
  };
}

export interface DailyEarningsEstimate {
  conservative: number;  // Low BSR scenario
  expected: number;      // Average scenario
  optimistic: number;    // High BSR scenario
  dailySalesEstimate: number;
  royaltyPerCopy: number;
}

/**
 * Calculate printing cost for a book (US marketplace, current KDP pricing)
 */
export function calculatePrintingCost(
  pageCount: number,
  format: 'paperback' | 'hardcover' = 'paperback',
  isColor: boolean = false,
  isPremiumColor: boolean = false
): number {
  const costs = PRINTING_COSTS[format] || PRINTING_COSTS.paperback;

  // Short B&W paperbacks (24-108 pages) → flat $2.30
  if (
    format === 'paperback' &&
    !isColor &&
    !isPremiumColor &&
    pageCount >= 24 &&
    pageCount < SHORT_BW_PAGE_THRESHOLD
  ) {
    return SHORT_BW_PAPERBACK_FLAT_COST;
  }

  let perPageCost = costs.perPageCostBW;
  if (isPremiumColor) {
    perPageCost = costs.perPageCostPremium;
  } else if (isColor) {
    perPageCost = costs.perPageCostColor;
  }

  return costs.fixedCost + pageCount * perPageCost;
}

/**
 * Calculate KDP royalty for a paperback/hardcover book
 * 
 * Formula: Royalty = (List Price × 60%) - Printing Cost
 */
export function calculateRoyalty(
  listPrice: number,
  pageCount: number,
  format: 'paperback' | 'hardcover' = 'paperback',
  isColor: boolean = false,
  isPremiumColor: boolean = false
): RoyaltyCalculation {
  const costs = PRINTING_COSTS[format] || PRINTING_COSTS.paperback;
  const royaltyRate = ROYALTY_RATES[format] || 0.60;

  // Use shared printing-cost function so short-book pricing tier is honored
  const printingCost = calculatePrintingCost(pageCount, format, isColor, isPremiumColor);
  const fixedCost = costs.fixedCost;
  const variableCost = Math.max(0, printingCost - fixedCost);
  
  // Calculate royalty
  const prePrintingRoyalty = listPrice * royaltyRate;
  const netRoyalty = Math.max(0, prePrintingRoyalty - printingCost);
  
  // Expanded distribution royalty (40% of list price, minus printing)
  const expandedRoyalty = Math.max(0, (listPrice * EXPANDED_DISTRIBUTION_RATE) - printingCost);
  
  return {
    listPrice,
    printingCost,
    fixedCost,
    variableCost,
    grossRoyalty: prePrintingRoyalty,
    netRoyalty,
    netRoyaltyExpanded: expandedRoyalty,
    pageCount,
    format,
    isColor,
    breakdown: {
      royaltyRate,
      prePrintingRoyalty,
      printingDeduction: printingCost,
      finalRoyalty: netRoyalty,
    },
  };
}

/**
 * Estimate daily sales based on BSR
 * 
 * Amazon BSR correlation (approximate):
 * BSR 1-100: 100+ sales/day
 * BSR 100-500: 50-100 sales/day
 * BSR 500-1,000: 25-50 sales/day
 * BSR 1,000-5,000: 10-25 sales/day
 * BSR 5,000-10,000: 5-10 sales/day
 * BSR 10,000-50,000: 2-5 sales/day
 * BSR 50,000-100,000: 1-2 sales/day
 * BSR 100,000-200,000: 0.5-1 sales/day
 * BSR 200,000+: <0.5 sales/day
 */
export function estimateDailySalesFromBSR(bsr: number): { min: number; max: number; avg: number } {
  if (!bsr || bsr <= 0) return { min: 0, max: 0, avg: 0 };

  const anchors = [
    { bsr: 100, avg: 150 },
    { bsr: 500, avg: 75 },
    { bsr: 1000, avg: 35 },
    { bsr: 5000, avg: 15 },
    { bsr: 10000, avg: 7 },
    { bsr: 20000, avg: 4 },
    { bsr: 50000, avg: 2.5 },
    { bsr: 100000, avg: 1.5 },
    { bsr: 200000, avg: 0.7 },
    { bsr: 500000, avg: 0.3 },
    { bsr: 1000000, avg: 0.1 },
  ];

  if (bsr <= anchors[0].bsr) {
    const avg = Math.min(250, anchors[0].avg * Math.sqrt(anchors[0].bsr / Math.max(1, bsr)));
    return { min: avg * 0.65, max: avg * 1.45, avg };
  }

  const upper = anchors.find((anchor) => bsr <= anchor.bsr) || anchors[anchors.length - 1];
  const lowerIndex = Math.max(0, anchors.indexOf(upper) - 1);
  const lower = anchors[lowerIndex];
  const logRatio =
    (Math.log(bsr) - Math.log(lower.bsr)) /
    (Math.log(upper.bsr) - Math.log(lower.bsr));
  const avg = lower.avg + (upper.avg - lower.avg) * Math.max(0, Math.min(1, logRatio));

  return {
    min: avg * 0.65,
    max: avg * 1.45,
    avg,
  };
}

/**
 * Calculate daily earnings estimate based on BSR and book details
 */
export function calculateDailyEarnings(
  bsr: number,
  listPrice: number,
  pageCount: number,
  format: 'paperback' | 'hardcover' = 'paperback',
  isColor: boolean = false
): DailyEarningsEstimate {
  const royaltyCalc = calculateRoyalty(listPrice, pageCount, format, isColor);
  const salesEstimate = estimateDailySalesFromBSR(bsr);
  
  return {
    conservative: salesEstimate.min * royaltyCalc.netRoyalty,
    expected: salesEstimate.avg * royaltyCalc.netRoyalty,
    optimistic: salesEstimate.max * royaltyCalc.netRoyalty,
    dailySalesEstimate: salesEstimate.avg,
    royaltyPerCopy: royaltyCalc.netRoyalty,
  };
}

/**
 * Format royalty for display
 */
export function formatRoyalty(amount: number): string {
  if (!amount || amount <= 0) return 'N/A';
  if (amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}

/**
 * Determine if a book is likely color based on category/title
 */
export function isLikelyColorBook(title: string, category?: string): boolean {
  const colorKeywords = [
    'coloring', 'activity', 'workbook', 'puzzle', 'sudoku',
    'crossword', 'children', 'kids', 'pictures', 'illustrated',
    'photo', 'photography', 'cookbook', 'recipe', 'art',
    'design', 'graphic', 'comic', 'manga', 'journal',
  ];
  
  const lowerTitle = title.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  return colorKeywords.some(kw => 
    lowerTitle.includes(kw) || lowerCategory.includes(kw)
  );
}

/**
 * Estimate page count from book type if not provided
 */
export function estimatePageCount(title: string, format?: string): number {
  const lowerTitle = title.toLowerCase();
  
  // Low content books typically have fewer pages
  if (/journal|notebook|planner|log|tracker|diary/i.test(lowerTitle)) {
    return 120;
  }
  
  // Workbooks and activity books
  if (/workbook|activity|puzzle|coloring/i.test(lowerTitle)) {
    return 100;
  }
  
  // Travel guides tend to be longer
  if (/guide|travel|handbook/i.test(lowerTitle)) {
    return 200;
  }
  
  // Default for regular books
  return 150;
}
