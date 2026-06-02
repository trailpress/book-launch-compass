export const TRAD_PUBLISHER_KEYWORDS = [
  'FAA', 'Federal', 'Administration', 'Association', 'Publishing', 'Press', 'House', 
  'Inc.', 'LLC', 'Company', 'University', 'Institute', 'Academic', 'McGraw', 'Wiley', 
  'Pearson', 'Penguin', 'Random House', 'Simon', 'Scholastic', 'Harper', 'Houghton', 
  'Cengage', 'Macmillan', 'Mometrix', 'Oxford', 'Cambridge', 'Hachette', 'Little, Brown',
  'Knopf', 'Abrams', 'Chronicle', 'Workman', 'Callisto', 'Rockridge', 'Sourcebooks',
  'National Geographic', 'Discovery', 'Disney', 'Marvel', 'DC Comics', 'Kensington',
  'Zondervan', 'Thomas Nelson', 'Hay House', 'Tyndale', 'Baker', 'Bloomsbury'
];

export const TRAD_PUBLISHER_REGEX = new RegExp(`\\b(${TRAD_PUBLISHER_KEYWORDS.join('|')})\\b`, 'i');

export const isTraditionalPublisher = (author: string): boolean => {
  if (!author) return false;
  // "Independently published" is a classic KDP label, definitely not traditional
  if (author.toLowerCase().includes('independently published')) return false;
  return TRAD_PUBLISHER_REGEX.test(author);
};

export const cleanAuthorName = (author: string): string => {
  if (!author) return 'Unknown Author';
  if (author.toLowerCase().includes('independently published')) {
    return 'Self-Published';
  }
  return author;
};

export interface CompetitorBook {
  rank: number;
  title: string;
  author: string;
  asin: string;
  coverUrl: string;
  bsr: number;
  reviews: number;
  rating: number;
  price: number;
  estMonthlySales: number;
  estMonthlyRevenue: number;
  profitPerCopy: number;
  format: string;
  pages: number;
  trend: "up" | "stable" | "down";
  publishDate: string;
  historicalData?: any;
}

/**
 * Sorts and selects competitors based on the requirement:
 * - Sort primarily by BSR (lowest first)
 * - If top 3 doesn't have a self-publisher, but one exists in the top 4, include it.
 * - Always show at least 3, up to 4 if needed to include a self-publisher.
 */
export function selectTopCompetitors(competitors: any[]): any[] {
  if (!competitors || competitors.length === 0) return [];

  // 1. Sort by BSR primarily, then reviews as fallback
  const sortedByBSR = [...competitors].sort((a, b) => {
    const aHasValidBsr = a.bsr > 0;
    const bHasValidBsr = b.bsr > 0;
    
    if (aHasValidBsr && bHasValidBsr) return a.bsr - b.bsr;
    if (aHasValidBsr) return -1;
    if (bHasValidBsr) return 1;
    return (b.reviews || 0) - (a.reviews || 0);
  });

  const top4 = sortedByBSR.slice(0, 4);
  const selfPubInTop4 = top4.find(c => !isTraditionalPublisher(c.author));
  
  if (selfPubInTop4) {
    // We have at least one self-publisher in the top 4.
    // If it's at position 4, we show all 4 to satisfy the requirement.
    const selfPubIndex = top4.indexOf(selfPubInTop4);
    if (selfPubIndex === 3) {
      return top4; // Show all 4
    }
    return top4.slice(0, 3); // Show top 3 (which already contains a self-pub)
  }

  // If no self-publisher in top 4, just show top 3
  return top4.slice(0, 3);
}
