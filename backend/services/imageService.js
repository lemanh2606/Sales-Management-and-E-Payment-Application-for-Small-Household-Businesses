// services/imageService.js
const axios = require("axios");
const sharp = require("sharp");

class ImgBBService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.imgbb.com/1/upload";
  }

  async uploadImage(imageBuffer, fileName = "image") {
    try {
      // Optimize ảnh trước khi upload
      const optimizedBuffer = await this.optimizeImage(imageBuffer);

      const base64Image = optimizedBuffer.toString("base64");

      const formData = new FormData();
      formData.append("image", base64Image);
      formData.append("name", fileName);

      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        url: response.data.data.url,
        thumbUrl: response.data.data.thumb?.url,
        displayUrl: response.data.data.display_url,
        deleteUrl: response.data.data.delete_url,
        size: response.data.data.size,
      };
    } catch (error) {
      console.error(
        "ImgBB Upload Failed:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: error.response?.data?.error?.message || "Upload failed",
      };
    }
  }

  async optimizeImage(buffer) {
    try {
      return await sharp(buffer)
        .resize(800, 800, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 80,
          progressive: true,
        })
        .toBuffer();
    } catch (error) {
      console.warn("Image optimization failed, using original:", error.message);
      return buffer; // Fallback to original
    }
  }
}

module.exports = ImgBBService;
