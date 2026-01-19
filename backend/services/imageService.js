// backend/services/imageService.js
const axios = require("axios");
const sharp = require("sharp");

class ImgBBService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.imgbb.com/1/upload";
  }

  /**
   * Upload ảnh lên ImgBB
   * @param {Buffer} imageBuffer - Buffer của ảnh
   * @param {string} fileName - Tên file (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(imageBuffer, fileName = "image") {
    try {
      console.log("📤 Starting ImgBB upload...");

      // Optimize ảnh trước khi upload
      const optimizedBuffer = await this.optimizeImage(imageBuffer);
      console.log(
        ` Image optimized: ${(optimizedBuffer.length / 1024).toFixed(2)}KB`
      );

      // Convert buffer to base64
      const base64Image = optimizedBuffer.toString("base64");

      // Tạo FormData cho axios
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("image", base64Image);
      formData.append("name", fileName);

      // Upload to ImgBB
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      console.log(" ImgBB upload successful");

      return {
        success: true,
        url: response.data.data.url,
        thumbUrl: response.data.data.thumb?.url,
        displayUrl: response.data.data.display_url,
        deleteUrl: response.data.data.delete_url,
        size: response.data.data.size,
        width: response.data.data.width,
        height: response.data.data.height,
      };
    } catch (error) {
      console.error(
        " ImgBB Upload Failed:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.message ||
          "Upload failed",
      };
    }
  }

  /**
   * Upload ảnh từ base64 string
   * @param {string} base64String - Base64 string của ảnh (có thể có hoặc không có prefix)
   * @param {string} fileName - Tên file (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadBase64(base64String, fileName = "image") {
    try {
      console.log("📤 Starting ImgBB base64 upload...");

      // Remove data URI prefix if exists
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, "base64");

      // Use the main upload method
      return await this.uploadImage(buffer, fileName);
    } catch (error) {
      console.error(" Base64 upload failed:", error.message);
      return {
        success: false,
        error: error.message || "Base64 upload failed",
      };
    }
  }

  /**
   * Optimize image với sharp
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Buffer>} Optimized buffer
   */
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
      console.warn(
        "⚠️ Image optimization failed, using original:",
        error.message
      );
      return buffer; // Fallback to original
    }
  }

  /**
   * Delete image from ImgBB (requires delete URL)
   * @param {string} deleteUrl - Delete URL from upload response
   * @returns {Promise<Object>} Delete result
   */
  async deleteImage(deleteUrl) {
    try {
      if (!deleteUrl) {
        return { success: false, error: "Delete URL not provided" };
      }

      await axios.get(deleteUrl);
      console.log(" Image deleted from ImgBB");

      return { success: true };
    } catch (error) {
      console.error(" Delete failed:", error.message);
      return {
        success: false,
        error: error.message || "Delete failed",
      };
    }
  }
}

module.exports = ImgBBService;
