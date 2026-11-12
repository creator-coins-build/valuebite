export interface DealComponent { quantity: number; calories: number | null; protein: number | null }
/** Bundles: totals reflect full quantity received (spec s17, s42). Unknown protein in any component -> unknown total. */
export function dealTotals(components: DealComponent[]) {
  let cal = 0, pro: number | null = 0;
  for (const c of components) {
    if (c.calories === null) return { calories: null, protein: null };
    cal += c.calories * c.quantity;
    pro = pro === null || c.protein === null ? null : pro + c.protein * c.quantity;
  }
  return { calories: cal, protein: pro };
}
