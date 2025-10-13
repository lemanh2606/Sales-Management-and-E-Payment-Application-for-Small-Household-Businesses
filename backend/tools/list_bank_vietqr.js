//    npm install vietqr
// GET: https://api.vietqr.io/v2/banks

const { VietQR } = require("vietqr");

const vietQR = new VietQR({
  clientID: "client_id_here",
  apiKey: "api_key_here",
});

vietQR
  .getBanks()
  .then((res) => {
    const banks = res.data; // data mới là mảng
    const formattedBanks = banks.map((bank) => ({
      id: bank.id,
      name: bank.name,
      code: bank.code,
      bin: bank.bin,
      swift_code: bank.swift_code,
      shortName: bank.shortName,
    }));
    console.log(formattedBanks);
  })
  .catch((err) => {
    console.error("Error fetching banks:", err);
  });
