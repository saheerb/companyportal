export const SCENES: Record<string, { label: string; prompt: string; preview: string }> = {
  outdoor: {
    label: "Outdoor",
    preview: "☀️",
    prompt:
      "Replace ONLY the background of this car photo with a clean outdoor setting: bright blue sky with light clouds, green grass or tarmac surface. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.",
  },
  showroom: {
    label: "Showroom",
    preview: "🏢",
    prompt:
      "Replace ONLY the background of this car photo with a premium indoor car showroom: white walls, polished white/grey floor, professional spotlights above. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.",
  },
  urban: {
    label: "Urban",
    preview: "🌆",
    prompt:
      "Replace ONLY the background of this car photo with a city street scene at golden hour: urban buildings, street lights beginning to glow, warm sunset light. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.",
  },
  nature: {
    label: "Nature",
    preview: "🌿",
    prompt:
      "Replace ONLY the background of this car photo with a scenic countryside road: lush green hills, trees, open sky. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.",
  },
};
