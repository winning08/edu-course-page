const PALETTE = {
  초록: { light: "#8aab5f", base: "#5b7f3f", deep: "#3c5a29" },
  노랑: { light: "#e8c667", base: "#d3a428", deep: "#a97e14" },
  빨강: { light: "#d3776d", base: "#b3423a", deep: "#832e28" },
  주황: { light: "#e0955c", base: "#c46a2e", deep: "#94491c" },
};

const TEXTURE_LABEL = { 단단함: "단단하고 매끈한 표면", 중간: "적당히 탄력 있는 표면", 말랑함: "말랑하고 처진 표면" };

export function buildSpecimenLabel(sample) {
  const texture = TEXTURE_LABEL[sample.texture] ?? sample.texture;
  return `${sample.color}색 과일 그림, ${texture}`;
}

export function buildSpecimenSvg(sample, uid = "specimen") {
  const palette = PALETTE[sample.color] ?? PALETTE.초록;
  const gradId = `grad-${uid}`;
  const patternId = `pattern-${uid}`;
  const blurId = `blur-${uid}`;

  let bodyShape;
  let strokeWidth;
  let patternDef = "";
  let patternFill = "";
  let highlight;
  let extras = "";

  if (sample.texture === "단단함") {
    bodyShape = `<circle cx="50" cy="63" r="32"/>`;
    strokeWidth = "2.2";
    patternDef = `<pattern id="${patternId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${palette.deep}" stroke-width="1.4" opacity=".4"/></pattern>`;
    patternFill = `<circle cx="50" cy="63" r="32" fill="url(#${patternId})"/>`;
    highlight = `<ellipse cx="39" cy="48" rx="6" ry="10" fill="#fff" opacity=".55"/>`;
  } else if (sample.texture === "말랑함") {
    bodyShape = `<path d="M50,32 C70,32 83,48 82,64 C81,84 66,95 49,95 C33,94 18,83 19,63 C20,45 31,32 50,32 Z"/>`;
    strokeWidth = "0.9";
    highlight = `<ellipse cx="40" cy="50" rx="14" ry="18" fill="#fff" opacity=".22" filter="url(#${blurId})"/>`;
    extras = `<path d="M34,80 Q42,86 50,81" stroke="${palette.deep}" stroke-width="1.3" fill="none" opacity=".4" stroke-linecap="round"/><path d="M50,84 Q60,90 68,82" stroke="${palette.deep}" stroke-width="1.3" fill="none" opacity=".4" stroke-linecap="round"/>`;
  } else {
    bodyShape = `<ellipse cx="50" cy="63" rx="32" ry="31"/>`;
    strokeWidth = "1.4";
    patternDef = `<pattern id="${patternId}" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${palette.deep}" opacity=".4"/></pattern>`;
    patternFill = `<ellipse cx="50" cy="63" rx="32" ry="31" fill="url(#${patternId})"/>`;
    highlight = `<ellipse cx="39" cy="49" rx="8" ry="13" fill="#fff" opacity=".4"/>`;
  }

  return `<svg viewBox="0 0 100 110" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.light}"/>
        <stop offset="100%" stop-color="${palette.base}"/>
      </linearGradient>
      <filter id="${blurId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2"/>
      </filter>
      ${patternDef}
    </defs>
    <path d="M50,20 L50,11" stroke="#6b4a2c" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="58" cy="14" rx="10" ry="5" fill="#4b7a3d" transform="rotate(-28 58 14)"/>
    <g fill="${`url(#${gradId})`}" stroke="${palette.deep}" stroke-width="${strokeWidth}">
      ${bodyShape}
    </g>
    ${patternFill}
    ${extras}
    ${highlight}
  </svg>`;
}
