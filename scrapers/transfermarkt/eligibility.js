const MOROCCO = "morocco";

// Pure eligibility classifier. Input is derived from a parsed profile plus an
// optional manual override. Returns { status, moroccanEligible, reason }.
//
// Rules (PLAN.md §1):
//   - override wins over everything (include => eligible, exclude => excluded)
//   - not Moroccan-eligible                          => excluded
//   - Moroccan + 0 senior "A" caps                   => eligible   (the target pool)
//   - Moroccan + senior caps for Morocco             => excluded   (already secured)
//   - Moroccan + senior caps for another country     => review     (friendlies don't cap-tie)
// Youth caps never count as senior caps (handled upstream: seniorCaps === 0 for youth).
function classifyEligibility({
  citizenships = [],
  seniorCaps = 0,
  nationalTeam = null,
  override = null,
}) {
  if (override && override.action === "exclude") {
    return { status: "excluded", moroccanEligible: false, reason: "override-exclude" };
  }
  if (override && override.action === "include") {
    return { status: "eligible", moroccanEligible: true, reason: "override-include" };
  }

  const moroccanEligible = citizenships.some((c) => c && c.toLowerCase() === MOROCCO);
  if (!moroccanEligible) {
    return { status: "excluded", moroccanEligible: false, reason: "not-moroccan" };
  }

  if (seniorCaps > 0) {
    const seniorCountry =
      nationalTeam && !nationalTeam.isYouth ? (nationalTeam.country || "").toLowerCase() : "";
    if (seniorCountry === MOROCCO) {
      return { status: "excluded", moroccanEligible: true, reason: "already-morocco-senior" };
    }
    return { status: "review", moroccanEligible: true, reason: "senior-caps-other-country" };
  }

  return { status: "eligible", moroccanEligible: true, reason: "uncapped" };
}

module.exports = { classifyEligibility };
