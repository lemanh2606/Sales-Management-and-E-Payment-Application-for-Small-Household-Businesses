const pdfParse = require("pdf-parse");
console.log("Typeof module:", typeof pdfParse);
console.log("Keys:", Object.keys(pdfParse));
if (pdfParse.default) {
  console.log("default typeof:", typeof pdfParse.default);
  console.log("default keys:", Object.keys(pdfParse.default));
}
