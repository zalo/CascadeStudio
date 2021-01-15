import openType from "opentype.js";

export const fonts = {};

// Preload the Various Fonts that are available via Text3D
var preloadedFonts = [
  "fonts/Roboto.ttf",
  "fonts/Papyrus.ttf",
  "fonts/Consolas.ttf"
];

Promise.all(preloadedFonts.map(async fontURL => fetch("/" + fontURL))).then(
  async responses => {
    const arrayBuffers = await Promise.all(
      responses.map(response => response.arrayBuffer())
    );
    arrayBuffers.forEach((buffer, index) => {
      let fontName = preloadedFonts[index].split("fonts/")[1].split(".ttf")[0];
      fonts[fontName] = openType.parse(buffer);
    });
  }
);
