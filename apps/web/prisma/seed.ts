/**
 * SENSA seed. The UI-complete build renders from the deterministic mock
 * dataset (src/lib/mock.ts), so there is nothing to seed yet.
 * When the real device flow lands, this seeds:
 *   - a wearer account + caregiver account (Better Auth rows)
 *   - their device, threshold defaults, and DeviceMember links
 */
async function main() {
  console.log('sensa: nothing to seed yet; the UI runs on the mock dataset')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
