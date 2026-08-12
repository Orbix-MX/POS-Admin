import {
  PROFILE_DEFAULT_FEATURES,
  buildFeaturesForProfile,
} from './business-features';

// BP-02: pin the centralised profile → features initialisation. These are the
// only place the mapping is defined; the assertions match the BP-02 spec.
describe('PROFILE_DEFAULT_FEATURES (BP-02)', () => {
  it('RETAIL: recipes and kitchen off (default profile, conservative)', () => {
    const f = PROFILE_DEFAULT_FEATURES.RETAIL;
    expect(f.enableRecipes).toBe(false);
    expect(f.enableKitchen).toBe(false);
    expect(f.enableInventory).toBe(true);
  });

  it('RETAIL_MANUFACTURING: recipes and supplies on', () => {
    const f = PROFILE_DEFAULT_FEATURES.RETAIL_MANUFACTURING;
    expect(f.enableRecipes).toBe(true);
    expect(f.enableSupplies).toBe(true);
  });

  it('RESTAURANT: recipes, kitchen and tables on', () => {
    const f = PROFILE_DEFAULT_FEATURES.RESTAURANT;
    expect(f.enableRecipes).toBe(true);
    expect(f.enableKitchen).toBe(true);
    expect(f.enableTables).toBe(true);
  });

  it('MANUFACTURING: manufacturing on', () => {
    expect(PROFILE_DEFAULT_FEATURES.MANUFACTURING.enableManufacturing).toBe(true);
  });

  it('SERVICES: inventory off', () => {
    expect(PROFILE_DEFAULT_FEATURES.SERVICES.enableInventory).toBe(false);
  });

  it('buildFeaturesForProfile returns a fresh copy (no shared mutation)', () => {
    const a = buildFeaturesForProfile('RETAIL');
    a.enableKitchen = true;
    expect(PROFILE_DEFAULT_FEATURES.RETAIL.enableKitchen).toBe(false);
    expect(buildFeaturesForProfile('RETAIL').enableKitchen).toBe(false);
  });
});
