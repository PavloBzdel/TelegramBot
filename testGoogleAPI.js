const { google } = require("googleapis");
const credentials = require("./credentials.json");

const client = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, '\n'),
    ["https://www.googleapis.com/auth/spreadsheets"]
);

client.authorize((err) => {
    if (err) {
        console.error("❌ Помилка авторизації Google API:", err);
        return;
    }
    console.log("✅ Google API підключено успішно!");
});