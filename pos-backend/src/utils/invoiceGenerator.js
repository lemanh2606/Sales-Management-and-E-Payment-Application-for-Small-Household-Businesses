// src/utils/invoiceGenerator.js
const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');

async function generateInvoicePDF({ order, store, user }) {
  const templatePath = path.join(__dirname, '..', 'templates', 'invoice.hbs');
  const html = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(html);
  // ensure product populated fields are plain values
  const rendered = template({ order, store, user });

  // create pdf with puppeteer
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(rendered, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdfBuffer; // buffer => can send as response
}

module.exports = { generateInvoicePDF };
