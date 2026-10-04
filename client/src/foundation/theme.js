// Impostor.exe theme for React (inline styles, styled-components, MUI theme, etc.)
// Mirrors tokens.css. Use CSS variables (var(--yellow-500)) where you can; use this object where you need JS values.
export const theme = {
  "color": {
    "bgVoid": "#03050C",
    "bgBase": "#070B18",
    "surface100": "#0A0F20",
    "surface200": "#0F1630",
    "surface300": "#141D38",
    "surface400": "#18213D",
    "surfaceSelect": "#1C2850",
    "line100": "#1E2A4A",
    "line200": "#2A3558",
    "lineDashed": "#3A4A78",
    "ink": "#EAF0FF",
    "inkSoft": "#C9D3EE",
    "inkMuted": "#9FB0D8",
    "inkDim": "#8E9BC2",
    "inkFaint": "#6E7AA0",
    "inkOnYellow": "#0A0F1E",
    "cyanInk": "#04222A",
    "yellow500": "#FFCF3F",
    "yellow700": "#B38A12",
    "cyan500": "#38E1FF",
    "cyan700": "#127A90",
    "green500": "#4ADE80",
    "green700": "#1F8A45",
    "red500": "#FF3D5A",
    "red300": "#FF6B81",
    "red700": "#8A0F24",
    "redSurface": "#3A0A14",
    "orange500": "#FF8A1F",
    "orange700": "#9A4A00",
    "ghost500": "#5AA8FF",
    "ghost300": "#9FD8FF",
    "panelBg": "#0D121C",
    "panelInset": "#0A0E15",
    "panelLine": "rgba(148,163,184,0.16)",
    "panelInk": "#D5DCE6",
    "panelMuted": "#7C8799",
    "panelAccent": "#5CE1E6",
    "panelAlert": "#FF6B7D",
    "panelWarn": "#F5B84B",
    "mapGround": "#07090C",
    "mapFloor": "#16191F",
    "mapWall": "#3A414C",
    "mapWallOuter": "#2E343D",
    "mapGlass": "rgba(160,210,240,0.3)",
    "mapDoor": "#7FE3FF",
    "mapDesk": "#434A55",
    "mapTask": "#3FAE5A",
    "mapEmergency": "#FF4D63",
    "avatarCyan": "#29D3E6",
    "avatarRed": "#E5484D",
    "avatarBlue": "#3E63DD",
    "avatarGreen": "#30A46C",
    "avatarYellow": "#F5D90A",
    "avatarOrange": "#F76B15",
    "avatarPurple": "#8E4EC6",
    "avatarPink": "#E93D82",
    "avatarLime": "#99D52A",
    "avatarWhite": "#EDEEF0",
    "avatarBrown": "#8D5A3B",
    "avatarSlate": "#5B6478"
  },
  "space": {
    "space1": "4px",
    "space2": "8px",
    "space3": "12px",
    "space4": "16px",
    "space6": "24px",
    "space8": "32px",
    "space12": "48px",
    "gridMenu": "40px"
  },
  "radius": {
    "radiusXs": "6px",
    "radiusSm": "10px",
    "radiusMd": "14px",
    "radiusLg": "18px",
    "radiusXl": "22px",
    "radiusFrame": "28px",
    "radiusPill": "999px"
  },
  "shadow": {
    "pressYellow": "0 6px 0 #B38A12",
    "pressCyan": "0 6px 0 #127A90",
    "pressRed": "0 6px 0 #8A0F24",
    "pressNeutral": "0 5px 0 #0A1022",
    "panel": "0 24px 48px rgba(0,0,0,0.55)",
    "glowRed": "0 0 24px rgba(255,61,90,0.45)",
    "glowYellow": "0 0 24px rgba(255,207,63,0.45)"
  },
  "font": {
    "display": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif",
    "ui": "\"Chakra Petch\", system-ui, sans-serif",
    "mono": "\"JetBrains Mono\", ui-monospace, Menlo, monospace"
  },
  "text": {
    "logo": {
      "fontSize": "120px",
      "lineHeight": "114px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "screenTitle": {
      "fontSize": "96px",
      "lineHeight": "96px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "pageTitle": {
      "fontSize": "32px",
      "lineHeight": "38px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "buttonXl": {
      "fontSize": "24px",
      "lineHeight": "28px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "button": {
      "fontSize": "18px",
      "lineHeight": "22px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "panelTitle": {
      "fontSize": "16px",
      "lineHeight": "20px",
      "fontWeight": 400,
      "fontFamily": "\"Russo One\", \"Chakra Petch\", system-ui, sans-serif"
    },
    "lead": {
      "fontSize": "22px",
      "lineHeight": "31px",
      "fontWeight": 400,
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "body": {
      "fontSize": "16px",
      "lineHeight": "22px",
      "fontWeight": 400,
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "row": {
      "fontSize": "15px",
      "lineHeight": "20px",
      "fontWeight": 700,
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "label": {
      "fontSize": "13px",
      "lineHeight": "16px",
      "fontWeight": 700,
      "letterSpacing": "0.14em",
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "caption": {
      "fontSize": "12px",
      "lineHeight": "16px",
      "fontWeight": 600,
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "nameTag": {
      "fontSize": "10px",
      "lineHeight": "12px",
      "fontWeight": 700,
      "fontFamily": "\"Chakra Petch\", system-ui, sans-serif"
    },
    "readout": {
      "fontSize": "44px",
      "lineHeight": "44px",
      "fontWeight": 500,
      "fontFamily": "\"JetBrains Mono\", ui-monospace, Menlo, monospace"
    },
    "mono": {
      "fontSize": "12px",
      "lineHeight": "16px",
      "fontWeight": 400,
      "fontFamily": "\"JetBrains Mono\", ui-monospace, Menlo, monospace"
    },
    "monoCaption": {
      "fontSize": "10px",
      "lineHeight": "14px",
      "fontWeight": 500,
      "letterSpacing": "0.16em",
      "fontFamily": "\"JetBrains Mono\", ui-monospace, Menlo, monospace"
    }
  },
  "avatarColors": [
    "#29D3E6",
    "#E5484D",
    "#3E63DD",
    "#30A46C",
    "#F5D90A",
    "#F76B15",
    "#8E4EC6",
    "#E93D82",
    "#99D52A",
    "#EDEEF0",
    "#8D5A3B",
    "#5B6478"
  ]
};

export default theme;
