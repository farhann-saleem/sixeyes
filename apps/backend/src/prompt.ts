/** Owner lock 2026-09-13. Do not rewrite. ai33pro prepends `@img1` so the upload matches docs/apis/ai33pro.md. */
export const AVATAR_PROMPT = `Take the input image and upscale it to high resolution. Recover fine facial detail by sharpening the eyes, eyelashes, eyebrows, skin pores, and individual hair strands. Remove blur, motion smear, noise, grain, and JPEG/compression artifacts. Fix any exposure, shadow, or color-cast issues. Keep the person's identity, facial features, and age exactly the same — do not change the face.
Step 2 — Face-reference portrait: Using the restored image as the identity reference, render the exact same person as a clean, professional face-reference portrait. Preserve identity precisely — same facial structure, eyes, eyebrows, nose, lips, jawline, skin tone, hairline, hairstyle, and any distinctive marks (moles, freckles, scars). Do not beautify, slim, smooth, or age the face.
Pose & framing: front-facing, head-and-shoulders, looking straight into the camera, level eye line, neutral relaxed expression with mouth closed or a very slight smile, symmetric composition.
Lighting & background: soft, even studio lighting with no harsh shadows; plain seamless light-grey background; no props, no busy background, no other people.
Output: photorealistic, tack-sharp focus on the face, natural skin texture with visible pores (no plastic or over-smoothed look), 85mm portrait-lens look, shallow depth of field, high resolution, accurate unbiased color. The result must be immediately usable as an identity reference face.`;

/**
 * Qwen still gets AVATAR_PROMPT. ai33pro Seedream stayed `doing` with no %
 * for 15+ min on the 1423-char lock text. Vendor examples are one line + @imgN.
 */
export function ai33AvatarPrompt(): string {
  return "@img1 Keep this exact person. Front-facing head-and-shoulders identity portrait, plain light-grey studio background, even lighting, photorealistic, same face and age, no beautify.";
}
