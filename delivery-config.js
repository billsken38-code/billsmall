export const defaultDeliveryConfig = {
  locations: [
    { value: "knust kumasi campus", label: "KNUST Kumasi", zone: "kumasi" },
    { value: "accra college of education", label: "Accra College of Education", zone: "accra" },
    { value: "knust obuasi campus", label: "KNUST Obuasi", zone: "obuasi" },
    { value: "legon", label: "Legon", zone: "accra" },
    { value: "kstu", label: "KsTU", zone: "kumasi" },
    { value: "govcco", label: "GOVCCO", zone: "volta" },
    { value: "uhas", label: "UHAS", zone: "volta" },
    { value: "hohoe nursing training", label: "HOHOE NURSING TRAINING", zone: "volta" },
    { value: "upsa", label: "UPSA", zone: "accra" }
  ],
  fees: {
    sameLocation: 5,
    sameZone: 15,
    defaultCrossZone: 25
  },
  zoneRoutes: [
    { zoneA: "kumasi", zoneB: "obuasi", fee: 20 },
    { zoneA: "accra", zoneB: "kumasi", fee: 30 },
    { zoneA: "accra", zoneB: "obuasi", fee: 30 },
    { zoneA: "volta", zoneB: "accra", fee: 30 },
    { zoneA: "volta", zoneB: "kumasi", fee: 30 },
    { zoneA: "volta", zoneB: "obuasi", fee: 30 }
  ]
};

export function slugifyLocationValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZone(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeDeliveryConfig(config = {}) {
  const fallback = defaultDeliveryConfig;

  const locations = Array.isArray(config.locations) ? config.locations : fallback.locations;
  const fees = config.fees || {};
  const zoneRoutes = Array.isArray(config.zoneRoutes) ? config.zoneRoutes : fallback.zoneRoutes;

  return {
    locations: locations
      .map((location) => ({
        value: slugifyLocationValue(location?.value || location?.label),
        label: String(location?.label || location?.value || "").trim(),
        zone: normalizeZone(location?.zone)
      }))
      .filter((location) => location.value && location.label && location.zone),
    fees: {
      sameLocation: Number(fees.sameLocation ?? fallback.fees.sameLocation),
      sameZone: Number(fees.sameZone ?? fallback.fees.sameZone),
      defaultCrossZone: Number(fees.defaultCrossZone ?? fallback.fees.defaultCrossZone)
    },
    zoneRoutes: zoneRoutes
      .map((route) => ({
        zoneA: normalizeZone(route?.zoneA),
        zoneB: normalizeZone(route?.zoneB),
        fee: Number(route?.fee ?? 0)
      }))
      .filter((route) => route.zoneA && route.zoneB && route.zoneA !== route.zoneB)
  };
}

export function getUniqueZones(deliveryConfig) {
  return [...new Set(
    normalizeDeliveryConfig(deliveryConfig).locations.map((location) => location.zone)
  )].sort();
}

export function getLocationZone(locationValue, deliveryConfig) {
  const normalizedValue = slugifyLocationValue(locationValue);
  const config = normalizeDeliveryConfig(deliveryConfig);
  const match = config.locations.find((location) => location.value === normalizedValue);
  return match?.zone || "";
}

function buildZonePairKey(zoneA, zoneB) {
  return [normalizeZone(zoneA), normalizeZone(zoneB)].sort().join("__");
}

export function calculateDeliveryFee(vendorLocation, customerLocation, deliveryConfig) {
  const config = normalizeDeliveryConfig(deliveryConfig);
  const normalizedVendorLocation = slugifyLocationValue(vendorLocation);
  const normalizedCustomerLocation = slugifyLocationValue(customerLocation);

  if (!normalizedVendorLocation || !normalizedCustomerLocation) return 0;

  if (normalizedVendorLocation === normalizedCustomerLocation) {
    return config.fees.sameLocation;
  }

  const vendorZone = getLocationZone(normalizedVendorLocation, config);
  const customerZone = getLocationZone(normalizedCustomerLocation, config);

  if (!vendorZone || !customerZone) {
    return config.fees.defaultCrossZone;
  }

  if (vendorZone === customerZone) {
    return config.fees.sameZone;
  }

  const routeKey = buildZonePairKey(vendorZone, customerZone);
  const matchingRoute = config.zoneRoutes.find((route) => {
    return buildZonePairKey(route.zoneA, route.zoneB) === routeKey;
  });

  return matchingRoute ? Number(matchingRoute.fee || 0) : config.fees.defaultCrossZone;
}
