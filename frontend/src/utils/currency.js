export function formatINR(value, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(Number(value) || 0);
}
