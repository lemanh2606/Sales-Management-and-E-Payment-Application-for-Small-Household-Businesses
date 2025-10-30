module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  plugins: [
    [
      "module:react-native-dotenv",
      {
        moduleName: "@env",
        path: ".env",
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true,
      },
    ],
    // 👇 THÊM DÒNG NÀY VÀO ĐỂ SỬA LỖI 👇
    "@babel/plugin-transform-private-methods",
  ],
};
