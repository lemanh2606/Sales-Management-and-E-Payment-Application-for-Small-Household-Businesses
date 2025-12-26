const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "SmartRetail API",
    description: "Auto generated swagger 😎",
  },
  host: "https://skinanalysis.life",
  schemes: ["https"],
};

const outputFile = "./swagger.yaml";
const endpointsFiles = ["./server.js"];

swaggerAutogen(outputFile, endpointsFiles, doc);
