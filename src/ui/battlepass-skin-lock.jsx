import { useId } from "react";

/** A complete cover: the unrevealed skin image is never needed underneath. */
export function BattlePassSkinLock({ className = "" }) {
  const id = useId();
  const links = Array.from({ length: 19 }, (_, i) => -266 + i * 28);

  return (
    <div className={`skin-pass-lock ${className}`}>
      <svg
        viewBox="0 0 300 400"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id={`${id}-background`} cx="50%" cy="46%" r="74%">
            <stop offset="0" stopColor="#362743" />
            <stop offset="0.58" stopColor="#172038" />
            <stop offset="1" stopColor="#080f1e" />
          </radialGradient>
          <linearGradient id={`${id}-metal`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#5c626d" />
            <stop offset="0.3" stopColor="#d5d3c7" />
            <stop offset="0.52" stopColor="#a6a79e" />
            <stop offset="0.78" stopColor="#747783" />
            <stop offset="1" stopColor="#b9b7a9" />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f0d59a" />
            <stop offset="0.4" stopColor="#aa8650" />
            <stop offset="0.7" stopColor="#e0bd78" />
            <stop offset="1" stopColor="#79603e" />
          </linearGradient>
          <radialGradient id={`${id}-medal`} cx="42%" cy="30%" r="80%">
            <stop offset="0" stopColor="#302943" />
            <stop offset="1" stopColor="#10192b" />
          </radialGradient>
        </defs>

        <rect width="300" height="400" fill={`url(#${id}-background)`} />
        <rect
          x="13"
          y="13"
          width="274"
          height="374"
          rx="12"
          fill="none"
          stroke="#b69a65"
          strokeOpacity="0.46"
          strokeWidth="2"
        />
        <rect
          x="23"
          y="23"
          width="254"
          height="354"
          rx="6"
          fill="none"
          stroke="#a397b4"
          strokeOpacity="0.16"
        />
        <path
          d="M150 45 250 200 150 355 50 200Z M150 75 230 200 150 325 70 200Z"
          fill="none"
          stroke="#b6a0c2"
          strokeOpacity="0.1"
          strokeWidth="2"
        />
        <path
          d="M29 63V29H63 M237 29H271V63 M271 337V371H237 M63 371H29V337"
          fill="none"
          stroke={`url(#${id}-gold)`}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />

        {[-37, 37].map((angle) => (
          <g key={angle} transform={`translate(150 200) rotate(${angle})`}>
            <path
              d="M0-280V280"
              stroke="#050911"
              strokeWidth="32"
              opacity="0.6"
            />
            {links.map((y, i) => (
              <g key={y} transform={`translate(0 ${y})`}>
                <rect
                  x={i % 2 ? -16 : -11}
                  y={i % 2 ? -9 : -21}
                  width={i % 2 ? 32 : 22}
                  height={i % 2 ? 18 : 42}
                  rx={i % 2 ? 9 : 11}
                  fill="none"
                  stroke="#070b13"
                  strokeWidth="9"
                />
                <rect
                  x={i % 2 ? -16 : -11}
                  y={i % 2 ? -9 : -21}
                  width={i % 2 ? 32 : 22}
                  height={i % 2 ? 18 : 42}
                  rx={i % 2 ? 9 : 11}
                  fill="none"
                  stroke={`url(#${id}-metal)`}
                  strokeWidth="5.5"
                />
                <path
                  d={i % 2 ? "M-8-9H8" : "M-11-5V-10Q-11-21 0-21"}
                  fill="none"
                  stroke="#eee6cf"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.75"
                />
              </g>
            ))}
          </g>
        ))}

        <circle cx="150" cy="205" r="65" fill="#030711" opacity="0.7" />
        <circle
          cx="150"
          cy="200"
          r="61"
          fill={`url(#${id}-medal)`}
          stroke={`url(#${id}-gold)`}
          strokeWidth="5"
        />
        <circle
          cx="150"
          cy="200"
          r="52"
          fill="none"
          stroke="#b59a68"
          strokeOpacity="0.45"
        />
        {[0, 90, 180, 270].map((angle) => (
          <circle
            key={angle}
            cx="150"
            cy="143"
            r="2.4"
            transform={`rotate(${angle} 150 200)`}
            fill="#f0d49d"
          />
        ))}
        {/* A path keeps the question mark clear without loading a font. */}
        <path
          d="M130 181C130 165 147 159 161 164C176 169 179 184 170 194C164 201 150 203 150 215"
          fill="none"
          stroke="#fff0c3"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle cx="150" cy="233" r="5.3" fill="#fff0c3" />
      </svg>
    </div>
  );
}
