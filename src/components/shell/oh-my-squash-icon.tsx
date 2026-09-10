/**
 * OhMySquash app mark, redrawn as a monochrome vector.
 *
 * Their own icon ships as a PNG baked onto a light plate, which would sit as a
 * bright square in the dark shell. The mark is single-colour anyway (court arc,
 * two balls, a ragged block of binary), so it is traced here and painted with
 * `currentColor`: the surrounding text colour carries it through both themes.
 * Coordinates are kept in the source 192px space, cropped to the artwork.
 */
export function OhMySquashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="37 37 118 118"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Court arc: open to the right, where the balls sit. */}
      <path d="M93.5 51.2A46.5 46.5 0 1 0 108.6 139.9" strokeWidth="5" />
      <circle cx="88" cy="97.5" r="7" fill="currentColor" stroke="none" />
      <circle cx="109" cy="101.5" r="7" fill="currentColor" stroke="none" />
      {/* "101 / 01 / 10 / 01 / 1" - the digits of the tagline. */}
      <g strokeWidth="2.4">
        <path d="M107 48.5 110 45.5V56" />
        <ellipse cx="128.5" cy="50.5" rx="3" ry="5" />
        <path d="M145 48.5 147.5 45.5V56" />
        <ellipse cx="128.5" cy="71.5" rx="3" ry="5" />
        <path d="M145 69.5 147.5 66.5V77" />
        <path d="M126 91 129 88V98.5" />
        <ellipse cx="147.5" cy="93" rx="3" ry="5" />
        <ellipse cx="128.5" cy="114" rx="3" ry="5" />
        <path d="M145 112 147.5 109V119.5" />
        <path d="M126 133 129 130V141" />
      </g>
    </svg>
  );
}

export const OH_MY_SQUASH_URL = "https://ohmysquash.ohmyapps.xyz/";
