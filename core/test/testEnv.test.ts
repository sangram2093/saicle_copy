describe("Test environment", () => {
  test("should have DBSAICLE_GLOBAL_DIR env var set to .dbsaicle-test", () => {
    expect(process.env.DBSAICLE_GLOBAL_DIR).toBeDefined();
    expect(process.env.DBSAICLE_GLOBAL_DIR)?.toMatch(/\.dbsaicle-test$/);
  });
});
