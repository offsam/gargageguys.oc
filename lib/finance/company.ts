export const COMPANY = {
  name: "Garage Guys",
  tagline: "Garage Door Repair",
  area: "Orange County, CA",
  city: "Newport Beach, CA 92660",
  phone: "(949) 539-0009",
  phoneHref: "tel:+19495390009",
  website: "garageguysoc.com",
  websiteUrl: "https://garageguysoc.com",
} as const;

export function publicSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return COMPANY.websiteUrl;
}

export function invoicePublicUrl(token: string) {
  return `${publicSiteUrl()}/i/${token}`;
}
