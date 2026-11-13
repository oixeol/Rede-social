/**
 * Fundo decorativo da página de login.
 *
 * Reproduz a referência visual: base preta, fitas/ondas laranja fluidas nos
 * cantos superior direito e inferior esquerdo, coroa 3D à esquerda, estrela
 * de quatro pontas à direita e pequenos quadrados orange espalhados.
 *
 * Puramente decorativo: não recebe foco nem interação.
 */
export function LoginBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Brilhos difusos */}
      <div className="absolute -top-[260px] -right-[220px] h-[760px] w-[980px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,106,0,0.26),rgba(255,69,0,0.08)_52%,transparent_72%)] blur-[14px]" />
      <div className="absolute -bottom-[300px] -left-[240px] h-[820px] w-[1020px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,69,0,0.24),rgba(255,106,0,0.07)_52%,transparent_72%)] blur-[14px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(255,106,0,0.07),transparent_60%)]" />

      {/* Fitas / ondas de seda laranja */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="vibra-ribbon-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF4500" stopOpacity="0.92" />
            <stop offset="0.42" stopColor="#FF6A00" stopOpacity="0.78" />
            <stop offset="0.78" stopColor="#FF8C00" stopOpacity="0.42" />
            <stop offset="1" stopColor="#FF8C00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vibra-ribbon-top-2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF8C00" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#FF4500" stopOpacity="0.45" />
            <stop offset="1" stopColor="#FF4500" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vibra-ribbon-bottom" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#FF4500" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#FF6A00" stopOpacity="0.72" />
            <stop offset="0.8" stopColor="#FF8C00" stopOpacity="0.38" />
            <stop offset="1" stopColor="#FF8C00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vibra-ribbon-bottom-2" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#FF8C00" stopOpacity="0.5" />
            <stop offset="0.55" stopColor="#FF4500" stopOpacity="0.42" />
            <stop offset="1" stopColor="#FF4500" stopOpacity="0" />
          </linearGradient>
          <filter id="vibra-ribbon-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="vibra-ribbon-blur-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>

        <g filter="url(#vibra-ribbon-blur)" fill="none" strokeLinecap="round">
          <path
            d="M905 -140 C 1120 10, 1128 168, 1330 226 C 1432 258, 1486 214, 1536 150"
            stroke="url(#vibra-ribbon-top)"
            strokeWidth="74"
          />
          <path
            d="M980 -170 C 1180 8, 1160 120, 1360 168 C 1448 188, 1496 152, 1536 96"
            stroke="url(#vibra-ribbon-top-2)"
            strokeWidth="34"
          />
          <path
            d="M1010 20 C 1180 92, 1206 214, 1372 268 C 1448 296, 1494 268, 1526 214"
            stroke="url(#vibra-ribbon-top-2)"
            strokeWidth="18"
          />
        </g>

        <g filter="url(#vibra-ribbon-blur-soft)" fill="none" strokeLinecap="round">
          <path
            d="M-120 940 C 90 830, 250 742, 470 786 C 662 824, 742 940, 940 968"
            stroke="url(#vibra-ribbon-bottom)"
            strokeWidth="118"
          />
          <path
            d="M-100 1000 C 120 908, 286 862, 468 898 C 640 932, 726 1012, 880 1032"
            stroke="url(#vibra-ribbon-bottom-2)"
            strokeWidth="52"
          />
        </g>
      </svg>

      {/* Coroa 3D à esquerda */}
      <svg
        className="absolute top-[26%] left-[3%] h-[210px] w-[210px] rotate-[-14deg] drop-shadow-[0_24px_46px_rgba(255,69,0,0.45)]"
        viewBox="0 0 200 200"
        focusable="false"
      >
        <defs>
          <linearGradient id="vibra-crown" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD08A" />
            <stop offset="0.28" stopColor="#FF8C00" />
            <stop offset="0.68" stopColor="#FF4500" />
            <stop offset="1" stopColor="#B32C00" />
          </linearGradient>
          <linearGradient id="vibra-crown-dark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7A1D00" />
            <stop offset="0.5" stopColor="#FF6A00" />
            <stop offset="1" stopColor="#611600" />
          </linearGradient>
          <radialGradient id="vibra-crown-glow" cx="0.35" cy="0.25" r="0.75">
            <stop offset="0" stopColor="#FFE0B0" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#FF8C00" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FF4500" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="96" r="86" fill="url(#vibra-crown-glow)" />
        <path
          d="M40 146 L52 62 L80 104 L100 44 L120 104 L148 62 L160 146 Z"
          fill="url(#vibra-crown)"
        />
        <path d="M40 146 L160 146 L154 168 L46 168 Z" fill="url(#vibra-crown-dark)" />
        <circle cx="52" cy="56" r="10" fill="#FFC46B" />
        <circle cx="100" cy="38" r="11" fill="#FFD79A" />
        <circle cx="148" cy="56" r="10" fill="#FF9A2E" />
        <path d="M70 118 L84 96 L100 122 L116 96 L130 118 L100 140 Z" fill="url(#vibra-crown-glow)" opacity="0.85" />
      </svg>

      {/* Estrela de quatro pontas à direita */}
      <svg
        className="absolute top-[42%] right-[4%] h-[190px] w-[190px] rotate-[18deg] drop-shadow-[0_22px_44px_rgba(255,106,0,0.5)]"
        viewBox="0 0 200 200"
        focusable="false"
      >
        <defs>
          <linearGradient id="vibra-star" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFB25C" />
            <stop offset="0.45" stopColor="#FF6A00" />
            <stop offset="1" stopColor="#FF4500" />
          </linearGradient>
        </defs>
        <path
          d="M100 6 C 112 62, 138 88, 194 100 C 138 112, 112 138, 100 194 C 88 138, 62 112, 6 100 C 62 88, 88 62, 100 6 Z"
          fill="url(#vibra-star)"
        />
        <path
          d="M100 30 C 108 70, 126 90, 168 100 C 126 110, 108 130, 100 170 C 92 130, 74 110, 32 100 C 74 90, 92 70, 100 30 Z"
          fill="rgba(255,224,190,0.28)"
        />
      </svg>

      {/* Quadrados decorativos */}
      {[
        { top: '13%', left: '12%', size: 9, opacity: 0.9, rotate: 0 },
        { top: '30%', left: '20%', size: 6, opacity: 0.6, rotate: 0 },
        { top: '8%', left: '31%', size: 5, opacity: 0.5, rotate: 0 },
        { top: '72%', left: '10%', size: 7, opacity: 0.55, rotate: 45 },
        { top: '84%', left: '28%', size: 5, opacity: 0.45, rotate: 45 },
        { top: '62%', left: '91%', size: 8, opacity: 0.75, rotate: 45 },
        { top: '22%', left: '88%', size: 6, opacity: 0.6, rotate: 0 },
        { top: '88%', left: '78%', size: 6, opacity: 0.5, rotate: 0 },
        { top: '48%', left: '5%', size: 5, opacity: 0.4, rotate: 0 },
        { top: '17%', left: '62%', size: 4, opacity: 0.35, rotate: 0 },
      ].map((square, index) => (
        <span
          key={index}
          className="absolute bg-[#FF6A00]"
          style={{
            top: square.top,
            left: square.left,
            width: square.size,
            height: square.size,
            opacity: square.opacity,
            transform: `rotate(${square.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
